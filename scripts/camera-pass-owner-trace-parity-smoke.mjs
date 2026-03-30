/**
 * PR-01 — snapshot/diagnosis: completionTruthPassed vs completionOwnerPassed vs UI gate
 *
 * npx tsx scripts/camera-pass-owner-trace-parity-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress } = await import('../src/lib/camera/auto-progression.ts');
const { buildAttemptSnapshot } = await import('../src/lib/camera/camera-trace.ts');

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
function clamp(v, a = 0, b = 1) {
  return Math.min(b, Math.max(a, v));
}
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const landmarks = Array(33)
    .fill(null)
    .map((_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99));
  const depthT = clamp((170 - kneeAngleDeg) / 110);
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

const STANDING = Array(12).fill(170);
const DEEP_STANDARD = [
  170, 165, 155, 142, 128, 112, 95, 82, 70, 62, 58, 55, 57, 62, 70, 82, 95, 112, 128, 142, 155, 165, 170,
  ...Array(12).fill(170),
];

function assertParity(label, gate, snap) {
  const sc = gate.squatCycleDebug ?? {};
  const sq = snap?.diagnosisSummary?.squatCycle;
  ok(`${label}: snapshot squatCycle exists`, sq != null);
  ok(
    `${label}: completionTruthPassed parity`,
    sq?.completionTruthPassed === sc.completionTruthPassed,
    { snap: sq?.completionTruthPassed, debug: sc.completionTruthPassed }
  );
  ok(
    `${label}: completionOwnerPassed parity`,
    sq?.completionOwnerPassed === sc.completionOwnerPassed,
    { snap: sq?.completionOwnerPassed, debug: sc.completionOwnerPassed }
  );
  ok(
    `${label}: finalSuccessOwner parity`,
    sq?.finalSuccessOwner === sc.finalSuccessOwner,
    { snap: sq?.finalSuccessOwner, debug: sc.finalSuccessOwner }
  );
  ok(
    `${label}: uiProgressionAllowed parity`,
    sq?.uiProgressionAllowed === sc.uiProgressionAllowed,
    { snap: sq?.uiProgressionAllowed, debug: sc.uiProgressionAllowed }
  );
  ok(
    `${label}: uiProgressionBlockedReason parity`,
    (sq?.uiProgressionBlockedReason ?? null) === (sc.uiProgressionBlockedReason ?? null),
    { snap: sq?.uiProgressionBlockedReason, debug: sc.uiProgressionBlockedReason }
  );
}

console.log('\nPR-01 camera-pass-owner-trace-parity-smoke\n');

// owner true + ui allowed → success 가능
{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const snap = buildAttemptSnapshot('squat', gate, undefined, {});
  const sc = gate.squatCycleDebug ?? {};
  ok('success path: owner + ui', sc.completionOwnerPassed === true && sc.uiProgressionAllowed === true, sc);
  ok('success path: gate pass', gate.status === 'pass', gate.status);
  assertParity('success', gate, snap);
}

// owner false → success 불가
{
  const lm = toLandmarks(makeKneeAngleSeries(3000, [...STANDING, ...STANDING]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const snap = buildAttemptSnapshot('squat', gate, undefined, {});
  const sc = gate.squatCycleDebug ?? {};
  ok('fail path: owner false', sc.completionOwnerPassed === false, sc);
  ok('fail path: not pass', gate.status !== 'pass', gate.status);
  assertParity('standing-fail', gate, snap);
}

// completionTruthPassed 는 gate completionSatisfied 기반 — owner 와 다를 수 있음(문서화만 검증)
{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...DEEP_STANDARD, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const sc = gate.squatCycleDebug ?? {};
  ok('parity: both truth flags booleans', typeof sc.completionTruthPassed === 'boolean');
  ok('parity: both owner flags booleans', typeof sc.completionOwnerPassed === 'boolean');
  if (sc.completionOwnerPassed === true && sc.completionTruthPassed === true) {
    ok('aligned success: truth+owner true', sc.uiProgressionAllowed === true || gate.status !== 'pass');
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
