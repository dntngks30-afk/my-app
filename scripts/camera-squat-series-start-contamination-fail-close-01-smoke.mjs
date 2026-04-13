/**
 * SERIES-START-CONTAMINATION-FAIL-CLOSE-01 smoke.
 *
 * Verifies that peakLatchedAtIndex=0 (raw) always triggers
 * `peak_series_start_contamination` in the canonical contract — even when a valid
 * guardedShallowLocalPeakIndex > 0 exists (the old substitution bypass is gone).
 *
 * Also verifies legit shallow reps (peakLatchedAtIndex > 0) still pass the anti-false-pass gate.
 *
 * Run:
 *   npx tsx scripts/camera-squat-series-start-contamination-fail-close-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  deriveCanonicalShallowCompletionContract,
} = await import('../src/lib/camera/squat/shallow-completion-contract.ts');
const {
  buildCanonicalShallowContractInputFromState,
} = await import('../src/lib/camera/squat/squat-completion-canonical.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  const detail = extra !== undefined ? ` | got: ${JSON.stringify(extra)}` : '';
  console.error(`  FAIL: ${name}${detail}`);
  process.exitCode = 1;
}

function baseState(overrides = {}) {
  return {
    relativeDepthPeak: 0.18,
    evidenceLabel: 'low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    currentSquatPhase: 'standing_recovered',
    completionBlockedReason: null,
    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    provenanceReversalEvidencePresent: false,
    trajectoryReversalRescueApplied: false,
    reversalTailBackfillApplied: false,
    ultraShallowMeaningfulDownUpRescueApplied: false,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'standing_hold_met',
    setupMotionBlocked: false,
    peakLatchedAtIndex: 3,
    guardedShallowLocalPeakFound: false,
    guardedShallowLocalPeakIndex: null,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: null,
    completionPassReason: 'not_confirmed',
    completionSatisfied: false,
    cycleDurationMs: 1200,
    baselineFrozen: true,
    peakLatched: true,
    downwardCommitmentDelta: 0.05,
    reversalConfirmedByRuleOrHmm: true,
    squatReversalToStandingMs: 1000,
    squatEventCycle: { detected: true, notes: [], descentFrames: 5 },
    ...overrides,
  };
}

console.log('\nA. series-start contamination: peakLatchedAtIndex=0 blocks canonical contract');
{
  // A1: raw peakLatchedAtIndex=0 — even with everything else satisfied
  const state = baseState({ peakLatchedAtIndex: 0 });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('A1: contract not satisfied when raw peak at index 0', contract.satisfied === false, contract);
  ok('A1b: blocked reason is peak_series_start_contamination', contract.blockedReason === 'peak_series_start_contamination', contract);
  ok('A1c: antiFalsePassClear is false', contract.antiFalsePassClear === false, contract);
}

{
  // A2: raw peakLatchedAtIndex=0 WITH a valid local peak at index 5 (old bypass path)
  // The contamination guard must still fire because we use rawPeakLatchedAtIndex.
  const state = baseState({
    peakLatchedAtIndex: 0,
    guardedShallowLocalPeakFound: true,
    guardedShallowLocalPeakIndex: 5,
  });
  const input = buildCanonicalShallowContractInputFromState(state);
  ok('A2: input peakLatchedAtIndex is raw (0), not substituted', input.peakLatchedAtIndex === 0, { got: input.peakLatchedAtIndex });
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('A2b: contract blocked even with local peak at index 5', contract.satisfied === false, contract);
  ok('A2c: blocked reason is peak_series_start_contamination', contract.blockedReason === 'peak_series_start_contamination', contract);
}

console.log('\nB. legit shallow rep: peakLatchedAtIndex>0 passes anti-false-pass gate');
{
  // B1: normal shallow rep — peak at index 3
  const state = baseState({ peakLatchedAtIndex: 3 });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('B1: contract satisfied for legit shallow rep', contract.satisfied === true, contract);
  ok('B1b: antiFalsePassClear is true', contract.antiFalsePassClear === true, contract);
  ok('B1c: blocked reason is null', contract.blockedReason === null, contract);
}

{
  // B2: ultra-low ROM rep — peak at index 1 (just after series start, still legit)
  const state = baseState({
    peakLatchedAtIndex: 1,
    relativeDepthPeak: 0.06,
    evidenceLabel: 'ultra_low_rom',
  });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('B2: contract satisfied for ultra_low rep at peakLatchedAtIndex=1', contract.satisfied === true, contract);
  ok('B2b: antiFalsePassClear true for index 1', contract.antiFalsePassClear === true, contract);
}

console.log('\nC. seated / setup contamination: degenerate timing signals');
{
  // C1: peakLatchedAtIndex=0 + degenerate timing (series-start seated scenario)
  const state = baseState({
    peakLatchedAtIndex: 0,
    downwardCommitmentDelta: 0,  // no actual descent — non-degenerate gate also fires
  });
  const input = buildCanonicalShallowContractInputFromState(state);
  const contract = deriveCanonicalShallowCompletionContract(input);
  ok('C1: degenerate timing + index 0 blocked', contract.satisfied === false, contract);
  // Either non_degenerate_commitment_blocked or peak_series_start_contamination — both are false pass guards
  ok('C1b: blocked by contamination or degenerate commitment', 
    contract.blockedReason === 'peak_series_start_contamination' || 
    contract.blockedReason === 'non_degenerate_commitment_blocked',
    { blockedReason: contract.blockedReason }
  );
}

console.log(`\nseries-start contamination fail-close smoke: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
