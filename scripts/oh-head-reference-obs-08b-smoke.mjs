/**
 * PR-OH-HEAD-REFERENCE-OBS-08B: head-reference observability on visualTruthCandidates (Node smoke).
 * Run: npx tsx scripts/oh-head-reference-obs-08b-smoke.mjs
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
const { OVERHEAD_HEAD_REFERENCE_OBS_VERSION } = await import(
  '../src/lib/camera/overhead/head-reference-observability.ts'
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

function assertFamilyStrip(f) {
  return (
    f &&
    f.diagnosticOnly === true &&
    typeof f.referenceType === 'string' &&
    typeof f.referenceSource === 'string' &&
    'referenceY' in f &&
    assertSideSplit(f.wristAboveRef) &&
    assertSideSplit(f.distalHandAboveRef)
  );
}

function jsonEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

console.log('PR-OH-HEAD-REFERENCE-OBS-08B smoke test\n');

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

const withHead = reps.filter((r) => r.headReferenceObservability != null);
ok('C: headReferenceObservability on representative rows', withHead.length > 0);

const h0 = withHead[0]?.headReferenceObservability;
ok('D: version tag', h0?.version === OVERHEAD_HEAD_REFERENCE_OBS_VERSION);

const families = h0
  ? [
      h0.noseOnly,
      h0.earOnly,
      h0.currentHeadTopProxy,
      h0.relaxedHeadTopProxyCandidate,
      h0.faceCenterCandidate,
    ]
  : [];

ok(
  'E: all five reference families + meta + wrist/distal side-split',
  families.length === 5 && families.every(assertFamilyStrip)
);

const d0 = withHead[0]?.distalHandObservability;
ok(
  'F: 07B wristAboveHeadTopProxy unchanged vs 08B currentHeadTopProxy.wristAboveRef',
  d0 != null &&
    h0 != null &&
    jsonEq(d0.wristAboveHeadTopProxy, h0.currentHeadTopProxy.wristAboveRef)
);

const lc = withHead[0]?.landmarksCompact;
ok(
  'G: currentHeadTopProxy.referenceY matches landmarksCompact derivedHeadTopProxyY',
  lc != null &&
    h0 != null &&
    lc.derivedHeadTopProxyY === h0.currentHeadTopProxy.referenceY
);

ok(
  'H: relaxed ref is less aggressive than min proxy (referenceY >= current when both finite)',
  h0 != null &&
    typeof h0.currentHeadTopProxy.referenceY === 'number' &&
    typeof h0.relaxedHeadTopProxyCandidate.referenceY === 'number' &&
    h0.relaxedHeadTopProxyCandidate.referenceY >= h0.currentHeadTopProxy.referenceY - 1e-9
);

const squatGr = assessStepGuardrail('squat', realOhLandmarks, OH_STATS, evaluateSquat(realOhLandmarks));
ok('I: squat omits visualTruthCandidates', squatGr.debug?.visualTruthCandidates === undefined);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
