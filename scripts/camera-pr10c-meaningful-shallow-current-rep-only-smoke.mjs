/**
 * PR-10C: Meaningful Shallow Current-Rep-Only Pass Re-lock
 *
 * 검증 대상:
 *   A. official_shallow_cycle 경로 — gold-path 반복 통과 (repeatability)
 *      — currentSquatPhase = standing_recovered + timing 정상 → 통과
 *      — 다양한 reversal-to-standing span (200ms ~ 7500ms) → 반복 통과
 *
 *   B. official_shallow_cycle 경로 — terminal / standing / jitter / aggregation 차단
 *      — currentSquatPhase ≠ standing_recovered (non-standing) → standing_recovered_required
 *      — squatDescentToPeakMs null / < 200ms → shallow_descent_too_short
 *      — squatReversalToStandingMs null / < 200ms → shallow_reversal_to_standing_too_short
 *      — squatReversalToStandingMs > 7500ms → current_rep_ownership_blocked
 *
 *   C. 회귀 안전 — 기존 경로 비영향
 *      — low_rom_cycle gold path → null (PR-10C 미영향)
 *      — standard_cycle → null (deep standard 회귀 없음)
 *      — ultra_low_rom_cycle (policy=legitimate) → null
 *
 * npx tsx scripts/camera-pr10c-meaningful-shallow-current-rep-only-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { getShallowMeaningfulCycleBlockReason } = await import(
  '../src/lib/camera/evaluators/squat-meaningful-shallow.ts'
);

// ──────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNull(label, actual) {
  if (actual == null) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected null/undefined, got ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  results.push(`\n[${name}]`);
}

// ──────────────────────────────────────────────────────────────────────────────
// official_shallow_cycle gold-path factory
// 모든 evaluator-level gate 통과: standing_recovered + timing 정상
// ──────────────────────────────────────────────────────────────────────────────
function makeOfficialShallowGoldPath(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'official_shallow_cycle',
    completionBlockedReason: null,
    relativeDepthPeak: 0.15,
    currentSquatPhase: 'standing_recovered',
    squatDescentToPeakMs: 650,
    squatReversalToStandingMs: 2000,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// low_rom_cycle gold-path factory (회귀 확인용)
// ──────────────────────────────────────────────────────────────────────────────
function makeLowRomGoldPath(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    completionBlockedReason: null,
    relativeDepthPeak: 0.19,
    currentSquatPhase: 'standing_recovered',
    trajectoryReversalRescueApplied: false,
    eventCyclePromoted: false,
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 650,
    squatReversalToStandingMs: 2000,
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    rawDepthPeakPrimary: 0.19,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    squatEventCycle: {
      detected: true,
      band: 'low_rom',
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
    },
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Section A: official_shallow_cycle gold-path 반복 통과
// ──────────────────────────────────────────────────────────────────────────────
section('Section A: official_shallow_cycle gold-path repeatability');

// A1: gold path (기본 2000ms) → 통과
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath());
  assertNull('A1: official_shallow gold path (2000ms) → no block', reason);
}

// A2: 경계 하한 정확히 200ms → 통과 (inclusive)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 200, squatDescentToPeakMs: 200 })
  );
  assertNull('A2: reversalToStanding=200ms, descentToPeak=200ms (boundary) → no block', reason);
}

// A3: 경계 상한 정확히 7500ms → 통과 (inclusive)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 7500 })
  );
  assertNull('A3: reversalToStanding=7500ms (upper boundary) → no block', reason);
}

// A4: 다양한 timing span → 반복 통과 (repeatability spectrum)
const officialShallowSpans = [
  ['200ms', 200],
  ['300ms', 300],
  ['500ms', 500],
  ['800ms', 800],
  ['1000ms', 1000],
  ['1500ms', 1500],
  ['2000ms', 2000],
  ['3000ms', 3000],
  ['4000ms', 4000],
  ['5000ms', 5000],
  ['6000ms', 6000],
  ['7000ms', 7000],
  ['7500ms', 7500],
];

for (const [label, ms] of officialShallowSpans) {
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: ms })
  );
  assertNull(`A4-${label}: official_shallow gold path (span=${label}) → no block`, reason);
}

// A5: 동일 입력 5회 반복 → 일관된 결과 (deterministic)
{
  const input = makeOfficialShallowGoldPath({ squatReversalToStandingMs: 3000 });
  let allPass = true;
  for (let i = 0; i < 5; i++) {
    if (getShallowMeaningfulCycleBlockReason({ ...input }) !== null) allPass = false;
  }
  assert('A5: 5× gold path 반복 호출 → 일관된 null (deterministic)', allPass, true);
}

// A6: descent timing 다양 → 통과
const descentSpans = [
  ['200ms', 200],
  ['350ms', 350],
  ['650ms', 650],
  ['1000ms', 1000],
  ['2000ms', 2000],
];
for (const [label, ms] of descentSpans) {
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: ms })
  );
  assertNull(`A6-${label}: descentToPeak=${label} → no block`, reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section B: terminal / non-standing phase 차단
// terminal-adjacent finalization cannot create new pass ownership
// ──────────────────────────────────────────────────────────────────────────────
section('Section B: terminal / non-standing phase 차단 (official_shallow_cycle)');

// B1: phase = ascending (terminal-adjacent 상승 중) → blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'ascending' })
  );
  assert('B1: phase=ascending (terminal-adjacent) → standing_recovered_required', reason, 'standing_recovered_required');
}

// B2: phase = bottom_or_low_point (하강 중) → blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'bottom_or_low_point' })
  );
  assert('B2: phase=bottom_or_low_point → standing_recovered_required', reason, 'standing_recovered_required');
}

// B3: phase = descending_confirmed (하강 중) → blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'descending_confirmed' })
  );
  assert('B3: phase=descending_confirmed → standing_recovered_required', reason, 'standing_recovered_required');
}

// B4: phase = ascending_confirmed (상승 중) → blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'ascending_confirmed' })
  );
  assert('B4: phase=ascending_confirmed → standing_recovered_required', reason, 'standing_recovered_required');
}

// B5: phase = idle → blocked (terminal non-standing)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ currentSquatPhase: 'idle' })
  );
  assert('B5: phase=idle (terminal non-standing) → standing_recovered_required', reason, 'standing_recovered_required');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section C: descent timing lower bound 차단 (jitter / micro-motion)
// ──────────────────────────────────────────────────────────────────────────────
section('Section C: descent timing lower bound 차단 (official_shallow_cycle)');

// C1: squatDescentToPeakMs = null → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: null })
  );
  assert('C1: squatDescentToPeakMs=null → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// C2: squatDescentToPeakMs = undefined → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: undefined })
  );
  assert('C2: squatDescentToPeakMs=undefined → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// C3: squatDescentToPeakMs = 0 (즉각 하강) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 0 })
  );
  assert('C3: squatDescentToPeakMs=0 (instant jitter) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// C4: squatDescentToPeakMs = 50ms (jitter spike) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 50 })
  );
  assert('C4: squatDescentToPeakMs=50ms (jitter) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// C5: squatDescentToPeakMs = 100ms (micro-motion) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 100 })
  );
  assert('C5: squatDescentToPeakMs=100ms (micro-motion) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// C6: squatDescentToPeakMs = 199ms (경계 미달 1ms) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 199 })
  );
  assert('C6: squatDescentToPeakMs=199ms (1ms under floor) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section D: reversal-to-standing lower bound 차단 (jitter / micro-motion)
// ──────────────────────────────────────────────────────────────────────────────
section('Section D: reversal-to-standing lower bound 차단 (official_shallow_cycle)');

// D1: squatReversalToStandingMs = null → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: null })
  );
  assert('D1: squatReversalToStandingMs=null → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D2: squatReversalToStandingMs = undefined → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: undefined })
  );
  assert('D2: squatReversalToStandingMs=undefined → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D3: squatReversalToStandingMs = 0 → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 0 })
  );
  assert('D3: squatReversalToStandingMs=0 → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D4: squatReversalToStandingMs = 50ms (즉각 ascent) → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 50 })
  );
  assert('D4: squatReversalToStandingMs=50ms (instant ascent/jitter) → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D5: squatReversalToStandingMs = 100ms → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 100 })
  );
  assert('D5: squatReversalToStandingMs=100ms → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D6: squatReversalToStandingMs = 199ms (경계 미달 1ms) → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 199 })
  );
  assert('D6: squatReversalToStandingMs=199ms (1ms under floor) → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section E: current-rep ownership upper bound 차단
// terminal laundering / repeated shallow aggregation
// ──────────────────────────────────────────────────────────────────────────────
section('Section E: current-rep ownership upper bound 차단 (official_shallow_cycle)');

// E1: squatReversalToStandingMs = 7501ms (경계 초과 1ms) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 7501 })
  );
  assert('E1: reversalToStanding=7501ms (1ms over limit) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E2: terminal standing + stale reversal (8000ms) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 8000 })
  );
  assert('E2: terminal standing + stale reversal 8s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E3: terminal standing + 매우 오래된 reversal (20000ms) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 20000 })
  );
  assert('E3: terminal stale reversal 20s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E4: 3회 반복 후 slow rise (9000ms) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 9000 })
  );
  assert('E4: 3 repeats + slow rise 9s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E5: 5회 반복 + slow rise (12000ms) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 12000 })
  );
  assert('E5: 5 repeats + slow rise 12s → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E6: 경계 7499ms → 통과 (1ms 여유 — legitimate slow rise)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 7499 })
  );
  assertNull('E6: reversalToStanding=7499ms (1ms under limit) → no block (legitimate slow rise)', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section F: general movement / non-descent-ascent 차단
// standing micro-motion, posture drift → timing too short
// ──────────────────────────────────────────────────────────────────────────────
section('Section F: general movement / standing micro-motion 차단 (official_shallow_cycle)');

// F1: standing micro-motion — descent 30ms, reversal 40ms → 하한 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 30, squatReversalToStandingMs: 40 })
  );
  assert('F1: micro-motion (descent=30ms, reversal=40ms) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// F2: posture drift — descent 80ms → 하한 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 80, squatReversalToStandingMs: 300 })
  );
  assert('F2: posture drift (descent=80ms) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// F3: tiny dip → descent 10ms, reversal 10ms → 하한 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 10, squatReversalToStandingMs: 10 })
  );
  assert('F3: tiny dip (descent=10ms, reversal=10ms) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// F4: frame jitter spike — descent=0ms, reversal=5ms → 하한 차단
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatDescentToPeakMs: 0, squatReversalToStandingMs: 5 })
  );
  assert('F4: jitter spike (descent=0ms) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section G: proof-only / bridge-only 조합 — timing 충족 시 통과 유지
// bridge-assisted reversal이 있어도 timing+phase 충족하면 gold path로 인정
// (evaluator gate는 timing+phase만 검사 — bridge/rule 구분은 canonical contract 책임)
// ──────────────────────────────────────────────────────────────────────────────
section('Section G: bridge-assisted reversal + timing OK → 통과 유지 (official_shallow_cycle)');

// G1: bridge 보조 + timing 정상 → 통과 (evaluator gate는 bridge 구분 안 함)
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({
      squatDescentToPeakMs: 600,
      squatReversalToStandingMs: 2000,
      currentSquatPhase: 'standing_recovered',
    })
  );
  assertNull('G1: bridge-assisted reversal + timing OK → no block (canonical contract gated)', reason);
}

// G2: 모든 evaluator gate 통과 시 deterministic null (10회 반복)
{
  const input = makeOfficialShallowGoldPath({ squatReversalToStandingMs: 1500, squatDescentToPeakMs: 500 });
  let allNull = true;
  for (let i = 0; i < 10; i++) {
    if (getShallowMeaningfulCycleBlockReason({ ...input }) !== null) allNull = false;
  }
  assert('G2: 10× official_shallow gold path 반복 → 일관된 null', allNull, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section H: 회귀 안전 — low_rom_cycle 기존 경로 비영향
// ──────────────────────────────────────────────────────────────────────────────
section('Section H: 회귀 안전 — low_rom_cycle gold path (PR-10C 미영향)');

// H1: low_rom_cycle gold path → null (PR-10C 가 low_rom_cycle 건드리지 않음)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath());
  assertNull('H1: low_rom_cycle gold path → null (PR-10C 미영향)', reason);
}

// H2: low_rom_cycle + 다양한 span → 여전히 통과
const lowRomSpans = [200, 1000, 3000, 7500];
for (const ms of lowRomSpans) {
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: ms }));
  assertNull(`H2-${ms}ms: low_rom_cycle (span=${ms}ms) → null (PR-10C 미영향)`, reason);
}

// H3: low_rom_cycle + squatReversalToStandingMs > 7500ms → PR-10B 차단 유지
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({ squatReversalToStandingMs: 8000 }));
  assert('H3: low_rom_cycle (8000ms) → current_rep_ownership_blocked (PR-10B 유지)', reason, 'current_rep_ownership_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section I: 회귀 안전 — standard_cycle / ultra_low_rom_cycle 비영향
// ──────────────────────────────────────────────────────────────────────────────
section('Section I: 회귀 안전 — standard_cycle / ultra_low_rom_cycle');

// I1: standard_cycle → null (deep standard 회귀 없음)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    relativeDepthPeak: 0.55,
    squatReversalToStandingMs: 25000,
    squatDescentToPeakMs: 10,
    currentSquatPhase: 'idle',
  });
  assertNull('I1: standard_cycle (all failing shallow values) → null', reason);
}

// I2: standard_cycle + standing_recovered 아님 → null (gate 비관여)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    relativeDepthPeak: 0.60,
    currentSquatPhase: 'descending_confirmed',
    squatDescentToPeakMs: 5,
    squatReversalToStandingMs: null,
  });
  assertNull('I2: standard_cycle phase=descending → null (gate 비관여)', reason);
}

// I3: ultra_low_rom_cycle + policy legitimate → null
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
    squatReversalToStandingMs: 3000,
  });
  assertNull('I3: ultra_low_rom_cycle (policy=legitimate) → null (PR-10C 미영향)', reason);
}

// I4: official_shallow_cycle — 다른 pass reason들은 gate 비관여
{
  const nonShallowReasons = ['not_confirmed', 'event_cycle_promoted', 'low_rom_event_cycle'];
  for (const reason of nonShallowReasons) {
    const result = getShallowMeaningfulCycleBlockReason({
      completionPassReason: reason,
      completionSatisfied: false,
      relativeDepthPeak: 0.15,
      squatDescentToPeakMs: 5,
      squatReversalToStandingMs: null,
      currentSquatPhase: 'idle',
    });
    assertNull(`I4-${reason}: non-shallow reason → null (gate 비관여)`, result);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Section J: stale ownership / proof-only 종합 차단 시나리오
// ──────────────────────────────────────────────────────────────────────────────
section('Section J: stale ownership / repeated aggregation 종합 차단 (official_shallow_cycle)');

// J1: proof-only + stale reversal (> 7500ms) → ownership blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({
      squatReversalToStandingMs: 10000,
      squatDescentToPeakMs: 800,
    })
  );
  assert('J1: proof-only + stale reversal (10000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// J2: terminal standing + terminal late motion → phase gate + 가능 ownership gate
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({
      currentSquatPhase: 'ascending_confirmed',
      squatReversalToStandingMs: 9000,
    })
  );
  assert('J2: terminal ascending + stale reversal → standing_recovered_required (phase first)', reason, 'standing_recovered_required');
}

// J3: 연속 10번 동일 gold path 호출 → 모두 통과 (no state pollution)
{
  const inputs = Array.from({ length: 10 }, (_, i) =>
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 1000 + i * 200 })
  );
  let allPass = true;
  for (const input of inputs) {
    if (getShallowMeaningfulCycleBlockReason(input) !== null) allPass = false;
  }
  assert('J3: 10× consecutive gold paths (varied spans 1000-2800ms) → all null', allPass, true);
}

// J4: slow-rise laundering (accumulated reversal 15s) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(
    makeOfficialShallowGoldPath({ squatReversalToStandingMs: 15000 })
  );
  assert('J4: slow-rise laundering (15000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
console.log('\nPR-10C Meaningful Shallow Current-Rep-Only Smoke Tests');
console.log('='.repeat(60));
for (const line of results) console.log(line);
console.log('\n' + '='.repeat(60));
console.log(`Total: ${passed + failed}  ✓ ${passed}  ✗ ${failed}`);

if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('\n✅ All PR-10C tests passed');
}
