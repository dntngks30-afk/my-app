/**
 * PR-OH-VISUAL-TRUTH-OBS-06B: visual-truth candidate export smoke (additive observability only).
 * Run: npx tsx scripts/oh-visual-truth-obs-06b-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateOverheadReachFromPoseFrames } = await import('../src/lib/camera/evaluators/overhead-reach.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { assessStepGuardrail } = await import('../src/lib/camera/guardrails.ts');
const { evaluateSquat } = await import('../src/lib/camera/evaluators/squat.ts');
const { OVERHEAD_VISUAL_TRUTH_EXPORT_VERSION } = await import(
  '../src/lib/camera/overhead/visual-truth-candidates.ts'
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

function assertCandidateMetrics(c, label) {
  if (!c) return false;
  const rawKeys = [
    'rawArmElevationAvgDeg',
    'rawWristAboveNoseAvgNorm',
    'rawWristAboveEarAvgNorm',
    'rawWristAboveHeadTopProxyAvgNorm',
    'rawShoulderWristElevationAvgDeg',
  ];
  const smKeys = [
    'smoothedArmElevationAvgDeg',
    'smoothedWristAboveNoseAvgNorm',
    'smoothedWristAboveEarAvgNorm',
    'smoothedWristAboveHeadTopProxyAvgNorm',
    'smoothedShoulderWristElevationAvgDeg',
  ];
  for (const k of rawKeys) {
    const v = c[k];
    if (v != null && typeof v !== 'number') return false;
  }
  for (const k of smKeys) {
    const v = c[k];
    if (v != null && typeof v !== 'number') return false;
  }
  return c.survivedHookAcceptance === true && typeof c.insideSelectedWindow === 'boolean';
}

function assertLandmarks(lc) {
  if (!lc) return false;
  const keys = [
    'nose',
    'leftEar',
    'rightEar',
    'leftWrist',
    'rightWrist',
    'leftElbow',
    'rightElbow',
    'leftShoulder',
    'rightShoulder',
    'leftHip',
    'rightHip',
  ];
  for (const k of keys) {
    if (!(k in lc)) return false;
  }
  return lc.headTopProxySource === 'min_nose_leftEar_rightEar_y';
}

console.log('PR-OH-VISUAL-TRUTH-OBS-06B smoke test\n');

const realOhPoses = Array(20)
  .fill(0)
  .map((_, i) => overheadPoseLandmarks(100 + i * 60, Math.min(160, 40 + i * 6)));
const realOhLandmarks = toLandmarks(realOhPoses);
const realFrames = buildPoseFeaturesFrames('overhead-reach', realOhLandmarks);
const realResult = evaluateOverheadReachFromPoseFrames(realFrames);
const realGr = assessStepGuardrail('overhead-reach', realOhLandmarks, OH_STATS, realResult);

const vtc = realGr.debug?.visualTruthCandidates;

ok('A: export version matches', vtc?.version === OVERHEAD_VISUAL_TRUTH_EXPORT_VERSION);
ok(
  'B: selected-window vs global arm candidates exist',
  vtc?.selectedWindowBest != null && vtc?.globalBestArmElevation != null
);
ok(
  'C: raw+smoothed fields present on global arm candidate',
  assertCandidateMetrics(vtc?.globalBestArmElevation, 'global')
);
ok(
  'D: head-relative candidate present with metrics',
  vtc?.globalBestHeadRelative != null && assertCandidateMetrics(vtc.globalBestHeadRelative, 'head')
);
ok(
  'E: representative candidates bounded (≤5) with landmarks',
  Array.isArray(vtc?.representativeCandidates) &&
    vtc.representativeCandidates.length <= 5 &&
    vtc.representativeCandidates.length > 0 &&
    vtc.representativeCandidates.every((r) => assertLandmarks(r.landmarksCompact))
);
ok(
  'F: near-top loss summary shape',
  vtc?.nearTopLossSummary != null &&
    typeof vtc.nearTopLossSummary.bufferFrameCount === 'number' &&
    typeof vtc.nearTopLossSummary.hookDroppedFrameCount === 'number' &&
    typeof vtc.nearTopLossSummary.strongestArmElevationOutsideSelectedWindow === 'boolean' &&
    typeof vtc.nearTopLossSummary.hasStrongerNonAnalyzableRawArmThanSelectedWindowBestSmoothed ===
      'boolean'
);

ok(
  'G: can compare inside vs outside window flags',
  typeof vtc?.globalBestArmElevation?.insideSelectedWindow === 'boolean'
);

const squatGr = assessStepGuardrail('squat', realOhLandmarks, OH_STATS, evaluateSquat(realOhLandmarks));
ok('H: squat guardrail omits visualTruthCandidates', squatGr.debug?.visualTruthCandidates === undefined);

/** Sequence designed so a short high-arm spike sits outside the quality-selected window. */
const spikePoses = [];
for (let i = 0; i < 8; i++) {
  spikePoses.push(overheadPoseLandmarks(1000 + i * 50, 45 + i * 3));
}
for (let i = 0; i < 3; i++) {
  spikePoses.push(overheadPoseLandmarks(1400 + i * 40, 165));
}
for (let i = 0; i < 25; i++) {
  spikePoses.push(overheadPoseLandmarks(1520 + i * 55, 70 + (i % 5) * 2));
}
const spikeLandmarks = toLandmarks(spikePoses);
const spikeStats = {
  ...OH_STATS,
  sampledFrameCount: spikeLandmarks.length + 2,
  droppedFrameCount: 2,
};
const spikeFrames = buildPoseFeaturesFrames('overhead-reach', spikeLandmarks);
const spikeEval = evaluateOverheadReachFromPoseFrames(spikeFrames);
const spikeGr = assessStepGuardrail('overhead-reach', spikeLandmarks, spikeStats, spikeEval);
const spikeVtc = spikeGr.debug?.visualTruthCandidates;
ok(
  'I: crafted sequence can expose global arm outside selected window',
  spikeVtc?.globalBestArmElevation != null &&
    spikeVtc?.selectedWindowBest != null &&
    spikeVtc.globalBestArmElevation.insideSelectedWindow === false &&
    spikeVtc.nearTopLossSummary.strongestArmElevationOutsideSelectedWindow === true
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
