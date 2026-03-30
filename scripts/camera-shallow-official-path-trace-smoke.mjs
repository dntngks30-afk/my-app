/**
 * PR-03 — diagnosis/snapshot official shallow path fields
 *
 * npx tsx scripts/camera-shallow-official-path-trace-smoke.mjs
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
const SHALLOW = [
  170, 168, 162, 152, 140, 130, 118, 105, 98, 95, 93, 92,
  93, 95, 100, 110, 122, 136, 150, 163, 170,
];

console.log('\nPR-03 camera-shallow-official-path-trace-smoke\n');

{
  const lm = toLandmarks(makeKneeAngleSeries(1000, [...STANDING, ...SHALLOW, ...Array(10).fill(170)]));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length));
  const snap = buildAttemptSnapshot('squat', gate, undefined, {});
  ok('snap', snap != null, snap);
  const sc = snap?.diagnosisSummary?.squatCycle;
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  ok('diag officialShallowPathCandidate', sc?.officialShallowPathCandidate === cs.officialShallowPathCandidate, {
    sc: sc?.officialShallowPathCandidate,
    cs: cs.officialShallowPathCandidate,
  });
  ok('diag officialShallowPathClosed', sc?.officialShallowPathClosed === cs.officialShallowPathClosed, {
    sc: sc?.officialShallowPathClosed,
    cs: cs.officialShallowPathClosed,
  });
  ok('diag closedAsOfficialRomCycle', sc?.closedAsOfficialRomCycle === true, sc?.closedAsOfficialRomCycle);
  ok('diag closedAsEventRescue false', sc?.closedAsEventRescuePassReason === false, sc?.closedAsEventRescuePassReason);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
