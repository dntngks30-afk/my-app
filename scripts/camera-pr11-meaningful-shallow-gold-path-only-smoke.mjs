/**
 * PR-11: Meaningful Shallow Gold-Path-Only Re-lock
 *
 * 목표: ultra_low_rom_cycle에 evaluator-level gold-path 게이트를 추가하여
 * meaningul current-rep descent→ascent가 유일한 shallow 통과 경로가 되도록 수렴.
 *
 * 검증 대상:
 *
 *   A. ultra_low_rom_cycle gold-path 반복 통과 (repeatability)
 *      — policy=legitimate + standing_recovered + rule reversal + timing OK → null
 *      — 다양한 timing span에서 반복 통과
 *      — rule_plus_hmm reversal도 통과
 *
 *   B. ultra_low_rom_cycle — terminal/non-standing phase 차단
 *      — currentSquatPhase가 non-null이고 standing_recovered 아님 → standing_recovered_required
 *      — descending / bottom / ascending 등 전부 차단
 *
 *   C. ultra_low_rom_cycle — bridge/trajectory reversal 차단
 *      — reversalConfirmedBy = 'trajectory' → rule_based_reversal_required
 *      — reversalConfirmedBy = 'stream_bridge' (custom) → rule_based_reversal_required
 *
 *   D. ultra_low_rom_cycle — timing 하한 차단 (jitter / micro-motion)
 *      — squatDescentToPeakMs < 200ms → shallow_descent_too_short
 *      — squatReversalToStandingMs < 200ms → shallow_reversal_to_standing_too_short
 *
 *   E. ultra_low_rom_cycle — stale ownership / aggregation 차단
 *      — squatReversalToStandingMs > 7500ms → current_rep_ownership_blocked
 *      — 복합: terminal phase + stale ownership
 *
 *   F. ultra_low_rom_cycle — policy 미결정 시 기존 차단 동작 유지 (PR-6 회귀)
 *      — policy not ready → ultra_low_rom_not_allowed
 *      — policy blocked → ultra_low_rom_not_allowed
 *      — policy scope 없음 → ultra_low_rom_not_allowed
 *
 *   G. ultra_low_rom_cycle — backward compat: 필드 미설정 fixture는 bypass
 *      — PR-10B/10C 기존 fixture와 동일 패턴 → null (회귀 없음)
 *
 *   H. 회귀: official_shallow_cycle (PR-10C gates 유지)
 *      — gold path → null
 *      — phase 차단 → standing_recovered_required
 *      — descent 차단 → shallow_descent_too_short
 *      — ownership 차단 → current_rep_ownership_blocked
 *
 *   I. 회귀: low_rom_cycle gold-path → null (PR-11 미영향)
 *
 *   J. 회귀: standard_cycle → null (deep standard 회귀 없음)
 *
 *   K. 경로 수렴 확인 (path convergence)
 *      — ultra_low eventless (reversal=trajectory) → rule_based_reversal_required
 *      — ultra_low descent-phase pass → standing_recovered_required
 *      — ultra_low stale aggregation (9000ms) → current_rep_ownership_blocked
 *      — meaningful gold path → null (단일 통과 경로)
 *
 * npx tsx scripts/camera-pr11-meaningful-shallow-gold-path-only-smoke.mjs
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
// ultra_low_rom_cycle gold-path factory (PR-11 표준)
// 모든 evaluator-level gold-path gate 통과:
//   policy=legitimate + standing_recovered + rule reversal + timing 정상
// ──────────────────────────────────────────────────────────────────────────────
function makeUltraLowGoldPath(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'ultra_low_rom_cycle',
    completionBlockedReason: null,
    relativeDepthPeak: 0.04,
    evidenceLabel: 'ultra_low_rom',
    // policy gates (PR-6)
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
    // PR-11 gold-path fields
    currentSquatPhase: 'standing_recovered',
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 600,
    squatReversalToStandingMs: 2000,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// official_shallow_cycle gold-path factory (PR-10C 표준 — 회귀 확인용)
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
// Section A: ultra_low_rom_cycle gold-path 반복 통과
// ──────────────────────────────────────────────────────────────────────────────
section('Section A: ultra_low_rom_cycle gold-path 반복 통과 (PR-11)');

// A1: gold-path (rule reversal, 2000ms) → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath());
  assertNull('A1: ultra_low gold-path (rule, 2000ms) → null', reason);
}

// A2: rule_plus_hmm reversal → null (equally valid)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: 'rule_plus_hmm',
  }));
  assertNull('A2: ultra_low gold-path (rule_plus_hmm, 2000ms) → null', reason);
}

// A3: minimal timing boundary (200ms descent, 201ms reversal) → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 200,
    squatReversalToStandingMs: 201,
  }));
  assertNull('A3: ultra_low gold-path (minimal timing boundary) → null', reason);
}

// A4: 400ms descent, 1500ms reversal → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 400,
    squatReversalToStandingMs: 1500,
  }));
  assertNull('A4: ultra_low gold-path (400ms descent, 1500ms reversal) → null', reason);
}

// A5: 800ms descent, 3000ms reversal → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 800,
    squatReversalToStandingMs: 3000,
  }));
  assertNull('A5: ultra_low gold-path (800ms descent, 3000ms reversal) → null', reason);
}

// A6: max boundary reversal (7500ms) → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 7500,
  }));
  assertNull('A6: ultra_low gold-path (7500ms reversal — upper boundary) → null', reason);
}

// A7: 반복 10회 동등 품질 → 10회 전부 통과 (repeatability)
{
  const reps = [
    makeUltraLowGoldPath({ squatDescentToPeakMs: 550, squatReversalToStandingMs: 1800 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 600, squatReversalToStandingMs: 2000 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 620, squatReversalToStandingMs: 2200 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 580, squatReversalToStandingMs: 1900 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 650, squatReversalToStandingMs: 2400 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 500, squatReversalToStandingMs: 1700 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 700, squatReversalToStandingMs: 2600 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 450, squatReversalToStandingMs: 1600 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 750, squatReversalToStandingMs: 2800 }),
    makeUltraLowGoldPath({ squatDescentToPeakMs: 520, squatReversalToStandingMs: 2100 }),
  ];
  let repPassed = 0;
  for (const state of reps) {
    const reason = getShallowMeaningfulCycleBlockReason(state);
    if (reason == null) repPassed++;
  }
  assert('A7: 동등 품질 ultra_low rep 10회 반복 → 10회 전부 통과', repPassed, 10);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section B: ultra_low_rom_cycle — terminal / non-standing phase 차단
// ──────────────────────────────────────────────────────────────────────────────
section('Section B: ultra_low_rom_cycle terminal/non-standing phase 차단');

// B1: descending phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'descending',
  }));
  assert('B1: ultra_low descending phase → standing_recovered_required', reason, 'standing_recovered_required');
}

// B2: bottom_or_low_point phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'bottom_or_low_point',
  }));
  assert('B2: ultra_low bottom phase → standing_recovered_required', reason, 'standing_recovered_required');
}

// B3: ascending phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'ascending',
  }));
  assert('B3: ultra_low ascending phase → standing_recovered_required', reason, 'standing_recovered_required');
}

// B4: ascending_confirmed (near-top but not yet standing) → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'ascending_confirmed',
  }));
  assert('B4: ultra_low ascending_confirmed → standing_recovered_required', reason, 'standing_recovered_required');
}

// B5: capture_session_terminal 직전 standing_hold phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'standing_hold',
  }));
  assert('B5: ultra_low standing_hold (terminal-adjacent) → standing_recovered_required', reason, 'standing_recovered_required');
}

// B6: null currentSquatPhase (field not set) → bypass → check next gate
// (backward compat: null phase bypassed, reversal and timing gates next)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: null,
  }));
  assertNull('B6: ultra_low null phase (bypass) → gold-path gates remaining → null', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section C: ultra_low_rom_cycle — bridge/trajectory reversal 차단
// ──────────────────────────────────────────────────────────────────────────────
section('Section C: ultra_low_rom_cycle bridge/trajectory reversal 차단');

// C1: trajectory reversal → rule_based_reversal_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: 'trajectory',
  }));
  assert('C1: ultra_low trajectory reversal → rule_based_reversal_required', reason, 'rule_based_reversal_required');
}

// C2: unknown/custom reversal source ('stream_bridge') → rule_based_reversal_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: 'stream_bridge',
  }));
  assert('C2: ultra_low stream_bridge reversal → rule_based_reversal_required', reason, 'rule_based_reversal_required');
}

// C3: null reversalConfirmedBy (field not set) → bypass (conservative — core already enforces)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: null,
  }));
  assertNull('C3: ultra_low null reversalConfirmedBy → bypass → gold-path remaining → null', reason);
}

// C4: undefined reversalConfirmedBy (field absent) → bypass
{
  const { reversalConfirmedBy: _removed, ...stateWithoutField } = makeUltraLowGoldPath();
  const reason = getShallowMeaningfulCycleBlockReason(stateWithoutField);
  assertNull('C4: ultra_low undefined reversalConfirmedBy → bypass → gold-path remaining → null', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section D: ultra_low_rom_cycle — timing 하한 차단 (jitter / micro-motion)
// ──────────────────────────────────────────────────────────────────────────────
section('Section D: ultra_low_rom_cycle timing 하한 차단');

// D1: descent 0ms (eventless/instant) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 0,
  }));
  assert('D1: ultra_low descent 0ms → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// D2: descent 50ms (jitter) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 50,
  }));
  assert('D2: ultra_low descent 50ms (jitter) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// D3: descent 199ms (just below boundary) → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 199,
  }));
  assert('D3: ultra_low descent 199ms (just below) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// D4: reversal 0ms (instant ascent) → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 0,
  }));
  assert('D4: ultra_low reversal 0ms → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D5: reversal 100ms → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 100,
  }));
  assert('D5: ultra_low reversal 100ms → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D6: reversal 199ms (just below) → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 199,
  }));
  assert('D6: ultra_low reversal 199ms (just below) → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// D7: undefined squatDescentToPeakMs → bypass (conservative)
{
  const { squatDescentToPeakMs: _removed, ...stateWithoutDescent } = makeUltraLowGoldPath();
  const reason = getShallowMeaningfulCycleBlockReason(stateWithoutDescent);
  assertNull('D7: ultra_low undefined squatDescentToPeakMs → bypass', reason);
}

// D8: undefined squatReversalToStandingMs → bypass (conservative)
{
  const { squatReversalToStandingMs: _removed, ...stateWithoutReversal } = makeUltraLowGoldPath();
  const reason = getShallowMeaningfulCycleBlockReason(stateWithoutReversal);
  assertNull('D8: ultra_low undefined squatReversalToStandingMs → bypass', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section E: ultra_low_rom_cycle — stale ownership / aggregation 차단
// ──────────────────────────────────────────────────────────────────────────────
section('Section E: ultra_low_rom_cycle stale ownership / aggregation 차단');

// E1: 7501ms (just above) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 7501,
  }));
  assert('E1: ultra_low 7501ms reversal (just above) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E2: 9000ms (stale aggregation) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 9000,
  }));
  assert('E2: ultra_low 9000ms (stale aggregation) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E3: 15000ms (repeated shallow + late standing) → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 15000,
  }));
  assert('E3: ultra_low 15000ms (repeated shallow + late standing) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// E4: terminal-adjacent + stale ownership (non-standing phase + large span)
// → phase gate fires first → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'ascending_confirmed',
    squatReversalToStandingMs: 12000,
  }));
  assert('E4: ultra_low terminal-adjacent + stale ownership → standing_recovered_required (phase first)', reason, 'standing_recovered_required');
}

// E5: slow-rise laundering: rule reversal but very large span
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: 'rule',
    squatReversalToStandingMs: 10000,
  }));
  assert('E5: ultra_low slow-rise laundering (10000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section F: ultra_low_rom_cycle — policy 미결정/차단 시 기존 동작 유지 (PR-6 회귀)
// ──────────────────────────────────────────────────────────────────────────────
section('Section F: ultra_low_rom_cycle policy 미결정/차단 시 ultra_low_rom_not_allowed (PR-6 회귀)');

// F1: policy not ready (decisionReady=false)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    ultraLowPolicyDecisionReady: false,
  }));
  assert('F1: ultra_low policy not ready → ultra_low_rom_not_allowed', reason, 'ultra_low_rom_not_allowed');
}

// F2: policy blocked (policyBlocked=true)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    ultraLowPolicyBlocked: true,
  }));
  assert('F2: ultra_low policy blocked → ultra_low_rom_not_allowed', reason, 'ultra_low_rom_not_allowed');
}

// F3: policy scope 없음 (scope=false)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    ultraLowPolicyScope: false,
  }));
  assert('F3: ultra_low policy scope=false → ultra_low_rom_not_allowed', reason, 'ultra_low_rom_not_allowed');
}

// F4: policy all undefined (scope/ready 미설정) → ultra_low_rom_not_allowed
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.04,
    currentSquatPhase: 'standing_recovered',
    reversalConfirmedBy: 'rule',
    squatDescentToPeakMs: 600,
    squatReversalToStandingMs: 2000,
    // no policy fields
  });
  assert('F4: ultra_low no policy fields → ultra_low_rom_not_allowed', reason, 'ultra_low_rom_not_allowed');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section G: backward compat — 기존 PR-10B/10C 스타일 fixture는 bypass 유지
// ──────────────────────────────────────────────────────────────────────────────
section('Section G: backward compat — PR-10B/10C 기존 fixture 패턴 → null (회귀 없음)');

// G1: PR-10B 8A fixture (필드 없이 squatReversalToStandingMs=3000) → null
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
    // currentSquatPhase, reversalConfirmedBy, squatDescentToPeakMs 미설정 → bypass
  });
  assertNull('G1: PR-10B 8A fixture (필드 미설정 bypass) → null', reason);
}

// G2: PR-10C I3 fixture (필드 없이 squatReversalToStandingMs=3000) → null
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
  assertNull('G2: PR-10C I3 fixture (필드 미설정 bypass) → null', reason);
}

// G3: PR-6 B-1 style (policy=legitimate, gold-path fields 없음) → null
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'ultra_low_rom_cycle',
    completionSatisfied: true,
    evidenceLabel: 'ultra_low_rom',
    ultraLowPolicyScope: true,
    ultraLowPolicyDecisionReady: true,
    ultraLowPolicyBlocked: false,
  });
  assertNull('G3: PR-6 B-1 style (policy=legitimate, minimal fields) → null', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section H: 회귀 — official_shallow_cycle (PR-10C gates 유지)
// ──────────────────────────────────────────────────────────────────────────────
section('Section H: 회귀 — official_shallow_cycle (PR-10C gates 유지)');

// H1: gold-path → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath());
  assertNull('H1: official_shallow gold-path → null (PR-10C 유지)', reason);
}

// H2: non-standing phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath({
    currentSquatPhase: 'ascending',
  }));
  assert('H2: official_shallow ascending → standing_recovered_required', reason, 'standing_recovered_required');
}

// H3: descent too short → shallow_descent_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath({
    squatDescentToPeakMs: 50,
  }));
  assert('H3: official_shallow descent 50ms → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// H4: reversal too short → shallow_reversal_to_standing_too_short
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath({
    squatReversalToStandingMs: 100,
  }));
  assert('H4: official_shallow reversal 100ms → shallow_reversal_to_standing_too_short', reason, 'shallow_reversal_to_standing_too_short');
}

// H5: stale ownership → current_rep_ownership_blocked
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath({
    squatReversalToStandingMs: 9000,
  }));
  assert('H5: official_shallow 9000ms → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// H6: null descent → shallow_descent_too_short (PR-10C strict null check 유지)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath({
    squatDescentToPeakMs: null,
  }));
  assert('H6: official_shallow null descent → shallow_descent_too_short (PR-10C strict)', reason, 'shallow_descent_too_short');
}

// H7: 반복 통과 — 다양한 span에서 PR-10C gates 통과 유지
{
  const spans = [
    { squatDescentToPeakMs: 500, squatReversalToStandingMs: 1500 },
    { squatDescentToPeakMs: 700, squatReversalToStandingMs: 2500 },
    { squatDescentToPeakMs: 350, squatReversalToStandingMs: 4000 },
    { squatDescentToPeakMs: 900, squatReversalToStandingMs: 6000 },
  ];
  let repPassed = 0;
  for (const s of spans) {
    const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath(s));
    if (reason == null) repPassed++;
  }
  assert('H7: official_shallow 다양한 span 반복 → 4회 전부 통과', repPassed, 4);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section I: 회귀 — low_rom_cycle gold-path → null (PR-11 미영향)
// ──────────────────────────────────────────────────────────────────────────────
section('Section I: 회귀 — low_rom_cycle gold-path (PR-11 미영향)');

// I1: low_rom gold-path → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath());
  assertNull('I1: low_rom gold-path → null (PR-11 미영향)', reason);
}

// I2: low_rom rule_plus_hmm → null
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath({
    reversalConfirmedBy: 'rule_plus_hmm',
  }));
  assertNull('I2: low_rom rule_plus_hmm → null', reason);
}

// I3: low_rom 반복 통과 (다양한 span)
{
  const spans = [
    { squatDescentToPeakMs: 400, squatReversalToStandingMs: 1200 },
    { squatDescentToPeakMs: 700, squatReversalToStandingMs: 3000 },
    { squatDescentToPeakMs: 900, squatReversalToStandingMs: 5000 },
  ];
  let repPassed = 0;
  for (const s of spans) {
    const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath(s));
    if (reason == null) repPassed++;
  }
  assert('I3: low_rom 반복 통과 (3회) → 3회 전부 통과', repPassed, 3);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section J: 회귀 — standard_cycle → null (deep standard 회귀 없음)
// ──────────────────────────────────────────────────────────────────────────────
section('Section J: 회귀 — standard_cycle (deep standard 회귀 없음)');

// J1: standard_cycle → null (gate 비관여)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.55,
    currentSquatPhase: 'standing_recovered',
    squatDescentToPeakMs: 800,
    squatReversalToStandingMs: 3000,
  });
  assertNull('J1: standard_cycle → null (gate 비관여)', reason);
}

// J2: standard_cycle phase=descending → null (gate 비관여)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'standard_cycle',
    completionSatisfied: true,
    relativeDepthPeak: 0.55,
    currentSquatPhase: 'descending',
  });
  assertNull('J2: standard_cycle descending → null (gate 비관여)', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section K: 경로 수렴 확인 (path convergence)
// ──────────────────────────────────────────────────────────────────────────────
section('Section K: 경로 수렴 — direct ultra-low / terminal / stale 경로 전부 차단');

// K1: direct eventless ultra_low (trajectory reversal) → rule_based_reversal_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    reversalConfirmedBy: 'trajectory',
    squatDescentToPeakMs: 30,  // eventless descent
  }));
  // phase gate passes (standing_recovered), reversal gate fires first
  assert('K1: direct eventless ultra_low (trajectory) → rule_based_reversal_required', reason, 'rule_based_reversal_required');
}

// K2: ultra_low during descent phase → standing_recovered_required
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    currentSquatPhase: 'descending',
    squatDescentToPeakMs: 150,  // brief descent
    squatReversalToStandingMs: 500,
  }));
  assert('K2: ultra_low descent-phase pass → standing_recovered_required', reason, 'standing_recovered_required');
}

// K3: ultra_low stale aggregation (many failed reps + late standing)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatReversalToStandingMs: 12000,  // stale aggregation
  }));
  assert('K3: ultra_low stale aggregation (12000ms) → current_rep_ownership_blocked', reason, 'current_rep_ownership_blocked');
}

// K4: ultra_low proof-only (jitter descent, instant ascent)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 30,   // jitter descent
    squatReversalToStandingMs: 80,  // instant ascent
  }));
  // descent gate fires first
  assert('K4: ultra_low proof-only (jitter) → shallow_descent_too_short', reason, 'shallow_descent_too_short');
}

// K5: meaningful gold-path ultra_low → null (단일 통과 경로 확인)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeUltraLowGoldPath({
    squatDescentToPeakMs: 600,
    squatReversalToStandingMs: 2200,
    reversalConfirmedBy: 'rule',
    currentSquatPhase: 'standing_recovered',
  }));
  assertNull('K5: meaningful ultra_low gold-path → null (단일 통과 경로)', reason);
}

// K6: meaningful official_shallow → null (단일 통과 경로 확인)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeOfficialShallowGoldPath());
  assertNull('K6: meaningful official_shallow → null (단일 통과 경로)', reason);
}

// K7: meaningful low_rom → null (단일 통과 경로 확인)
{
  const reason = getShallowMeaningfulCycleBlockReason(makeLowRomGoldPath());
  assertNull('K7: meaningful low_rom gold-path → null (단일 통과 경로)', reason);
}

// K8: non-gold-path (not_confirmed) → null (gate 비관여, 다른 경로에서 이미 차단됨)
{
  const reason = getShallowMeaningfulCycleBlockReason({
    completionPassReason: 'not_confirmed',
    completionSatisfied: false,
  });
  assertNull('K8: not_confirmed → null (gate 비관여)', reason);
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n=== PR-11: Meaningful Shallow Gold-Path-Only Smoke Test ===\n');
for (const line of results) {
  console.log(line);
}
console.log(`\n총 ${passed + failed}개 — ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
