/**
 * PR-CAM-29A — minimumCycleDurationSatisfied 미충족 시 final pass / progression 정렬
 *
 * npx tsx scripts/camera-cam29a-squat-final-pass-timing-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');

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

const BLOCK = 'minimum_cycle_duration_not_met';

/** 짧은 하단 홀드: 깊은 ROM → standard_cycle, min cycle 미달 (현장 JSON 유사) */
const DOWN_UP_DEEP_SHORT = [
  170, 165, 155, 140, 118, 98, 82, 72, 68,
  68, 70,
  72, 85, 100, 118, 138, 155, 165, 170,
];
/** 짧은 하단 홀드: 상대 얕은 ROM → low_rom* 경로, min cycle 미달 */
const DOWN_UP_LOW_SHORT = [
  170, 168, 162, 152, 140, 120, 100, 88, 85,
  85, 88,
  88, 96, 108, 122, 138, 153, 165, 170,
];

console.log('\n── A. standard_cycle + min cycle 미달 — final pass / progression 정렬 ──');
{
  /**
   * PR-CAM-29A: `minimumCycleDurationSatisfied` 는 descend→standing 구간(cycleDurationMs)이고,
   * UI 래치의 `captureArmingSatisfied` 는 전체 `captureDurationMs` 이다.
   * 짧은 사이클이면서도 전체 캡처가 SQUAT_ARMING_MS 이상이면 progression 이 열리므로,
   * 타이밍 차단을 검증하려면 (len * stepMs) < 1500ms 가 되게 패딩을 줄인다.
   */
  const stepMs = 42;
  const angles = [...Array(8).fill(170), ...DOWN_UP_DEEP_SHORT, ...Array(8).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(5000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const sc = gate.squatCycleDebug;
  const cs = gate.evaluatorResult.debug?.squatCompletionState;

  ok(
    'A0: fixture — guard complete + completion + min cycle false + standard_cycle',
    gate.guardrail.completionStatus === 'complete' &&
      cs?.completionSatisfied === true &&
      sc?.minimumCycleDurationSatisfied === false &&
      sc?.captureArmingSatisfied === false &&
      cs?.completionPassReason === 'standard_cycle',
    {
      guard: gate.guardrail.completionStatus,
      csat: cs?.completionSatisfied,
      minOk: sc?.minimumCycleDurationSatisfied,
      capArm: sc?.captureArmingSatisfied,
      cyc: sc?.cycleDurationMs,
      reason: cs?.completionPassReason,
    }
  );
  ok('A1: progressionPassed false', gate.status !== 'pass', gate.status);
  ok('A2: finalPassEligible false', gate.finalPassEligible === false, gate.finalPassEligible);
  ok('A3: finalPassBlockedReason timing', gate.finalPassBlockedReason === BLOCK, gate.finalPassBlockedReason);
  ok('A4: isFinalPassLatched false', isFinalPassLatched('squat', gate) === false, isFinalPassLatched('squat', gate));
  ok('A5: trace finalPassTimingBlockedReason', sc?.finalPassTimingBlockedReason === BLOCK, sc);
}

console.log('\n── A2. low_rom* + min cycle 미달 — 동일 타이밍 게이트 ──');
{
  const stepMs = 42;
  const angles = [...Array(8).fill(170), ...DOWN_UP_LOW_SHORT, ...Array(8).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(6000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const sc = gate.squatCycleDebug;
  const cs = gate.evaluatorResult.debug?.squatCompletionState;
  const reason = cs?.completionPassReason ?? '';

  ok(
    'A2-0: fixture — low_rom 계열 + min cycle false',
    gate.guardrail.completionStatus === 'complete' &&
      cs?.completionSatisfied === true &&
      sc?.minimumCycleDurationSatisfied === false &&
      sc?.captureArmingSatisfied === false &&
      (reason === 'low_rom_cycle' || reason === 'low_rom_event_cycle'),
    { reason, cyc: sc?.cycleDurationMs, minOk: sc?.minimumCycleDurationSatisfied }
  );
  ok('A2-1: progressionPassed false', gate.status !== 'pass', gate.status);
  ok('A2-2: isFinalPassLatched false', isFinalPassLatched('squat', gate) === false, isFinalPassLatched('squat', gate));
}

console.log('\n── B. 저속 깊은 사이클 — descend→standing_recovered 구간이 SQUAT_ARMING_MS 이상이면 pass 유지 ──');
{
  /**
   * cycleDurationMs = standingRecoveredAtMs − descendStartAtMs (completion-state).
   * 짧은 하강·복귀만 있으면 5프레임×stepMs 수준으로 끊길 수 있어, 하단 유지 프레임을 넉넉히 넣는다.
   */
  const stepMs = 120;
  const downUp = [
    170, 168, 162, 152, 140, 120, 100, 88, 85,
    ...Array(18).fill(86),
    85, 88, 96, 108, 122, 138, 153, 165, 170,
  ];
  const angles = [...Array(24).fill(170), ...downUp, ...Array(30).fill(170)];
  const lm = toLandmarks(makeKneeAngleSeries(10_000, angles, stepMs));
  const gate = evaluateExerciseAutoProgress('squat', lm, squatStats(lm.length, stepMs));
  const sc = gate.squatCycleDebug;
  ok('B1: minimumCycleDurationSatisfied', sc?.minimumCycleDurationSatisfied === true, {
    cyc: sc?.cycleDurationMs,
    minOk: sc?.minimumCycleDurationSatisfied,
  });
  ok('B2: status pass when chain satisfied', gate.status === 'pass', gate.status);
  ok('B3: finalPassEligible', gate.finalPassEligible === true, gate.finalPassEligible);
  ok('B4: isFinalPassLatched', isFinalPassLatched('squat', gate) === true, isFinalPassLatched('squat', gate));
}

console.log('\n── C. standard_cycle 짧은 cs 전용 mock — latch 금지 ──');
{
  const gate = {
    completionSatisfied: true,
    confidence: 0.72,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    squatCycleDebug: { minimumCycleDurationSatisfied: false },
    guardrail: { captureQuality: 'ok', flags: [], retryRecommended: false, completionStatus: 'complete' },
    evaluatorResult: {
      debug: {
        squatCompletionState: {
          completionSatisfied: true,
          completionPassReason: 'standard_cycle',
          currentSquatPhase: 'standing_recovered',
          cycleDurationMs: 900,
        },
      },
    },
  };
  ok('C1: isFinalPassLatched false', isFinalPassLatched('squat', gate) === false, isFinalPassLatched('squat', gate));
}

console.log(`\n━━━ PR-CAM-29A timing smoke: ${passed} passed, ${failed} failed ━━━`);
process.exit(failed > 0 ? 1 : 0);
