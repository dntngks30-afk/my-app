/**
 * PR-OH-HEAD-RELATIVE-SIGNAL-04E smoke — additive head-relative overhead diagnostics
 *
 * Run: npx tsx scripts/camera-oh-head-relative-signal-04e-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { POSE_LANDMARKS } = await import('../src/lib/motion/pose-types.ts');
const { buildPoseFeaturesFrames } = await import('../src/lib/camera/pose-features.ts');
const { evaluateOverheadReachFromPoseFrames } = await import('../src/lib/camera/evaluators/overhead-reach.ts');
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
  } else {
    failed++;
    const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
    console.error(`  FAIL: ${name}${detail}`);
    process.exitCode = 1;
  }
}

function fillLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.55, visibility: 0.95 }));
}

/** Symmetric frontal pose; y grows downward. */
function landmarkFrame(ts, { sy, ey, wy, hipY, noseY, earY }) {
  const L = fillLandmarks();
  const set = (i, x, y) => {
    L[i] = { x, y, visibility: 0.95 };
  };
  set(POSE_LANDMARKS.NOSE, 0.5, noseY);
  set(POSE_LANDMARKS.LEFT_EAR, 0.42, earY);
  set(POSE_LANDMARKS.RIGHT_EAR, 0.58, earY);
  set(POSE_LANDMARKS.LEFT_SHOULDER, 0.42, sy);
  set(POSE_LANDMARKS.RIGHT_SHOULDER, 0.58, sy);
  set(POSE_LANDMARKS.LEFT_ELBOW, 0.4, ey);
  set(POSE_LANDMARKS.RIGHT_ELBOW, 0.6, ey);
  set(POSE_LANDMARKS.LEFT_WRIST, 0.38, wy);
  set(POSE_LANDMARKS.RIGHT_WRIST, 0.62, wy);
  set(POSE_LANDMARKS.LEFT_HIP, 0.44, hipY);
  set(POSE_LANDMARKS.RIGHT_HIP, 0.56, hipY);
  set(POSE_LANDMARKS.LEFT_KNEE, 0.44, hipY + 0.18);
  set(POSE_LANDMARKS.RIGHT_KNEE, 0.56, hipY + 0.18);
  set(POSE_LANDMARKS.LEFT_ANKLE, 0.44, hipY + 0.38);
  set(POSE_LANDMARKS.RIGHT_ANKLE, 0.56, hipY + 0.38);
  return { landmarks: L, timestamp: ts };
}

const DEFAULT_FACE = { noseY: 0.22, earY: 0.24 };

console.log('\n[AT1] Overhead — 04E head-relative fields populated; 04B + legacy unchanged shape');
{
  const down = landmarkFrame(0, { sy: 0.38, ey: 0.52, wy: 0.62, hipY: 0.78, ...DEFAULT_FACE });
  const ohFrames = buildPoseFeaturesFrames('overhead-reach', [down]);
  const d = ohFrames[0].derived;
  ok('AT1a: wristAboveNoseAvgNorm is number', typeof d.wristAboveNoseAvgNorm === 'number');
  ok('AT1b: wristAboveEarAvgNorm is number', typeof d.wristAboveEarAvgNorm === 'number');
  ok('AT1c: wristAboveHeadTopProxyAvgNorm is number', typeof d.wristAboveHeadTopProxyAvgNorm === 'number');
  ok('AT1d: 04B wristAboveShoulderAvgNorm still present', typeof d.wristAboveShoulderAvgNorm === 'number');
  ok('AT1e: legacy armElevationAvg still present', typeof d.armElevationAvg === 'number');
}

console.log('\n[AT2] Sanity — wrists clearly above face landmarks → higher 04E norms than arms hanging');
{
  const armsLow = landmarkFrame(0, {
    sy: 0.38,
    ey: 0.55,
    wy: 0.68,
    hipY: 0.78,
    noseY: 0.2,
    earY: 0.22,
  });
  const armsHigh = landmarkFrame(0, {
    sy: 0.38,
    ey: 0.22,
    wy: 0.1,
    hipY: 0.78,
    noseY: 0.32,
    earY: 0.34,
  });
  const fLow = buildPoseFeaturesFrames('overhead-reach', [armsLow])[0].derived;
  const fHigh = buildPoseFeaturesFrames('overhead-reach', [armsHigh])[0].derived;
  ok(
    'AT2a: wristAboveNoseAvgNorm higher when wrists above nose',
    (fHigh.wristAboveNoseAvgNorm ?? -999) > (fLow.wristAboveNoseAvgNorm ?? -999),
    { high: fHigh.wristAboveNoseAvgNorm, low: fLow.wristAboveNoseAvgNorm }
  );
  ok(
    'AT2b: wristAboveEarAvgNorm higher when wrists above ears',
    (fHigh.wristAboveEarAvgNorm ?? -999) > (fLow.wristAboveEarAvgNorm ?? -999),
    { high: fHigh.wristAboveEarAvgNorm, low: fLow.wristAboveEarAvgNorm }
  );
  ok(
    'AT2c: wristBelow face → negative or lower nose norm',
    (fLow.wristAboveNoseAvgNorm ?? 0) < (fHigh.wristAboveNoseAvgNorm ?? 0),
    { low: fLow.wristAboveNoseAvgNorm, high: fHigh.wristAboveNoseAvgNorm }
  );
}

