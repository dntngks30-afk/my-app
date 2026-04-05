/**
 * PR-OH-KINEMATIC-SIGNAL-04B smoke — additive overhead candidate kinematics
 *
 * Run: npx tsx scripts/camera-oh-kinematic-signal-04b-smoke.mjs
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

/** Symmetric frontal pose; y grows downward. hipY > shoulderY > ... */
function landmarkFrame(ts, { sy, ey, wy, hipY }) {
  const L = fillLandmarks();
  const set = (i, x, y) => {
    L[i] = { x, y, visibility: 0.95 };
  };
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

console.log('\n[AT1] Overhead step — new candidate signals populated');
{
  const down = landmarkFrame(0, { sy: 0.38, ey: 0.52, wy: 0.62, hipY: 0.78 });
  const ohFrames = buildPoseFeaturesFrames('overhead-reach', [down]);
  const d = ohFrames[0].derived;
  ok('AT1a: shoulderWristElevationAvgDeg is number', typeof d.shoulderWristElevationAvgDeg === 'number');
  ok('AT1b: wristAboveShoulderAvgNorm is number', typeof d.wristAboveShoulderAvgNorm === 'number');
  ok('AT1c: elbowAboveShoulderAvgNorm is number', typeof d.elbowAboveShoulderAvgNorm === 'number');
  ok('AT1d: legacy armElevationAvg still computed', typeof d.armElevationAvg === 'number');
}

console.log('\n[AT2] Sanity — wrists above shoulders increase wristAboveShoulder norm vs arms down');
{
  const armsDown = landmarkFrame(0, { sy: 0.38, ey: 0.55, wy: 0.68, hipY: 0.78 });
  const armsUp = landmarkFrame(0, { sy: 0.38, ey: 0.24, wy: 0.12, hipY: 0.78 });
  const fDown = buildPoseFeaturesFrames('overhead-reach', [armsDown])[0].derived;
  const fUp = buildPoseFeaturesFrames('overhead-reach', [armsUp])[0].derived;
  ok(
    'AT2a: wristAboveShoulderAvgNorm higher when up',
    (fUp.wristAboveShoulderAvgNorm ?? -999) > (fDown.wristAboveShoulderAvgNorm ?? -999),
    { up: fUp.wristAboveShoulderAvgNorm, down: fDown.wristAboveShoulderAvgNorm }
  );
  ok(
    'AT2b: shoulderWristElevationAvgDeg higher when up (full arm line)',
    (fUp.shoulderWristElevationAvgDeg ?? -1) > (fDown.shoulderWristElevationAvgDeg ?? -1),
    { up: fUp.shoulderWristElevationAvgDeg, down: fDown.shoulderWristElevationAvgDeg }
  );
}

console.log('\n[AT3] Squat step — overhead candidate fields null (not populated)');
{
  const armsUp = landmarkFrame(0, { sy: 0.38, ey: 0.24, wy: 0.12, hipY: 0.78 });
  const sq = buildPoseFeaturesFrames('squat', [armsUp])[0].derived;
  ok('AT3a: shoulderWristElevationAvgDeg null for squat', sq.shoulderWristElevationAvgDeg === null);
  ok('AT3b: wristAboveShoulderAvgNorm null for squat', sq.wristAboveShoulderAvgNorm === null);
  ok('AT3c: armElevationAvg still computed for squat', typeof sq.armElevationAvg === 'number');
}

console.log('\n[AT4] Evaluator highlightedMetrics + camera trace echo');
{
  const armsUp = landmarkFrame(0, { sy: 0.38, ey: 0.24, wy: 0.12, hipY: 0.78 });
  const seq = Array.from({ length: 25 }, (_, i) => landmarkFrame(100 + i * 50, { sy: 0.38, ey: 0.24, wy: 0.12, hipY: 0.78 }));
  const ev = evaluateOverheadReachFromPoseFrames(buildPoseFeaturesFrames('overhead-reach', seq));
  const hm = ev.debug?.highlightedMetrics;
  ok(
    'AT4a: ohKinematicPeakShoulderWristElevationAvgDeg present',
    typeof hm?.ohKinematicPeakShoulderWristElevationAvgDeg === 'number',
    hm?.ohKinematicPeakShoulderWristElevationAvgDeg
  );
  ok(
    'AT4b: ohKinematicPeakWristAboveShoulderAvgNorm present',
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
    'AT4c: trace echoes ohKinematicPeakShoulderWristElevationAvgDeg',
    typeof oh?.ohKinematicPeakShoulderWristElevationAvgDeg === 'number',
    oh?.ohKinematicPeakShoulderWristElevationAvgDeg
  );
  ok(
    'AT4d: trace echoes truePeakArmElevationDeg (legacy family)',
    typeof oh?.truePeakArmElevationDeg === 'number',
    oh?.truePeakArmElevationDeg
  );
}

console.log(`\nPR-OH-KINEMATIC-SIGNAL-04B smoke: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
