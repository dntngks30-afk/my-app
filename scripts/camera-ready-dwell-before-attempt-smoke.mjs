/**
 * Setup false-pass lock — readiness stable dwell before rep pipeline
 *
 * npx tsx scripts/camera-ready-dwell-before-attempt-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatReadinessStableDwell,
  poseFrameMeetsCaptureReadyProxy,
  SQUAT_READINESS_STABLE_DWELL_FRAMES,
} = await import('../src/lib/camera/squat-completion-state.ts');
const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra !== undefined ? extra : '');
    process.exitCode = 1;
  }
}

function mockLandmark(x, y, visibility = 0.99) {
  return { x, y, visibility };
}
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
  const depthT = Math.min(1, Math.max(0, (170 - kneeAngleDeg) / 110));
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}
function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}
function squatStats(len) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * 80,
    timestampDiscontinuityCount: 0,
  };
}

function goodSquatFrame(ts, area = 0.35) {
  return {
    timestampMs: ts,
    isValid: true,
    phaseHint: 'start',
    derived: { squatDepthProxy: 0.02 },
    visibilitySummary: {
      averageVisibility: 0.92,
      criticalJointsAvailability: 0.72,
      visibleLandmarkRatio: 0.75,
      leftSideCompleteness: 0.85,
      rightSideCompleteness: 0.85,
    },
    bodyBox: { area, width: 0.4, height: 0.75 },
    qualityHints: [],
    frameValidity: 'valid',
    joints: {
      ankleCenter: { x: 0.5, y: 0.62, visibility: 0.99 },
      hipCenter: { x: 0.5, y: 0.42, visibility: 0.99 },
    },
    eventHints: [],
    timestampDeltaMs: 33,
    stepId: 'squat',
  };
}

console.log('\nPR setup-lock camera-ready-dwell-before-attempt-smoke\n');

{
  const almost = Array.from({ length: SQUAT_READINESS_STABLE_DWELL_FRAMES - 1 }, (_, i) =>
    goodSquatFrame(100 + i * 40)
  );
  const d1 = computeSquatReadinessStableDwell(almost);
  ok('11 consecutive good-like frames: dwell not satisfied', d1.satisfied === false, d1);
}

{
  const full = Array.from({ length: SQUAT_READINESS_STABLE_DWELL_FRAMES }, (_, i) =>
    goodSquatFrame(200 + i * 40)
  );
  ok(
    'single frame proxy self-check',
    full.every((f) => poseFrameMeetsCaptureReadyProxy(f)),
    full.findIndex((f) => !poseFrameMeetsCaptureReadyProxy(f))
  );
  const d2 = computeSquatReadinessStableDwell(full);
  ok('12 consecutive good frames: dwell satisfied', d2.satisfied === true, d2);
  ok('slice starts at 0 when dwell from start', d2.firstSliceStartIndexInValid === 0, d2);
}

{
  const STANDING = Array(16).fill(170);
  const DEEP = [
    170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
    ...Array(12).fill(170),
  ];
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const sc = gate.squatCycleDebug ?? {};
  ok('deep squat: gate pass', gate.status === 'pass', gate.status);
  ok('deep: readinessStableDwellSatisfied true', sc.readinessStableDwellSatisfied === true, sc);
  ok('deep: attemptStartedAfterReady true', sc.attemptStartedAfterReady === true, sc);
  ok('deep: setupMotionBlocked false', sc.setupMotionBlocked !== true, sc);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
