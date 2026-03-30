/**
 * PR-CAM-29C — 0.02~0.08 ultra-shallow 통합 end-to-end 검증
 *
 * 목적: 실제 knee-angle 시퀀스로 [0.02, 0.08) relativeDepthPeak 를 만들어
 *       완전한 사이클(down→up→recover) 이 pass 를 열고,
 *       중간 상태(descent-only / mid-ascent) 와 deep regression 을 동시 검증한다.
 *
 * npx tsx scripts/camera-cam29c-ultra-shallow-integration-smoke.mjs
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
  landmarks[11] = mockLandmark(0.42, shoulderY, 0.99);
  landmarks[12] = mockLandmark(0.58, shoulderY, 0.99);
  landmarks[23] = mockLandmark(0.44, hipY, 0.99);
  landmarks[24] = mockLandmark(0.56, hipY, 0.99);
  landmarks[25] = mockLandmark(0.45, kneeY, 0.99);
  landmarks[26] = mockLandmark(0.55, kneeY, 0.99);
  landmarks[27] = mockLandmark(0.45 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
  landmarks[28] = mockLandmark(0.55 + Math.sin(bendRad) * shinLen, kneeY + Math.cos(bendRad) * shinLen, 0.99);
  landmarks[0] = mockLandmark(0.5, 0.08 + depthT * 0.02, 0.99);
  return { landmarks, timestamp };
}

function makeKneeAngleSeries(startTs, values, stepMs) {
  return values.map((angle, i) =>
    squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, angle)
  );
}

function toLandmarks(seq) {
  return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp }));
}

function squatStats(len, stepMs) {
  return {
    sampledFrameCount: len,
    droppedFrameCount: 0,
    captureDurationMs: len * stepMs,
    timestampDiscontinuityCount: 0,
  };
}

/**
 * Ultra-shallow ROM: 170→~95→170
 * toSquatDepthProxy(95) ≈ 0.044 → relativeDepthPeak ≈ 0.04 ([0.02, 0.08) 밴드).
 * 긴 bottom-hold 로 minimumCycleDuration(1500 ms) 충족.
 * toSquatDepthProxy: logistic(angle, mid=75, scale=6.5)
 *   95 deg → 0.044, 90 deg → 0.091, 85 deg → 0.177
 */
const ULTRA_SHALLOW_DOWN_UP = [
  170, 168, 160, 148, 130, 115, 104, 97,
  ...Array(16).fill(95), // bottom hold → cycle duration 확보, depth ≈ 0.044
  97, 101, 110, 122, 137, 151, 162, 168, 170,
];

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── A. ultra-shallow full cycle (down→up→recover) → pass ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const stepMs = 120;
  const angles = [...Array(22).fill(170), ...ULTRA_SHALLOW_DOWN_UP, ...Array(28).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(5000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const cs = gate.evaluatorResult.debug?.squatCompletionState;

  ok(
    'A1: completionSatisfied true + not stuck on no_reversal',
    cs?.completionSatisfied === true && cs?.completionBlockedReason !== 'no_reversal',
    { csat: cs?.completionSatisfied, block: cs?.completionBlockedReason, relPeak: cs?.relativeDepthPeak }
  );
  ok('A2: gate status pass', gate.status === 'pass', {
    status: gate.status,
    relPeak: cs?.relativeDepthPeak,
    reason: cs?.completionPassReason,
  });
  ok('A3: isFinalPassLatched true', isFinalPassLatched('squat', gate) === true, {
    latch: isFinalPassLatched('squat', gate),
    blocked: gate.finalPassBlockedReason,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── B. descent only (no recovery tail) → no pass ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const stepMs = 100;
  // 95 degrees 까지 내려가지만 상승 tail 없음
  const angles = [...Array(18).fill(170), 165, 155, 140, 125, 110, 100, 96, 95, 94, 93];
  const lm = toLandmarks(makeKneeAngleSeries(20000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  ok('B1: descent-only → not pass', gate.status !== 'pass', gate.status);
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── C. mid-ascent — standing_recovered 전 → isFinalPassLatched false ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const stepMs = 100;
  // 95도까지 하강 후 절반만 상승(~120도), standing_recovered 도달 전 중단
  const angles = [
    ...Array(16).fill(170),
    160, 145, 130, 115, 100, 95,
    ...Array(8).fill(94),
    96, 102, 112, 124,
  ];
  const lm = toLandmarks(makeKneeAngleSeries(30000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  ok('C1: isFinalPassLatched false mid-ascent', isFinalPassLatched('squat', gate) === false, {
    latch: isFinalPassLatched('squat', gate),
    phase: gate.evaluatorResult.debug?.squatCompletionState?.currentSquatPhase,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── D. deep squat regression (0.08 이상 ROM) → 여전히 pass ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const stepMs = 120;
  const downUp = [
    170, 168, 160, 148, 132, 115, 100, 90, 86,
    ...Array(18).fill(85),
    86, 90, 100, 114, 130, 147, 160, 167, 170,
  ];
  const angles = [...Array(24).fill(170), ...downUp, ...Array(30).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(50000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  ok(
    'D1: deep ROM still passes (no regression)',
    gate.status === 'pass' &&
      cs?.completionSatisfied === true &&
      (cs?.rawDepthPeak ?? 0) > 0.12,
    {
      status: gate.status,
      rawPeak: cs?.rawDepthPeak,
      reason: cs?.completionPassReason,
    }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
console.log('\n── E. 0.08~0.12 shallow relax 구간 regression → pass 유지 ──');
// ──────────────────────────────────────────────────────────────────────────────
{
  const stepMs = 120;
  // 89도 bottom: toSquatDepthProxy(89) ≈ 0.107 → relativeDepthPeak ≈ 0.09~0.11
  const modDown = [
    170, 168, 158, 144, 128, 112, 98, 90, 89,
    ...Array(14).fill(89),
    90, 95, 104, 118, 134, 150, 163, 168, 170,
  ];
  const angles = [...Array(20).fill(170), ...modDown, ...Array(26).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(70000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  ok(
    'E1: 0.08~0.12 band still passes (no shallow relax regression)',
    cs?.completionSatisfied === true && cs?.completionBlockedReason !== 'no_reversal',
    { csat: cs?.completionSatisfied, block: cs?.completionBlockedReason, relPeak: cs?.relativeDepthPeak }
  );
}

console.log(`\n━━━ PR-CAM-29C ultra-shallow integration smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
