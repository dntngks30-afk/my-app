/**
 * PR-9: Meaningful Shallow Default-Pass Re-architecture smoke test
 *
 * 검증 대상:
 *   1. nonDegenerateCommitmentClear gate (PR-9 신규)
 *      — downwardCommitmentDelta=0 → non_degenerate_commitment_blocked
 *      — downwardCommitmentDelta>0 → 통과
 *      — downwardCommitmentDelta=undefined → bypass (conservative)
 *   2. weakEventProofSubstitutionBlocked gate (PR-9 강화)
 *      — eventCycle 없음 + descent_weak + bridge-only (reversalConfirmedByRuleOrHmm=false) → 차단
 *      — eventCycle 없음 + descent_weak + rule 확인 (reversalConfirmedByRuleOrHmm=true) → 허용
 *      — eventCycle 감지됨 → 게이트 우회
 *   3. Gold-path meaningful shallow success 반복 통과
 *   4. False-pass 가족 차단 확인
 *   5. PR-7/PR-8 기존 게이트 회귀 없음
 *   6. deep standard / low_rom 회귀 없음
 *
 * npx tsx scripts/camera-pr9-meaningful-shallow-default-pass-smoke.mjs
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
// Gold-path 기본 입력 (모든 게이트 통과 — PR-9 SSOT gold path A~G 충족)
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
    downwardCommitmentDelta: 0.07, // meaningful descent from pre-peak baseline

    // C. timing integrity (PR-7/PR-8)
    completionBlockedReason: null,
    minimumCycleDurationSatisfied: true,

    // D. current-rep epoch integrity (PR-8)
    baselineFrozen: true,
    peakLatched: true,
    eventCycleHasFreezeOrLatchMissing: false,

    // E. reversal/recovery integrity
    ownerAuthoritativeReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true, // PR-9: rule/HMM reversal confirmed
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    provenanceReversalEvidencePresent: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,

    // F. natural open timing — recovery present
    // (already covered by ownerAuthoritativeRecoverySatisfied above)

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
// Section 1: nonDegenerateCommitmentClear gate (PR-9 신규)
// ──────────────────────────────────────────────────────────────────────────────
section('Section 1: nonDegenerateCommitmentClear gate (PR-9)');

// 1A: Gold path (delta > 0) → satisfied
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1A: gold path (delta=0.07) → satisfied', result.satisfied, true);
  assert('1A: nonDegenerateCommitmentClear=true', result.nonDegenerateCommitmentClear, true);
}

// 1B: downwardCommitmentDelta=0 → blocked (standing at rest)
{
  const input = { ...makeGoldPath(), downwardCommitmentDelta: 0 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1B: delta=0 → NOT satisfied', result.satisfied, false);
  assert('1B: nonDegenerateCommitmentClear=false', result.nonDegenerateCommitmentClear, false);
  assert('1B: blocked by non_degenerate_commitment_blocked', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// 1C: downwardCommitmentDelta=undefined → gate bypassed (conservative)
{
  const input = { ...makeGoldPath(), downwardCommitmentDelta: undefined };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1C: delta=undefined → gate bypassed → satisfied', result.satisfied, true);
  assert('1C: nonDegenerateCommitmentClear=true (bypass)', result.nonDegenerateCommitmentClear, true);
}

// 1D: delta very small but > 0 → allowed (not literally zero)
{
  const input = { ...makeGoldPath(), downwardCommitmentDelta: 0.001 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1D: delta=0.001 (tiny but nonzero) → satisfied', result.satisfied, true);
  assert('1D: nonDegenerateCommitmentClear=true', result.nonDegenerateCommitmentClear, true);
}

// 1E: delta=0 blocks even when all other gates pass (no bridge exception)
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    // even with bridge applied, delta=0 must block
    officialShallowStreamBridgeApplied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1E: delta=0 + bridge → still blocked', result.satisfied, false);
  assert('1E: blocked by non_degenerate_commitment_blocked', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 2: weakEventProofSubstitutionBlocked gate (PR-9 강화)
// PR-8 original: ownerAuthoritativeReversalSatisfied !== true
// PR-9 tightened: reversalConfirmedByRuleOrHmm !== true
// ──────────────────────────────────────────────────────────────────────────────
section('Section 2: weakEventProofSubstitutionBlocked gate (PR-9 tightened)');

// 2A: eventCycle detected → weak-event gate does not fire
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: true,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false, // bridge only
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2A: eventCycleDetected=true → weak-event gate bypassed → satisfied', result.satisfied, true);
}

// 2B: eventCycle NOT detected + descent_weak + descentFrames=0 + rule reversal → ALLOWED
// (PR-9: reversalConfirmedByRuleOrHmm=true lets rule/HMM pass through even without event cycle)
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: true, // rule confirmed independently
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2B: eventCycle=false + descent_weak + rule confirmed → satisfied', result.satisfied, true);
}

// 2C: eventCycle NOT detected + descent_weak + descentFrames=0 + bridge ONLY → BLOCKED
// (PR-8 would have allowed this because ownerAuthoritativeReversalSatisfied=true via bridge)
// (PR-9 blocks it because reversalConfirmedByRuleOrHmm=false — bridge alone not enough)
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false, // bridge only — no rule/HMM
    ownerAuthoritativeReversalSatisfied: true, // bridge sets this to true
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2C: eventCycle=false + descent_weak + bridge-only → BLOCKED (PR-9)', result.satisfied, false);
  assert('2C: blocked by weak_event_proof_substitution_blocked', result.blockedReason, 'weak_event_proof_substitution_blocked');
}

// 2D: eventCycle NOT detected + descent_weak + descentFrames>0 → gate does NOT fire (descentFrames > 0)
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 2, // some frames
    reversalConfirmedByRuleOrHmm: false, // bridge only, but descentFrames > 0 so gate doesn't fire
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2D: eventCycle=false + descent_weak + descentFrames=2 → gate not fired → satisfied', result.satisfied, true);
}

// 2E: reversalConfirmedByRuleOrHmm=undefined → gate does NOT fire (bypass — conservative)
{
  const input = {
    ...makeGoldPath(),
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: undefined, // not set
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2E: reversalConfirmedByRuleOrHmm=undefined → gate bypassed → satisfied', result.satisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 3: Gold-path meaningful shallow success 반복 통과
// ──────────────────────────────────────────────────────────────────────────────
section('Section 3: Gold-path meaningful shallow success — repeatability');

// 3A: rep 1 — ultra low ROM gold path
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3A: rep1 gold path → satisfied', result.satisfied, true);
  assert('3A: nonDegenerateCommitmentClear=true', result.nonDegenerateCommitmentClear, true);
  assert('3A: repEpochIntegrityClear=true', result.repEpochIntegrityClear, true);
  assertTruthy('3A: closureWouldWriteOfficialShallowCycle', result.closureWouldWriteOfficialShallowCycle);
}

// 3B: rep 2 — same quality → also satisfied (repeatability)
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3B: rep2 same quality → satisfied', result.satisfied, true);
}

// 3C: gold path with rule-only reversal (no bridge needed)
{
  const input = {
    ...makeGoldPath(),
    officialShallowStreamBridgeApplied: false,
    reversalConfirmedByRuleOrHmm: true,
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3C: rule-only reversal → satisfied', result.satisfied, true);
}

// 3D: gold path with HMM assist reversal
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: true, // HMM counts as rule/HMM
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3D: HMM-assisted reversal → satisfied', result.satisfied, true);
}

// 3E: gold path with slightly deeper ultra-low (depth=0.12)
{
  const input = { ...makeGoldPath(), relativeDepthPeak: 0.12, downwardCommitmentDelta: 0.12 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3E: depth=0.12 ultra-low gold path → satisfied', result.satisfied, true);
}

// 3F: trace includes nonDegCommit field
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assertTruthy('3F: trace includes nonDegCommit', result.trace.includes('nonDegCommit='));
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 4: False-pass 가족 차단 — Standing micro-motion laundering
// ──────────────────────────────────────────────────────────────────────────────
section('Section 4: Standing micro-motion false-pass family (delta=0)');

// 4A: standing at rest (delta=0) — no movement but depth threshold satisfied
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    // person at standing depth, no actual descent
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4A: standing at rest (delta=0) → blocked', result.satisfied, false);
  assert('4A: non_degenerate_commitment_blocked', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// 4B: standing micro-motion (delta=0) + bridge-only → blocked
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4B: standing micro-motion + bridge → blocked', result.satisfied, false);
  assert('4B: non_degenerate_commitment_blocked (not bridge)', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// 4C: standing micro-motion + eventCycle=false + descent_weak + bridge-only
// Compound pattern: BOTH delta=0 AND weak-event conditions
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true, // bridge
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4C: compound micro-motion + weak-event + bridge → blocked', result.satisfied, false);
  // Delta=0 is checked before weak-event, so should be non_degenerate first
  assert('4C: first blocker is non_degenerate_commitment_blocked', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 5: False-pass 가족 — eventless weak-descent bridge-only close
// ──────────────────────────────────────────────────────────────────────────────
section('Section 5: Eventless weak-descent bridge-only false-pass family (PR-9 key fix)');

// 5A: real-device false pass pattern (PR-9 SSOT "반복 오탐의 공통 성향")
// eventCycleDetected=false, descentFrames=0, descent_weak + bridge-only reversal
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0.05, // some delta (not zero), so PR-9 delta gate passes
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false, // bridge only — key false pass condition
    ownerAuthoritativeReversalSatisfied: true, // bridge makes this true
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5A: real-device false pass pattern → BLOCKED by PR-9', result.satisfied, false);
  assert('5A: blocked by weak_event_proof_substitution_blocked', result.blockedReason, 'weak_event_proof_substitution_blocked');
}

// 5B: same pattern but with rule/HMM reversal → ALLOWED (real reversal confirmed)
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0.05,
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: true, // rule confirms reversal independently
    ownerAuthoritativeReversalSatisfied: true,
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5B: weak event but rule confirms reversal → satisfied', result.satisfied, true);
}

// 5C: second attempt — stale bridge signals still blocked (same false pass pattern)
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0.04,
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true, // bridge
    officialShallowStreamBridgeApplied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('5C: second attempt stale bridge-only → still blocked', result.satisfied, false);
  assert('5C: weak_event_proof_substitution_blocked', result.blockedReason, 'weak_event_proof_substitution_blocked');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 6: Existing PR-7 and PR-8 gates preserved (regression check)
// ──────────────────────────────────────────────────────────────────────────────
section('Section 6: PR-7 / PR-8 gates still preserved');

// 6A: timing integrity gate (descent_span_too_short)
{
  const input = { ...makeGoldPath(), completionBlockedReason: 'descent_span_too_short' };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6A: descent_span_too_short → timing_integrity_blocked', result.blockedReason, 'timing_integrity_blocked');
}

// 6B: timing integrity gate (ascent_recovery_span_too_short)
{
  const input = { ...makeGoldPath(), completionBlockedReason: 'ascent_recovery_span_too_short' };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6B: ascent_recovery_span_too_short → timing_integrity_blocked', result.blockedReason, 'timing_integrity_blocked');
}

// 6C: minimum cycle timing gate
{
  const input = { ...makeGoldPath(), minimumCycleDurationSatisfied: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6C: minimumCycleDurationSatisfied=false → minimum_cycle_timing_blocked', result.blockedReason, 'minimum_cycle_timing_blocked');
}

// 6D: rep epoch integrity gate (baselineFrozen=false)
{
  const input = { ...makeGoldPath(), baselineFrozen: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6D: baselineFrozen=false → rep_epoch_integrity_blocked', result.blockedReason, 'rep_epoch_integrity_blocked');
}

// 6E: rep epoch integrity gate (peakLatched=false)
{
  const input = { ...makeGoldPath(), peakLatched: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6E: peakLatched=false → rep_epoch_integrity_blocked', result.blockedReason, 'rep_epoch_integrity_blocked');
}

// 6F: freeze_or_latch_missing in event cycle → rep_epoch_integrity_blocked
{
  const input = { ...makeGoldPath(), eventCycleHasFreezeOrLatchMissing: true };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6F: freeze_or_latch_missing → rep_epoch_integrity_blocked', result.blockedReason, 'rep_epoch_integrity_blocked');
}

// 6G: not_armed → attempt_blocked
{
  const input = { ...makeGoldPath(), completionBlockedReason: 'not_armed', attemptStarted: false };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6G: not_armed → not_armed blocked', result.blockedReason, 'not_armed');
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 7: Deep standard / low_rom cycle — regression safety
// ──────────────────────────────────────────────────────────────────────────────
section('Section 7: Deep standard / low_rom regression safety');

// 7A: deep standard cycle (relativeDepthPeak >= 0.4 → not in shallow zone)
{
  const input = {
    relativeDepthPeak: 0.55,
    evidenceLabel: 'standard',
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.5,
    ownerAuthoritativeReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    provenanceReversalEvidencePresent: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    setupMotionBlocked: false,
    peakLatchedAtIndex: 5,
    completionBlockedReason: null,
    minimumCycleDurationSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    eventCycleDetected: true,
    eventCycleHasDescentWeak: false,
    eventCycleDescentFrames: 8,
    eventCycleHasFreezeOrLatchMissing: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  // Deep standard is outside shallow zone → not eligible → satisfied=false
  assert('7A: deep standard → not eligible (not_in_shallow_zone)', result.eligible, false);
  assert('7A: satisfied=false (correct — outside shallow zone)', result.satisfied, false);
  assert('7A: blocked by not_in_shallow_zone', result.blockedReason, 'not_in_shallow_zone');
}

// 7B: low_rom cycle (depth=0.2, in shallow zone) → should pass gold path
{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.2,
    evidenceLabel: 'low_rom',
    downwardCommitmentDelta: 0.18,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('7B: low_rom gold path → satisfied', result.satisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// Section 8: Compound dangerous patterns from real-device
// ──────────────────────────────────────────────────────────────────────────────
section('Section 8: Compound dangerous patterns (real-device observed)');

// 8A: Full compound false pass:
//   — delta=0, eventCycle=false, descent_weak, descentFrames=0, bridge-only
//   — pre-attempt contamination history (epoch gate already passed in base)
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0,
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8A: compound false pass → blocked', result.satisfied, false);
  // non_degenerate_commitment_blocked fires before weak-event gate
  assert('8A: first blocker is non_degenerate_commitment_blocked', result.blockedReason, 'non_degenerate_commitment_blocked');
}

// 8B: Delta slightly above 0 but bridge-only weak-event pattern
//   → PR-9 weak-event gate catches it
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0.002, // tiny but nonzero — delta gate passes
    eventCycleDetected: false,
    eventCycleHasDescentWeak: true,
    eventCycleDescentFrames: 0,
    reversalConfirmedByRuleOrHmm: false, // bridge only
    ownerAuthoritativeReversalSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8B: tiny delta + weak-event + bridge-only → blocked', result.satisfied, false);
  assert('8B: weak_event_proof_substitution_blocked', result.blockedReason, 'weak_event_proof_substitution_blocked');
}

// 8C: Meaningful attempt with rule reversal — this should PASS
{
  const input = {
    ...makeGoldPath(),
    downwardCommitmentDelta: 0.06,
    eventCycleDetected: true, // event cycle found it
    reversalConfirmedByRuleOrHmm: true, // rule confirmed
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8C: meaningful attempt + event cycle + rule → satisfied', result.satisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n=== PR-9 Meaningful Shallow Default-Pass Smoke Test ===\n');
for (const line of results) {
  console.log(line);
}
console.log(`\n총 ${passed + failed}개 테스트: ${passed}개 통과, ${failed}개 실패`);
if (failed > 0) {
  process.exit(1);
}
