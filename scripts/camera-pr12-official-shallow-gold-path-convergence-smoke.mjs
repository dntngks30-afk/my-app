/**
 * PR-12: Official Shallow Gold-Path Convergence smoke test
 *
 * 검증 대상:
 *   reversalEvidenceFromInput() tightening — gold-path only (rule/HMM):
 *     - bridge-only (reversalConfirmedByRuleOrHmm=false) → authoritative_reversal_missing
 *     - proof-only (officialShallowClosureProofSatisfied=true, no rule/HMM) → blocked
 *     - guarded-trajectory-only (no rule/HMM) → blocked
 *     - gold-path (reversalConfirmedByRuleOrHmm=true) → passes
 *   Backward-compat:
 *     - reversalConfirmedByRuleOrHmm=undefined + ownerAuthoritativeReversalSatisfied=true → passes
 *   Single-writer preserved:
 *     - only applyCanonicalShallowClosureFromContract can write official_shallow_cycle
 *   Regression guards:
 *     - standard_cycle path unaffected
 *     - ultra_low policy path unaffected
 *     - no split-brain
 *
 * npx tsx scripts/camera-pr12-official-shallow-gold-path-convergence-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { deriveCanonicalShallowCompletionContract } = await import(
  '../src/lib/camera/squat/shallow-completion-contract.ts'
);

// ──────────────────────────────────────────────────────────────────────────────
// Test harness
// ──────────────────────────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    results.push(`  ✓ ${label}`);
    passed++;
  } else {
    results.push(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(name) {
  results.push(`\n[${name}]`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Gold-path base fixture — all gates clear, rule/HMM reversal confirmed
// ──────────────────────────────────────────────────────────────────────────────
function makeGoldPath() {
  return {
    relativeDepthPeak: 0.12,
    evidenceLabel: 'official_shallow',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.08,
    // PR-12 gold-path: rule/HMM confirmed, bridge support-only
    ownerAuthoritativeReversalSatisfied: true,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    guardedShallowTrajectoryClosureProofSatisfied: false,
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
    eventCycleDescentFrames: 4,
    squatReversalToStandingMs: 1200,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 1 — bridge-only official shallow must fail
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 1: bridge-only reversal must not authorize official_shallow_cycle');

// 1-A: bridge=true, proof=true, reversalConfirmedByRuleOrHmm=false → blocked
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false, // bridge-only, no rule/HMM
    ownerAuthoritativeReversalSatisfied: true, // includes bridge → still true
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1A: bridge-only (reversalConfirmedByRuleOrHmm=false) → NOT satisfied', result.satisfied, false);
  assert('1A: blocked by authoritative_reversal_missing', result.blockedReason, 'authoritative_reversal_missing');
}

// 1-B: bridge=true, NO other signals, reversalConfirmedByRuleOrHmm=false → blocked
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('1B: bridge alone (reversalConfirmedByRuleOrHmm=false) → NOT satisfied', result.satisfied, false);
  assert('1B: blocked at reversal', result.blockedReason, 'authoritative_reversal_missing');
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 2 — closure-proof-only must fail
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 2: closure-proof-only must not authorize official_shallow_cycle');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: true, // proof-only
    officialShallowPrimaryDropClosureFallback: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('2A: proof-only (reversalConfirmedByRuleOrHmm=false) → NOT satisfied', result.satisfied, false);
  assert('2A: blocked at reversal', result.blockedReason, 'authoritative_reversal_missing');
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 3 — guarded trajectory proof alone must fail
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 3: guarded-trajectory-proof-only must not authorize official_shallow_cycle');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    guardedShallowTrajectoryClosureProofSatisfied: true, // trajectory-only
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3A: guarded trajectory alone (reversalConfirmedByRuleOrHmm=false) → NOT satisfied', result.satisfied, false);
  assert('3A: blocked at reversal', result.blockedReason, 'authoritative_reversal_missing');
}

// All four bridge/proof signals together, no rule/HMM → still blocked
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true, // bridge sets this true
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    guardedShallowTrajectoryClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('3B: ALL bridge/proof signals but reversalConfirmedByRuleOrHmm=false → NOT satisfied', result.satisfied, false);
  assert('3B: blocked at reversal gate', result.blockedReason, 'authoritative_reversal_missing');
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 4 — legitimate official shallow gold path must pass
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 4: legitimate gold path must still pass');

// 4-A: pure gold path (rule only, no bridge at all)
{
  const input = makeGoldPath();
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4A: pure gold path (rule, no bridge) → satisfied', result.satisfied, true);
  assert('4A: stage=closed', result.stage, 'closed');
  assert('4A: blockedReason=null', result.blockedReason, null);
}

// 4-B: gold path with bridge assistance (bridge present but not the authority)
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: true, // gold path confirmed
    officialShallowStreamBridgeApplied: true, // bridge also present (support)
    officialShallowClosureProofSatisfied: true, // proof also present (support)
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4B: gold path + bridge/proof present → satisfied (bridge is support, not authority)', result.satisfied, true);
  assert('4B: stage=closed', result.stage, 'closed');
}

// 4-C: HMM-assisted reversal (reversalConfirmedByRuleOrHmm=true via HMM)
{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('4C: HMM-assisted reversal (rule/HMM, no bridge) → satisfied', result.satisfied, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 5 — standard_cycle unchanged (not in shallow zone)
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 5: standard_cycle not in shallow zone → not affected by PR-12 reversal gate');

{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.55, // above CANONICAL_SHALLOW_OWNER_FLOOR=0.4 → not in shallow zone
    reversalConfirmedByRuleOrHmm: false, // bridge-only
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  // Not in shallow zone → eligible=false → blocked at admission
  assert('5A: deep cycle (relativeDepthPeak=0.55) → not eligible → blocked at admission', result.satisfied, false);
  assert('5A: not_in_shallow_zone', result.blockedReason, 'not_in_shallow_zone');
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 6 — ultra_low_rom contract behavior unchanged
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 6: ultra_low_rom zone — same gold-path rule applies');

// ultra-low depth with gold-path reversal → passes the contract
{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedByRuleOrHmm: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6A: ultra_low_rom + gold-path reversal → contract satisfied', result.satisfied, true);
}

// ultra-low depth with bridge-only → blocked
{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.05,
    evidenceLabel: 'ultra_low_rom',
    reversalConfirmedByRuleOrHmm: false,
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('6B: ultra_low_rom + bridge-only (no rule/HMM) → contract NOT satisfied', result.satisfied, false);
  assert('6B: blocked at reversal', result.blockedReason, 'authoritative_reversal_missing');
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 7 — no split-brain: rejected contract ≠ completionPassReason='official_shallow_cycle'
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 7: no split-brain — rejected contract cannot coexist with official_shallow_cycle');

{
  // Simulate a state where the closer already wrote official_shallow_cycle
  // but the canonical contract would NOT satisfy under PR-12 (bridge-only reversal)
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    officialShallowStreamBridgeApplied: true,
    officialShallowPathClosed: true, // closer claims it opened
    completionPassReason: 'official_shallow_cycle', // runtime says it opened
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('7A: contract not satisfied (bridge-only) → satisfied=false', result.satisfied, false);
  // splitBrainDetected: contract says rejected, but completionPassReason/closed says open
  assert('7A: split-brain detected (closer vs contract mismatch)', result.splitBrainDetected, true);
}

// ──────────────────────────────────────────────────────────────────────────────
// TEST 8 — backward-compat: undefined reversalConfirmedByRuleOrHmm fallback
// ──────────────────────────────────────────────────────────────────────────────
section('TEST 8: backward-compat — undefined reversalConfirmedByRuleOrHmm falls back to ownerAuthoritativeReversalSatisfied');

// 8-A: undefined + ownerAuthoritativeReversalSatisfied=true → passes (pre-PR-12 fixture compat)
{
  const { reversalConfirmedByRuleOrHmm: _unused, ...baseWithout } = makeGoldPath();
  const input = {
    ...baseWithout,
    // reversalConfirmedByRuleOrHmm intentionally omitted (undefined)
    ownerAuthoritativeReversalSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8A: undefined reversalConfirmedByRuleOrHmm + ownerAuthoritativeReversalSatisfied=true → satisfied (compat)', result.satisfied, true);
}

// 8-B: undefined + ownerAuthoritativeReversalSatisfied=false → blocked (compat path also guards)
{
  const { reversalConfirmedByRuleOrHmm: _unused, ...baseWithout } = makeGoldPath();
  const input = {
    ...baseWithout,
    // reversalConfirmedByRuleOrHmm intentionally omitted (undefined)
    ownerAuthoritativeReversalSatisfied: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('8B: undefined reversalConfirmedByRuleOrHmm + ownerAuthoritativeReversalSatisfied=false → NOT satisfied', result.satisfied, false);
  assert('8B: blocked at reversal', result.blockedReason, 'authoritative_reversal_missing');
}

// ──────────────────────────────────────────────────────────────────────────────
// REGRESSION GUARDS R1-R8
// ──────────────────────────────────────────────────────────────────────────────
section('REGRESSION GUARD R1: bridge+proof with no rule/HMM reversal must be blocked');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R1: bridge+proof, no rule/HMM → blocked', result.satisfied, false);
}

section('REGRESSION GUARD R2: proof-only closure cannot open official_shallow_cycle');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    officialShallowClosureProofSatisfied: true,
    officialShallowStreamBridgeApplied: false,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R2: proof-only (reversalConfirmedByRuleOrHmm=false) → blocked', result.satisfied, false);
}

section('REGRESSION GUARD R3: guarded trajectory alone cannot open official_shallow_cycle');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    ownerAuthoritativeReversalSatisfied: false,
    guardedShallowTrajectoryClosureProofSatisfied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R3: trajectory-only (no rule/HMM) → blocked', result.satisfied, false);
}

section('REGRESSION GUARD R4: legitimate gold-path pass survives');

{
  const result = deriveCanonicalShallowCompletionContract(makeGoldPath());
  assert('R4: gold-path → satisfied', result.satisfied, true);
}

section('REGRESSION GUARD R5: standard_cycle depth zone unaffected');

{
  const input = { ...makeGoldPath(), relativeDepthPeak: 0.5 };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R5: not in shallow zone → not_in_shallow_zone', result.blockedReason, 'not_in_shallow_zone');
}

section('REGRESSION GUARD R6: ultra_low not widened — bridge-only blocked in ultra_low zone too');

{
  const input = {
    ...makeGoldPath(),
    relativeDepthPeak: 0.04,
    reversalConfirmedByRuleOrHmm: false,
    officialShallowStreamBridgeApplied: true,
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R6: ultra_low + bridge-only → NOT satisfied', result.satisfied, false);
}

section('REGRESSION GUARD R7: rejected contract + official_shallow_cycle → split-brain detected');

{
  const input = {
    ...makeGoldPath(),
    reversalConfirmedByRuleOrHmm: false,
    officialShallowPathClosed: true,
    completionPassReason: 'official_shallow_cycle',
  };
  const result = deriveCanonicalShallowCompletionContract(input);
  assert('R7: split-brain detected when contract rejected but closer claims open', result.splitBrainDetected, true);
}

section('REGRESSION GUARD R8: writer inventory — only one writer path');

// This is a structural invariant: we can only verify it via source inspection.
// The test confirms the single-writer contract from the contract's perspective:
// closureWouldWriteOfficialShallowCycle is only true when satisfied=true.
{
  const goldResult = deriveCanonicalShallowCompletionContract(makeGoldPath());
  assert('R8: closureWouldWriteOfficialShallowCycle=true only when satisfied', goldResult.closureWouldWriteOfficialShallowCycle, true);

  const bridgeInput = { ...makeGoldPath(), reversalConfirmedByRuleOrHmm: false };
  const bridgeResult = deriveCanonicalShallowCompletionContract(bridgeInput);
  assert('R8: closureWouldWriteOfficialShallowCycle=false when contract rejected', bridgeResult.closureWouldWriteOfficialShallowCycle, false);
}

// ──────────────────────────────────────────────────────────────────────────────
// WRITER INVENTORY (documentation as test)
// ──────────────────────────────────────────────────────────────────────────────
section('WRITER INVENTORY');

results.push('  WRITER INVENTORY:');
results.push('  - file: src/lib/camera/squat-completion-state.ts');
results.push('  - function: applyCanonicalShallowClosureFromContract');
results.push('  - writes official_shallow_cycle directly? YES (only writer)');
results.push('  - role: single canonical closer; called after canonical contract satisfaction check');
results.push('');
results.push('  All other files (auto-progression.ts, squat-progression-contract.ts, squat.ts):');
results.push('  - READ completionPassReason (consumers), do NOT write official_shallow_cycle');

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────
console.log('\nPR-12 Official Shallow Gold-Path Convergence Smoke');
console.log('='.repeat(60));
for (const line of results) {
  console.log(line);
}
console.log('\n' + '='.repeat(60));
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
if (failed > 0) {
  process.exit(1);
}
