/**
 * PR-OH-DISTAL-HAND-OBS-07B: distal-hand observability on visualTruthCandidates (Node smoke).
 * Run: npx tsx scripts/oh-distal-hand-obs-07b-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { assessStepGuardrail } = await import('../src/lib/camera/guardrails.ts');
const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { evaluateSquat } = await import('../src/lib/camera/evaluators/squat.ts');
const { OVERHEAD_DISTAL_HAND_OBS_VERSION } = await import(
  '../src/lib/camera/overhead/distal-hand-observability.ts'
);

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function mockLandmark(x, y, visibility = 0.9) {
  return { x, y, visibility };
}

function overheadPoseLandmarks(timestamp, armAngle) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) =>
      mockLandmark(0.4 + (j % 11) * 0.02, 0.2 + Math.floor(j / 11) * 0.08, 0.9)
    );
  lm[11] = mockLandmark(0.4, 0.25, 0.9);
  lm[12] = mockLandmark(0.6, 0.25, 0.9);
  lm[13] = mockLandmark(0.35, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[14] = mockLandmark(0.65, 0.25 + 0.1 * Math.sin((armAngle * Math.PI) / 180), 0.9);
  lm[15] = mockLandmark(0.3, 0.15, 0.9);
  lm[16] = mockLandmark(0.7, 0.15, 0.9);
  lm[17] = mockLandmark(0.28, 0.12, 0.88);
  lm[18] = mockLandmark(0.72, 0.12, 0.88);
  lm[19] = mockLandmark(0.27, 0.1, 0.9);
  lm[20] = mockLandmark(0.73, 0.1, 0.9);
  lm[21] = mockLandmark(0.29, 0.13, 0.85);
  lm[22] = mockLandmark(0.71, 0.13, 0.85);
  return { landmarks: lm, timestamp };
}

function toLandmarks(poses) {
  return poses.map((p) => ({ landmarks: p.landmarks, timestamp: p.timestamp }));
}

const OH_STATS = {
  sampledFrameCount: 25,
  droppedFrameCount: 0,
  captureDurationMs: 1500,
  timestampDiscontinuityCount: 0,
  landmarkOrAdaptorFailedFrameCount: 0,
  validFrameCount: 25,
  filteredLowQualityFrameCount: 0,
  unstableFrameCount: 0,
};

function assertSideSplit(s) {
  return (
    s &&
    'leftNorm' in s &&
    'rightNorm' in s &&
    'meanNorm' in s &&
    'bestSideNorm' in s &&
    'bestSide' in s
  );
}

function assertDistalVector(v) {
  return (
    v &&
    typeof v.leftIndexNorm !== 'undefined' &&
    typeof v.meanBestVisibleDistalNorm !== 'undefined' &&
    typeof v.bestSideBestVisibleDistalNorm !== 'undefined'
  );
}

console.log('PR-OH-DISTAL-HAND-OBS-07B smoke test\n');

const realOhPoses = Array(20)
  .fill(0)
  .map((_, i) => overheadPoseLandmarks(100 + i * 60, Math.min(160, 40 + i * 6)));
const realOhLandmarks = toLandmarks(realOhPoses);
const realResult = evaluateOverheadReachFromPoseFrames(
  buildPoseFeaturesFrames('overhead-reach', realOhLandmarks)
);
const realGr = assessStepGuardrail('overhead-reach', realOhLandmarks, OH_STATS, realResult);
const vtc = realGr.debug?.visualTruthCandidates;
const reps = vtc?.representativeCandidates ?? [];

ok('A: visualTruthCandidates present', vtc != null);
ok('B: representative candidates bounded', reps.length > 0 && reps.length <= 5);

const withDistal = reps.filter((r) => r.distalHandObservability != null);
ok('C: distal-hand on representative rows', withDistal.length > 0);

const d0 = withDistal[0]?.distalHandObservability;
ok('D: distal version tag', d0?.version === OVERHEAD_DISTAL_HAND_OBS_VERSION);
ok(
  'E: wrist side-split (nose/ear/headTop)',
  d0 != null &&
    assertSideSplit(d0.wristAboveNose) &&
    assertSideSplit(d0.wristAboveEar) &&
    assertSideSplit(d0.wristAboveHeadTopProxy)
);
ok(
  'F: distal-hand ref vectors',
  d0 != null &&
    assertDistalVector(d0.distalHandAboveNose) &&
    assertDistalVector(d0.distalHandAboveEar) &&
    assertDistalVector(d0.distalHandAboveHeadTopProxy)
);
ok(
  'G: best-visible distal labels',
  d0 != null &&
    ['index', 'pinky', 'thumb', null].includes(d0.bestVisibleDistalPointLeft) &&
    ['left', 'right', 'tie', null].includes(d0.bestSideByBestVisibleDistalAboveNose)
);

const squatGr = assessStepGuardrail('squat', realOhLandmarks, OH_STATS, evaluateSquat(realOhLandmarks));
ok('H: squat omits visualTruthCandidates distal path', squatGr.debug?.visualTruthCandidates === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
