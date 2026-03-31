/**
 * PR-DOWNUP-GUARANTEE-03 — symptom-class ultra-shallow rep must reach real gate pass (not only completion-state).
 *
 * npx tsx scripts/camera-squat-ultra-shallow-pass-guarantee-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);
const { resolveSquatCompletionLineageOwner } = await import(
  '../src/lib/camera/squat/squat-progression-contract.ts'
);

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

function squatStats(landmarks, captureDurationMs = 3200) {
  return {
    sampledFrameCount: landmarks.length,
    droppedFrameCount: 0,
    captureDurationMs,
    timestampDiscontinuityCount: 0,
  };
}

console.log('\ncamera-squat-ultra-shallow-pass-guarantee-01-smoke (PR-DOWNUP-GUARANTEE-03)\n');

/**
 * cam26 A 케이스와 동일 시퀀스(이미 무장·가드·pass 검증됨) — 본 PR은 gate·owner·shallow cycle 로 end-to-end 잠금.
 * rel 은 스쿼트 깊이 프록시에 따라 ~0.06~0.08 대역(환경마다 소폭 변동 가능).
 */
const symptomUltraShallowAngles = [
  ...Array(8).fill(170),
  165, 155, 145, 130, 115, 100, 95, 93, 92,
  92, 93, 95, 100, 115, 130, 145, 160,
  ...Array(10).fill(170),
];

{
  const landmarks = toLandmarks(makeKneeAngleSeries(100, symptomUltraShallowAngles, 80));
  const gate = evaluateExerciseAutoProgress('squat', landmarks, squatStats(landmarks, 3200));
  const dbg = gate.squatCycleDebug;
  const cpr = dbg?.completionPassReason;
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics;
  const rel = typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : null;

  ok('gate.status === pass', gate.status === 'pass', { status: gate.status });
  ok('gate.completionSatisfied', gate.completionSatisfied === true, gate.completionSatisfied);
  ok('gate.finalPassEligible', gate.finalPassEligible === true, gate.finalPassEligible);
  ok('gate.finalPassBlockedReason == null', gate.finalPassBlockedReason == null, gate.finalPassBlockedReason);
  ok('isFinalPassLatched(squat)', isFinalPassLatched('squat', gate) === true, isFinalPassLatched('squat', gate));
  ok(
    'relativeDepthPeak shallow class (not deep standard)',
    rel != null && rel >= 0.03 && rel < 0.22,
    { rel }
  );
  ok(
    'completionPassReason shallow cycle (ultra or low)',
    cpr === 'ultra_low_rom_cycle' || cpr === 'low_rom_cycle',
    cpr
  );
  ok('not standard_cycle', cpr !== 'standard_cycle', cpr);
  ok('lineage owner is event truth', resolveSquatCompletionLineageOwner(cpr) === 'completion_truth_event', cpr);
  ok('evidenceLabel ultra_low_rom', dbg?.evidenceLabel === 'ultra_low_rom', dbg?.evidenceLabel);
  ok('eventCyclePromoted not required', dbg?.eventCyclePromoted !== true, dbg?.eventCyclePromoted);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
