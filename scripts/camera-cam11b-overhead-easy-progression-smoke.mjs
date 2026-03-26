/**
 * PR-CAM-11B: Overhead easy progression vs strict interpretation smoke
 * Run: npx tsx scripts/camera-cam11b-overhead-easy-progression-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateOverheadReachFromPoseFrames } = await import(
  '../src/lib/camera/evaluators/overhead-reach.ts'
);
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { computeOverheadEasyProgressionHold } = await import(
  '../src/lib/camera/overhead/overhead-easy-progression.ts'
);
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? ` | ${extra}` : ''}`);
  }
}

const GOOD_JOINT = { x: 0.5, y: 0.5, visibility: 0.95 };
const ALL_JOINTS = Object.fromEntries(
  [
    'nose', 'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
    'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee',
    'leftAnkle', 'rightAnkle', 'torsoCenter', 'shoulderCenter', 'hipCenter', 'ankleCenter',
  ].map((k) => [k, GOOD_JOINT])
);

function makePoseFrame(timestampMs, armElevation, phaseHint = 'peak', qualityHints = []) {
  return {
    isValid: true,
    timestampMs,
    stepId: 'overhead-reach',
    frameValidity: 'valid',
    phaseHint,
    eventHints: [],
    qualityHints,
    timestampDeltaMs: 60,
    visibilitySummary: {
      visibleLandmarkRatio: 1,
      averageVisibility: 0.95,
      leftSideCompleteness: 1,
      rightSideCompleteness: 1,
      criticalJointsAvailability: 1,
    },
    bodyBox: { area: 0.12, width: 0.35, height: 0.85 },
    joints: ALL_JOINTS,
    derived: {
      kneeAngleLeft: null,
      kneeAngleRight: null,
      kneeAngleAvg: null,
      kneeAngleGap: null,
      squatDepthProxy: null,
      kneeTrackingRatio: null,
      trunkLeanDeg: null,
      torsoExtensionDeg: 90,
      weightShiftRatio: null,
      armElevationLeft: armElevation,
      armElevationRight: armElevation,
      armElevationAvg: armElevation,
      armElevationGap: 5,
      elbowAngleLeft: 160,
      elbowAngleRight: 160,
      wristElbowAlignmentLeft: null,
      wristElbowAlignmentRight: null,
      shoulderSymmetry: null,
      pelvicDrop: null,
      swayAmplitude: null,
      holdBalance: null,
      footHeightGap: null,
      footDownDetected: false,
      torsoCorrectionDetected: false,
    },
  };
}

const OH_STATS = {
  sampledFrameCount: 40,
  droppedFrameCount: 0,
  captureDurationMs: 2800,
  timestampDiscontinuityCount: 0,
};

console.log('\nPR-CAM-11B overhead easy progression smoke\n');

// E1: near-ear (128°) + brief hold (600ms top span) → progression pass, strict false
const easyNearEarFrames = [
  ...Array.from({ length: 6 }, (_, i) => makePoseFrame(100 + i * 70, 70 + i * 8, 'raise')),
  ...Array.from({ length: 11 }, (_, i) => makePoseFrame(520 + i * 60, 128, 'peak')),
];
const e1 = evaluateOverheadReachFromPoseFrames(easyNearEarFrames);
const e1h = e1.debug?.highlightedMetrics;
ok(
  'E1: 128° + ~600ms easy top → progression completionSatisfied',
  e1h?.completionSatisfied === true,
  `path=${e1h?.completionPath} strictMotion=${e1h?.strictMotionCompletionSatisfied} easy=${e1h?.easyCompletionSatisfied}`
);
ok(
  'E1b: strict motion still false (below 132° / short strict hold)',
  e1h?.strictMotionCompletionSatisfied === 0,
  `strictHold=${e1h?.holdDurationMs}ms`
);
ok('E1c: path is easy', e1h?.completionPath === 'easy');
ok(
  'E1d: planning evidence can stay weak/minimal',
  e1.debug?.overheadEvidenceLevel === 'insufficient_signal' ||
    e1.debug?.overheadEvidenceLevel === 'weak_evidence' ||
    e1.debug?.overheadEvidenceLevel === 'shallow_evidence',
  `level=${e1.debug?.overheadEvidenceLevel}`
);

// E2: strict dwell insufficient (jitter) but real brief top → easy still can pass (reuse 11A jitter pattern)
const jitterEasyFrames = [
  ...Array.from({ length: 8 }, (_, i) => makePoseFrame(100 + i * 70, 80 + i * 8, 'raise')),
  ...Array.from({ length: 12 }, (_, i) =>
    makePoseFrame(660 + i * 60, 135 + (i % 2 === 0 ? 2 : -2), 'peak')
  ),
];
const e2 = evaluateOverheadReachFromPoseFrames(jitterEasyFrames);
const e2h = e2.debug?.highlightedMetrics;
const jitterPassesEasy =
  e2h?.completionSatisfied === true &&
  (e2h?.completionPath === 'easy' || e2h?.completionPath === 'fallback');
ok(
  'E2: jittery top, easy/fallback progression can pass',
  jitterPassesEasy,
  `path=${e2h?.completionPath} strictMotion=${e2h?.strictMotionCompletionSatisfied}`
);

// E3: weak raise only
const weakFrames = [
  ...Array.from({ length: 15 }, (_, i) => makePoseFrame(100 + i * 60, 70 + i * 2, 'raise')),
];
const e3 = evaluateOverheadReachFromPoseFrames(weakFrames);
ok('E3: weak raise only → no pass', e3.debug?.highlightedMetrics?.completionSatisfied === false);

// E4: below easy floor (120°)
const belowEasyFrames = [
  ...Array.from({ length: 6 }, (_, i) => makePoseFrame(100 + i * 70, 50 + i * 8, 'raise')),
  ...Array.from({ length: 12 }, (_, i) => makePoseFrame(520 + i * 60, 120, 'peak')),
];
const e4 = evaluateOverheadReachFromPoseFrames(belowEasyFrames);
ok('E4: 120° peak → no pass', e4.debug?.highlightedMetrics?.completionSatisfied === false);

// E5: easy unit — 126° floor
const ez = computeOverheadEasyProgressionHold({
  easyTopZoneFrames: Array.from({ length: 10 }, (_, i) => ({ timestampMs: 100 + i * 60 })),
  raiseCount: 2,
  peakCountAtEasyFloor: 3,
  effectiveArmDeg: 125,
  meanAsymmetryDeg: 5,
  maxAsymmetryDeg: 10,
});
ok('E5: easy blocked below 126° effective arm', !ez.easyCompletionSatisfied);

// E6: gate with synthetic landmarks — invalid framing path (use too-few valid concept via real pipeline)
function mockLm(ts, armDeg) {
  const lm = Array(33)
    .fill(null)
    .map((_, j) => ({ x: 0.4 + (j % 11) * 0.02, y: 0.2 + Math.floor(j / 11) * 0.08, visibility: 0.2 }));
  lm[11] = { x: 0.4, y: 0.25, visibility: 0.2 };
  lm[12] = { x: 0.6, y: 0.25, visibility: 0.2 };
  lm[13] = { x: 0.35, y: 0.25 + 0.1 * Math.sin((armDeg * Math.PI) / 180), visibility: 0.2 };
  lm[14] = { x: 0.65, y: 0.25 + 0.1 * Math.sin((armDeg * Math.PI) / 180), visibility: 0.2 };
  lm[15] = { x: 0.3, y: 0.15, visibility: 0.2 };
  lm[16] = { x: 0.7, y: 0.15, visibility: 0.2 };
  return { landmarks: lm, timestamp: ts };
}
const badVisLandmarks = Array.from({ length: 25 }, (_, i) => mockLm(100 + i * 80, 150));
const badGate = evaluateExerciseAutoProgress('overhead-reach', badVisLandmarks, OH_STATS);
ok(
  'E6: very low visibility → capture invalid / no pass',
  badGate.guardrail.captureQuality === 'invalid' || !badGate.completionSatisfied
);

// E7: Squat untouched
const { evaluateSquatFromPoseFrames } = await import('../src/lib/camera/evaluators/squat.ts');
const { buildPoseFeaturesFrames: bpf } = await import('../src/lib/camera/pose-features.ts');
function sqLm(ts) {
  const lm = Array(33)
    .fill(null)
    .map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  return { landmarks: lm, timestamp: ts };
}
const sqF = bpf(
  'squat',
  Array.from({ length: 30 }, (_, i) => sqLm(100 + i * 50))
);
ok('E7: squat stepId', evaluateSquatFromPoseFrames(sqF).stepId === 'squat');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