console.log('\n[AT3] Squat — 04E fields null (overhead-only), squat metrics unchanged');
{
  const pose = landmarkFrame(0, { sy: 0.38, ey: 0.22, wy: 0.1, hipY: 0.78, ...DEFAULT_FACE });
  const sq = buildPoseFeaturesFrames('squat', [pose])[0].derived;
  ok('AT3a: wristAboveNoseAvgNorm null for squat', sq.wristAboveNoseAvgNorm === null);
  ok('AT3b: wristAboveHeadTopProxyAvgNorm null for squat', sq.wristAboveHeadTopProxyAvgNorm === null);
  ok('AT3c: 04B shoulder kinematics null for squat', sq.wristAboveShoulderAvgNorm === null);
  ok('AT3d: armElevationAvg still computed for squat', typeof sq.armElevationAvg === 'number');
}

console.log('\n[AT4] Trace — legacy + 04B + 04E distinct keys on diagnosisSummary.overhead');
{
  const seq = Array.from({ length: 25 }, (_, i) =>
    landmarkFrame(100 + i * 50, { sy: 0.38, ey: 0.22, wy: 0.1, hipY: 0.78, noseY: 0.3, earY: 0.32 })
  );
  const ev = evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', seq));
  const hm = ev.debug?.highlightedMetrics;
  ok(
    'AT4a: ohHeadRelativePeakWristAboveNoseAvgNorm present',
    typeof hm?.ohHeadRelativePeakWristAboveNoseAvgNorm === 'number',
    hm?.ohHeadRelativePeakWristAboveNoseAvgNorm
  );
  ok(
    'AT4b: ohKinematicPeakWristAboveShoulderAvgNorm still present (04B)',
    typeof hm?.ohKinematicPeakWristAboveShoulderAvgNorm === 'number',
    hm?.ohKinematicPeakWristAboveShoulderAvgNorm
  );

  const gate = {
    status: 'retry',
    progressionState: 'failed',
    confidence: 0.5,
    completionSatisfied: false,
    nextAllowed: false,
    flags: [],
    reasons: [],
    failureReasons: [],
    userGuidance: [],
    retryRecommended: false,
    evaluatorResult: ev,
    guardrail: {
      captureQuality: 'valid',
      flags: [],
      debug: { sampledFrameCount: 25 },
    },
    uiMessage: '',
    autoAdvanceDelayMs: 0,
    passConfirmationSatisfied: false,
    passConfirmationFrameCount: 0,
    passConfirmationWindowCount: 0,
    finalPassEligible: false,
    finalPassBlockedReason: null,
  };
  const snap = buildAttemptSnapshot('overhead-reach', gate, undefined, {});
  const oh = snap?.diagnosisSummary?.overhead;
  ok(
    'AT4c: trace ohHeadRelativeMeanWristAboveEarAvgNorm',
    typeof oh?.ohHeadRelativeMeanWristAboveEarAvgNorm === 'number',
    oh?.ohHeadRelativeMeanWristAboveEarAvgNorm
  );
  ok(
    'AT4d: trace ohKinematicMeanShoulderWristElevationAvgDeg (04B family)',
    typeof oh?.ohKinematicMeanShoulderWristElevationAvgDeg === 'number',
    oh?.ohKinematicMeanShoulderWristElevationAvgDeg
  );
  ok(
    'AT4e: trace truePeakArmElevationDeg (legacy)',
    typeof oh?.truePeakArmElevationDeg === 'number',
    oh?.truePeakArmElevationDeg
  );
}

console.log(`\nPR-OH-HEAD-RELATIVE-SIGNAL-04E smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
