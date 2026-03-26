/**
 * PR-CAM-25 smoke test — squat easy-only final pass branch
 *
 * 검증 목표:
 * - low_rom_event_cycle / ultra_low_rom_event_cycle 완료 경로는 reduced confidence(0.56)로 final pass 가능.
 * - standard_cycle은 기존 0.62 임계를 그대로 사용 (regression 없음).
 * - captureQuality=invalid / phase 미완료 / latch 부족 시 easy-only도 차단됨.
 *
 * 실행:
 *   npx tsx scripts/camera-cam25-squat-easy-final-pass-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { isFinalPassLatched } = await import('../src/lib/camera/auto-progression.ts');

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

/**
 * 최소 gate mock 생성.
 * evaluatorResult.debug.squatCompletionState 만 채우고 나머지는 최소값.
 */
function makeSquatGate(opts) {
  return {
    completionSatisfied: opts.completionSatisfied ?? true,
    confidence: opts.confidence,
    passConfirmationSatisfied: opts.passConfirmationSatisfied ?? true,
    passConfirmationFrameCount: opts.passConfirmationFrameCount ?? 3,
    guardrail: {
      captureQuality: opts.captureQuality ?? 'ok',
      flags: [],
      retryRecommended: false,
      completionStatus: 'complete',
    },
    evaluatorResult: {
      debug: {
        squatCompletionState: opts.squatCompletionState ?? null,
      },
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// A. low_rom_event_cycle: easy-only branch 활성화 (confidence 0.58)
// ──────────────────────────────────────────────────────────────────
console.log('\nA. low_rom_event_cycle passes at 0.58 (below normal 0.62)');
{
  const gate = makeSquatGate({
    confidence: 0.58,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'A1: isFinalPassLatched = true (easy-only 0.56 ≤ 0.58)',
    isFinalPassLatched('squat', gate) === true,
    isFinalPassLatched('squat', gate)
  );
}

// ──────────────────────────────────────────────────────────────────
// B. ultra_low_rom_event_cycle: easy-only branch 활성화 (confidence 0.57)
// ──────────────────────────────────────────────────────────────────
console.log('\nB. ultra_low_rom_event_cycle passes at 0.57 (below normal 0.62)');
{
  const gate = makeSquatGate({
    confidence: 0.57,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'ultra_low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'B1: isFinalPassLatched = true (easy-only 0.56 ≤ 0.57)',
    isFinalPassLatched('squat', gate) === true,
    isFinalPassLatched('squat', gate)
  );
}

// ──────────────────────────────────────────────────────────────────
// C. easy-only branch 하한선 확인: 0.55는 차단
// ──────────────────────────────────────────────────────────────────
console.log('\nC. easy-only branch floor: 0.55 still blocked');
{
  const gate = makeSquatGate({
    confidence: 0.55,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'C1: isFinalPassLatched = false (0.55 < 0.56 easy floor)',
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );
}

// ──────────────────────────────────────────────────────────────────
// D. standard_cycle은 기존 0.62 임계 유지 — regression 확인
// ──────────────────────────────────────────────────────────────────
console.log('\nD. standard_cycle preserved: 0.58 blocked, 0.63 passes');
{
  const gateBelow = makeSquatGate({
    confidence: 0.58,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'D1: standard_cycle fails at 0.58 (needs 0.62)',
    isFinalPassLatched('squat', gateBelow) === false,
    isFinalPassLatched('squat', gateBelow)
  );

  const gateAbove = makeSquatGate({
    confidence: 0.63,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'standard_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'D2: standard_cycle passes at 0.63',
    isFinalPassLatched('squat', gateAbove) === true,
    isFinalPassLatched('squat', gateAbove)
  );
}

// ──────────────────────────────────────────────────────────────────
// E. captureQuality=invalid: easy-only도 차단
// ──────────────────────────────────────────────────────────────────
console.log('\nE. captureQuality=invalid blocks even easy-only');
{
  const gate = makeSquatGate({
    confidence: 0.58,
    captureQuality: 'invalid',
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'E1: isFinalPassLatched = false (captureQuality invalid)',
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );
}

// ──────────────────────────────────────────────────────────────────
// F. currentSquatPhase 미완료(ascending): easy branch 미활성화
// ──────────────────────────────────────────────────────────────────
console.log('\nF. phase != standing_recovered: easy branch not activated');
{
  const gate = makeSquatGate({
    confidence: 0.58,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'ascending', // standing_recovered 아님
    },
  });
  ok(
    'F1: ascending phase uses standard 0.62 floor → fails at 0.58',
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );
}

// ──────────────────────────────────────────────────────────────────
// G. latch 프레임 부족: easy-only(2프레임 필요) 에서 1프레임은 차단
// ──────────────────────────────────────────────────────────────────
console.log('\nG. passConfirmationFrameCount < 2 blocked in easy-only');
{
  const gate = makeSquatGate({
    confidence: 0.58,
    passConfirmationFrameCount: 1,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'G1: 1 stable frame fails (easy needs >= 2)',
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );

  const gate2 = makeSquatGate({
    confidence: 0.58,
    passConfirmationFrameCount: 2,
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'low_rom_event_cycle',
      currentSquatPhase: 'standing_recovered',
    },
  });
  ok(
    'G2: exactly 2 stable frames passes',
    isFinalPassLatched('squat', gate2) === true,
    isFinalPassLatched('squat', gate2)
  );
}

// ──────────────────────────────────────────────────────────────────
// H. completionSatisfied=false: easy-only도 차단
// ──────────────────────────────────────────────────────────────────
console.log('\nH. completionSatisfied=false blocked everywhere');
{
  const gate = makeSquatGate({
    completionSatisfied: false,
    confidence: 0.58,
    squatCompletionState: {
      completionSatisfied: false,
      completionPassReason: 'not_confirmed',
      currentSquatPhase: 'ascending',
    },
  });
  ok(
    'H1: completionSatisfied=false → isFinalPassLatched = false',
    isFinalPassLatched('squat', gate) === false,
    isFinalPassLatched('squat', gate)
  );
}

console.log(`\n━━━ PR-CAM-25 smoke: ${passed} passed, ${failed} failed ━━━`);
if (failed === 0) {
  console.log('✓ All acceptance criteria met');
} else {
  console.error('✗ Some tests failed');
}
