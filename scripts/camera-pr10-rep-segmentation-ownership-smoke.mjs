/**
 * PR-10: Rep Segmentation & Current-Rep Ownership Re-lock smoke test
 *
 * 검증 대상:
 *   1. currentRepOwnershipClear gate (PR-10 신규)
 *      — squatReversalToStandingMs > 7500ms → current_rep_ownership_blocked
 *      — squatReversalToStandingMs <= 7500ms → 통과
 *      — squatReversalToStandingMs = undefined → gate bypass (conservative)
 *   2. 반복 얕은 집계 (repeated shallow aggregation) 차단
 *      — 3~4회 반복 후 slow rise (> 7500ms) → 차단
 *      — 엄청 많이 반복 후 slow rise (> 7500ms) → 차단
 *   3. legitimate slow rise (5-7초 이내 상승) → 허용
 *   4. Gold-path meaningful shallow success 반복 통과 유지
 *   5. PR-9 기존 게이트 회귀 없음
 *      — non_degenerate_commitment_blocked (delta=0)
 *      — weak_event_proof_substitution_blocked (eventless bridge-only)
 *   6. PR-8 기존 게이트 회귀 없음
 *      — rep_epoch_integrity_blocked
 *      — minimum_cycle_timing_blocked
 *      — timing_integrity_blocked
 *   7. deep standard / low_rom 회귀 없음
 *
 * npx tsx scripts/camera-pr10-rep-segmentation-ownership-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { deriveCanonicalShallowCompletionContract } = await import(
  '../src/lib/camera/squat/shallow-completion-contract.ts'
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

function assertFalsy(label, actual) {
  if (!actual) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected falsy, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(label, actual) {
  if (actual) {
    passed++;
    results.push(`  ✓ ${label}`);
  } else {
    failed++;
    results.push(`  ✗ ${label} — expected truthy, got ${JSON.stringify(actual)}`);
  }
}

function section(name) {
  results.push(`\n[${name}]`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Gold-path 기본 입력 (PR-10 current-rep ownership 포함 모든 게이트 통과)
// squatReversalToStandingMs = 3000ms (3초 상승 — 자연스러운 single rep)
// ──────────────────────────────────────────────────────────────────────────────
function makeGoldPath() {
  return {
    // A. current rep admission integrity
    relativeDepthPeak: 0.08,
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,

    // B. non-degenerate commitment (PR-9)
    downwardCommitmentDelta: 0.07,

    // C. timing integrity (PR-7/PR-8)
    completionBlockedReason: null,
    minimumCycleDurationSatisfied: true,

    // D. current-rep epoch integrity (PR-8)
    baselineFrozen: true,
    peakLatched: true,
    eventCycleHasFreezeOrLatchMissing: false,

    // E. reversal/recovery integrity
    ownerAuthoritativeReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    provenanceReversalEvidencePresent: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,

    // F. current-rep ownership (PR-10)
    squatReversalToStandingMs: 3000, // 3초 상승 — 단일 rep에서 자연스러운 속도

    // G. anti-contamination integrity
    setupMotionBlocked: false,
    peakLatchedAtIndex: 5,

    // event cycle — real descent detected
    eventCycleDetected: true,
    eventCycleHasDescentWeak: false,
    eventCycleDescentFrames: 5,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 1: currentRepOwnershipClear gate — 핵심 PR-10 게이트
// ──────────────────────────────────────────────────────────────────────────────
section('Section 1: currentRepOwnershipClear gate (PR-10 신규)');

// 1A: Gold path (squatReversalToStandingMs=3000ms < 7500ms) → satisfied
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1A: gold path (reversalToStanding=3000ms) → satisfied', result.satisfied, true);
  assert('1A: currentRepOwnershipClear=true', result.currentRepOwnershipClear, true);
  assertFalsy('1A: blockedReason=null', result.blockedReason);
}

// 1B: squatReversalToStandingMs=7501ms (1ms over limit) → current_rep_ownership_blocked
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 7501 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1B: reversalToStanding=7501ms → NOT satisfied', result.satisfied, false);
  assert('1B: currentRepOwnershipClear=false', result.currentRepOwnershipClear, false);
  assert('1B: blocked by current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
}

// 1C: squatReversalToStandingMs=7500ms (exactly at limit) → satisfied (limit inclusive)
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 7500 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1C: reversalToStanding=7500ms (boundary) → satisfied', result.satisfied, true);
  assert('1C: currentRepOwnershipClear=true at boundary', result.currentRepOwnershipClear, true);
}

// 1D: squatReversalToStandingMs=undefined → gate bypassed (conservative)
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: undefined };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1D: reversalToStanding=undefined → gate bypassed → satisfied', result.satisfied, true);
  assert('1D: currentRepOwnershipClear=true when undefined', result.currentRepOwnershipClear, true);
}

// 1E: squatReversalToStandingMs=0ms → passes (reversal and standing immediate — no laundering)
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 0 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1E: reversalToStanding=0ms → satisfied (no laundering)', result.satisfied, true);
  assert('1E: currentRepOwnershipClear=true for 0ms', result.currentRepOwnershipClear, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 2: Anti-laundering — 반복 얕은 집계 차단
// 3~4회 반복 후 slow rise 시나리오
// ──────────────────────────────────────────────────────────────────────────────
section('Section 2: Anti-laundering — 반복 얕은 집계 차단');

// 2A: 3회 반복 × 3초 + 느린 상승 3초 → reversal-to-standing ≈ 9000ms → 차단
{
  // 시나리오: attempt 1 reversal at t=3s, standing at t=12s
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 9000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2A: 3 repeats × 3s + slow rise (9000ms) → NOT satisfied', result.satisfied, false);
  assert('2A: current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
  assert('2A: currentRepOwnershipClear=false', result.currentRepOwnershipClear, false);
}

// 2B: 4회 반복 × 2.5초 + 느린 상승 → reversal-to-standing ≈ 8000ms → 차단
{
  // 시나리오: reversal at t=2.5s, standing at t=10.5s
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 8000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2B: 4 repeats (8000ms) → NOT satisfied', result.satisfied, false);
  assert('2B: current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
}

// 2C: 엄청 많이 반복 후 slow rise → reversal-to-standing ≈ 20000ms → 차단
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 20000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2C: many repeats (20000ms) → NOT satisfied', result.satisfied, false);
  assert('2C: current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
}

// 2D: stale reversal (15초 전) + 이제 서 있음 → 차단
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 15000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2D: stale reversal 15s before standing → NOT satisfied', result.satisfied, false);
  assert('2D: current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
}

// 2E: bridge/proof + stale reversal → 여전히 차단 (ownership이 bridge보다 우선)
{
  const input = {
    ...makeGoldPath(),
    squatReversalToStandingMs: 10000,
    officialShallowStreamBridgeApplied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2E: bridge+proof but stale reversal (10000ms) → NOT satisfied', result.satisfied, false);
  assert('2E: current_rep_ownership_blocked (not bridge pass)', result.blockedReason, 'current_rep_ownership_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 3: Legitimate slow rise — 느리지만 current-rep 내의 상승 허용
// ──────────────────────────────────────────────────────────────────────────────
section('Section 3: Legitimate slow rise — current-rep 내 허용');

// 3A: 느린 상승 4초 (4000ms) → 허용
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 4000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3A: slow rise 4s (4000ms) → satisfied', result.satisfied, true);
  assert('3A: currentRepOwnershipClear=true', result.currentRepOwnershipClear, true);
}

// 3B: 느린 상승 6초 (6000ms) → 허용
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 6000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3B: slow rise 6s (6000ms) → satisfied', result.satisfied, true);
  assert('3B: currentRepOwnershipClear=true', result.currentRepOwnershipClear, true);
}

// 3C: 매우 느린 상승 7.5초 (7500ms, 경계값) → 허용
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 7500 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3C: very slow rise 7.5s (7500ms, boundary) → satisfied', result.satisfied, true);
  assert('3C: currentRepOwnershipClear=true at boundary', result.currentRepOwnershipClear, true);
}

// 3D: 빠른 상승 300ms → 허용
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 300 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3D: fast rise 300ms → satisfied', result.satisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 4: Gold-path repeatability — 반복 가능한 good shallow success
// ──────────────────────────────────────────────────────────────────────────────
section('Section 4: Gold-path repeatability');

// 4A~4D: 동등 품질 shallow rep 반복 통과 (각각 독립된 single rep)
for (const [label, ms] of [['2000ms', 2000], ['3000ms', 3000], ['5000ms', 5000], ['7000ms', 7000]]) {
  const input = { ...makeGoldPath(), squatReversalToStandingMs: ms };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert(`4-${label}: gold path (reversalToStanding=${label}) → satisfied`, result.satisfied, true);
  assert(`4-${label}: currentRepOwnershipClear=true`, result.currentRepOwnershipClear, true);
}

// 4E: 여러 번 반복 호출 → 일관된 결과
{
  const input = makeGoldPath();
  let allPass = true;
  for (let i = 0; i < 5; i++) {
    const result = deriveCanonicalShallowCompletionContract({ ...input });
    if (!result.satisfied) allPass = false;
  }
  assert('4E: 5× gold path 반복 호출 → 일관되게 satisfied', allPass, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 5: PR-9 기존 게이트 회귀 없음
// ──────────────────────────────────────────────────────────────────────────────
section('Section 5: PR-9 게이트 회귀 없음');

// 5A: non_degenerate_commitment_blocked (delta=0) — PR-9 게이트 여전히 작동
{
  const input = { ...makeGoldPath(), downwardCommitmentDelta: 0 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5A: delta=0 → non_degenerate_commitment_blocked (PR-9 유지)', result.blockedReason, 'non_degenerate_commitment_blocked');
  assert('5A: nonDegenerateCommitmentClear=false', result.nonDegenerateCommitmentClear, false);
}

// 5B: weak_event_proof_substitution_blocked — PR-9 게이트 여전히 작동
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true, // bridge만 있음
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5B: eventless+descent_weak+bridge-only → weak_event_proof_substitution_blocked (PR-9 유지)',
    result.blockedReason, 'weak_event_proof_substitution_blocked');
}

// 5C: delta=0 + stale reversal → delta 게이트가 ownership보다 먼저 차단
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    squatReversalToStandingMs: 10000,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5C: delta=0 + stale reversal → non_degenerate_commitment_blocked (먼저 차단)', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 6: PR-8 기존 게이트 회귀 없음
// ──────────────────────────────────────────────────────────────────────────────
section('Section 6: PR-8 게이트 회귀 없음');

// 6A: rep_epoch_integrity_blocked (baselineFrozen=false) → 여전히 작동
{
  const input = { ...makeGoldPath(), baselineFrozen: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6A: baselineFrozen=false → rep_epoch_integrity_blocked (PR-8 유지)', result.blockedReason, 'rep_epoch_integrity_blocked');
  assert('6A: repEpochIntegrityClear=false', result.repEpochIntegrityClear, false);
}

// 6B: minimum_cycle_timing_blocked → 여전히 작동
{
  const input = { ...makeGoldPath(), minimumCycleDurationSatisfied: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6B: minimumCycleDurationSatisfied=false → minimum_cycle_timing_blocked (PR-8 유지)', result.blockedReason, 'minimum_cycle_timing_blocked');
  assert('6B: minimumCycleTimingClear=false', result.minimumCycleTimingClear, false);
}

// 6C: timing_integrity_blocked (descent_span_too_short) → 여전히 작동
{
  const input = { ...makeGoldPath(), completionBlockedReason: 'descent_span_too_short' };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6C: descent_span_too_short → timing_integrity_blocked (PR-7/PR-8 유지)', result.blockedReason, 'timing_integrity_blocked');
  assert('6C: timingIntegrityClear=false', result.timingIntegrityClear, false);
}

// 6D: not_armed 실제 시나리오 → baselineFrozen=false + peakLatched=false로 epoch 차단
// (not_armed 상태는 현실에서 항상 epoch integrity 부재를 동반한다)
{
  const input = {
    ...makeGoldPath(),
    completionBlockedReason: 'not_armed',
    baselineFrozen: false,    // not_armed 시 baseline 없음
    peakLatched: false,       // not_armed 시 peak latch 없음
    attemptStarted: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  // not_armed 체크가 epoch보다 먼저 실행되므로 not_armed로 차단
  assert('6D: not_armed 시나리오 (baselineFrozen=false) → not_armed', result.blockedReason, 'not_armed');
  assert('6D: satisfied=false', result.satisfied, false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 7: Deep standard 회귀 없음 (shallow zone 밖)
// ──────────────────────────────────────────────────────────────────────────────
section('Section 7: Deep standard 회귀 없음');

// 7A: deep standard (relativeDepthPeak=0.55) → not_in_shallow_zone (ownership gate 비관여)
{
  const input = { ...makeGoldPath(), relativeDepthPeak: 0.55 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('7A: deep standard → not_in_shallow_zone', result.blockedReason, 'not_in_shallow_zone');
  assert('7A: eligible=false', result.eligible, false);
  assert('7A: satisfied=false', result.satisfied, false);
}

// 7B: deep standard에 stale reversal-to-standing이 있어도 shallow 게이트 무관
{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.50,
    squatReversalToStandingMs: 20000, // 매우 큰 값
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('7B: deep standard zone → not_in_shallow_zone (ownership gate 비관여)', result.blockedReason, 'not_in_shallow_zone');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 8: 복합 위험 패턴 — 실기기 관찰 패턴 재현
// ──────────────────────────────────────────────────────────────────────────────
section('Section 8: 복합 위험 패턴 차단');

// 8A: stale reversal (8000ms) + rule confirmed reversal + all other gates pass → 차단
{
  const input = {
    ...makeGoldPath(),
    squatReversalToStandingMs: 8000,
    reversalConfirmedByRuleOrHmm: true, // rule reversal 있지만 stale
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8A: rule reversal + stale span (8000ms) → current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
}

// 8B: 모든 증거 완벽하지만 reversal이 9초 전 → 차단 (소유권 우선)
{
  const input = {
    ...makeGoldPath(),
    squatReversalToStandingMs: 9000,
    eventCycleDetected: true,
    eventCycleDescentFrames: 10,
    reversalConfirmedByRuleOrHmm: true,
    downwardCommitmentDelta: 0.09,
    officialShallowStreamBridgeApplied: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8B: all evidence strong + stale reversal (9000ms) → current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
  assert('8B: satisfied=false', result.satisfied, false);
}

// 8C: standing micro-motion (delta=0) — PR-9로 먼저 차단 (PR-10 도달 전)
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    squatReversalToStandingMs: 9000, // stale도 있지만
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  // delta=0 게이트가 먼저 차단해야 함
  assert('8C: standing micro-motion → non_degenerate_commitment_blocked (PR-9 먼저)', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// 8D: ownership 경계 직전 (7499ms) — 허용 (1ms 여유)
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 7499 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8D: 7499ms (1ms under limit) → satisfied', result.satisfied, true);
  assert('8D: currentRepOwnershipClear=true at 7499ms', result.currentRepOwnershipClear, true);
}

// 8E: ownership 경계 직후 (7502ms) — 차단
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 7502 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8E: 7502ms (2ms over limit) → current_rep_ownership_blocked', result.blockedReason, 'current_rep_ownership_blocked');
  assert('8E: satisfied=false', result.satisfied, false);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 9: contract 필드 무결성 확인
// ──────────────────────────────────────────────────────────────────────────────
section('Section 9: contract 필드 무결성');

// 9A: gold path → currentRepOwnershipClear 필드 존재 및 true
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('9A: currentRepOwnershipClear 필드 존재 (true)', result.currentRepOwnershipClear, true);
  assertTruthy('9A: trace에 repOwnership 포함', result.trace.includes('repOwnership='));
}

// 9B: blocked case → currentRepOwnershipClear=false + trace 포함
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 8000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('9B: currentRepOwnershipClear=false when blocked', result.currentRepOwnershipClear, false);
  assertTruthy('9B: trace에 repOwnership=0 포함', result.trace.includes('repOwnership=0'));
}

// 9C: ownership blocked → stage는 reversal_blocked
{
  const input = { ...makeGoldPath(), squatReversalToStandingMs: 9000 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('9C: ownership blocked → stage=reversal_blocked', result.stage, 'reversal_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
for (const line of results) {
  console.log(line);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`PR-10 smoke: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('PR-10 smoke FAILED');
  process.exit(1);
} else {
  console.log('PR-10 smoke PASSED');
}
