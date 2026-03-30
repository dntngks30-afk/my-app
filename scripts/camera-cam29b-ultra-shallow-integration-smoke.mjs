/**
 * PR-CAM-29B — end-to-end shallow squat: completion + gate (integration)
 *
 * npx tsx scripts/camera-cam29b-ultra-shallow-integration-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  '../src/lib/camera/auto-progression.ts'
);

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
  const leftHipX = 0.44;
  const rightHipX = 0.56;
  const leftKneeX = 0.45;
  const rightKneeX = 0.55;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(leftHipX, hipY, 0.99);
  landmarks[24] = mockLandmark(rightHipX, hipY, 0.99);
  landmarks[25] = mockLandmark(leftKneeX, kneeY, 0.99);
  landmarks[26] = mockLandmark(rightKneeX, kneeY, 0.99);
  landmarks[27] = mockLandmark(leftKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[28] = mockLandmark(rightKneeX + ankleDx, kneeY + ankleDy, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}

function makeKneeAngleSeries(startTs, values, stepMs) {
  return values.map((angle, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle));
}

function toLandmarks(sequence) {
  return sequence.map((frame) => ({ landmarks: frame.landmarks, timestamp: frame.timestamp }));
}

function squatStats(len, stepMs) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * stepMs,
    timestampDiscontinuityCount: 0,
  };
}

/** 얕은 ROM + 긴 하단 홀드 — CAM-29A 스타일로 min cycle 충족 */
const SHALLOW_DOWN_UP = [
  170, 168, 160, 148, 130, 115, 105, 100, 98, 96,
  ...Array(16).fill(95),
  96, 100, 108, 120, 135, 150, 162, 168, 170,
];

console.log('\n── A. meaningful shallow down→up→recover → pass 가능 ──');
{
  const stepMs = 120;
  const angles = [...Array(22).fill(170), ...SHALLOW_DOWN_UP, ...Array(28).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(20_000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  ok(
    'A1: completion satisfied + not stuck on no_reversal',
    cs?.completionSatisfied === true && cs?.completionBlockedReason !== 'no_reversal',
    { csat: cs?.completionSatisfied, block: cs?.completionBlockedReason, reason: cs?.completionPassReason }
  );
  ok('A2: gate pass when chain satisfied', gate.status === 'pass', gate.status);
  ok('A3: final latch when timing ok', isFinalPassLatched('squat', gate) === true, isFinalPassLatched('squat', gate));
}

console.log('\n── B. descend only (no recovery tail) → no pass ──');
{
  const stepMs = 100;
  const angles = [...Array(18).fill(170), 170, 165, 150, 130, 115, 100, 95, 92, 90];
  const lm = toLandmarks(makeKneeAngleSeries(30_000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  ok('B1: not pass', gate.status !== 'pass', gate.status);
}

console.log('\n── C. ascend 도중만 (standing_recovered 전) → final latch false ──');
{
  const stepMs = 100;
  const angles = [...Array(16).fill(170), 160, 140, 120, 105, 100, 98, 100, 110, 125];
  const lm = toLandmarks(makeKneeAngleSeries(40_000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  ok('C1: isFinalPassLatched false mid-sequence', isFinalPassLatched('squat', gate) === false, {
    latch: isFinalPassLatched('squat', gate),
    phase: gate.evaluatorResult.debug?.squatCompletionState?.currentSquatPhase,
  });
}

console.log('\n── D. deep squat regression (긴 하단) ──');
{
  const stepMs = 120;
  const downUp = [
    170, 168, 162, 152, 140, 120, 100, 88, 85,
    ...Array(18).fill(86),
    85, 88, 96, 108, 122, 138, 153, 165, 170,
  ];
  const angles = [...Array(24).fill(170), ...downUp, ...Array(30).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(50_000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  ok(
    'D1: deep ROM still completes (pass)',
    gate.status === 'pass' &&
      cs?.completionSatisfied === true &&
      (cs?.rawDepthPeak ?? 0) > 0.12,
    {
      reason: cs?.completionPassReason,
      status: gate.status,
      rawPeak: cs?.rawDepthPeak,
    }
  );
}

console.log(`\n━━━ PR-CAM-29B integration smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
