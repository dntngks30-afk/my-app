/**
 * PR-CAM-SHALLOW-TEMPORAL-EPOCH-LOCK-01
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-shallow-temporal-epoch-lock-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { deriveCanonicalShallowCompletionContract } = await import(
  '../src/lib/camera/squat/shallow-completion-contract.ts'
);

let passed = 0;
let failed = 0;

function ok(name, condition, extra) {
  if (condition) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra ?? '');
  }
}

function makeInput(overrides = {}) {
  return {
    relativeDepthPeak: 0.09,
    evidenceLabel: 'low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    ownerAuthoritativeReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowClosureProofSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    guardedShallowTrajectoryClosureProofSatisfied: true,
    provenanceReversalEvidencePresent: false,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'low_rom_guarded_finalize',
    setupMotionBlocked: false,
    peakLatchedAtIndex: 5,
    descentStartAtMs: 1000,
    peakAtMs: 1400,
    reversalAtMs: 1800,
    standingRecoveredAtMs: 2300,
    minimumCycleDurationSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    eventCycleDetected: true,
    eventCycleHasDescentWeak: false,
    eventCycleDescentFrames: 5,
    eventCycleHasFreezeOrLatchMissing: false,
    downwardCommitmentDelta: 0.04,
    squatReversalToStandingMs: 500,
    reversalConfirmedByRuleOrHmm: true,
    currentSquatPhase: 'standing_recovered',
    completionBlockedReason: null,
    officialShallowPathClosed: false,
    completionPassReason: 'not_confirmed',
    ...overrides,
  };
}

console.log('\nPR-CAM-SHALLOW-TEMPORAL-EPOCH-LOCK-01 canonical smoke\n');

{
  const result = deriveCanonicalShallowCompletionContract(makeInput());
  ok('legal shallow temporal epoch closes', result.satisfied === true, result);
  ok('legal close source remains canonical', result.closureWouldWriteOfficialShallowCycle === true, result);
}

{
  const result = deriveCanonicalShallowCompletionContract(makeInput({ descentStartAtMs: null }));
  ok('descendConfirmed without descentStartAtMs fail-closes', result.satisfied === false, result);
  ok('missing descent blocks at temporal epoch', result.blockedReason === 'temporal_epoch_order_blocked', result);
}

{
  const result = deriveCanonicalShallowCompletionContract(makeInput({ peakLatchedAtIndex: 0 }));
  ok('series-start contaminated peak fail-closes', result.satisfied === false, result);
  ok('series-start reason preserved', result.blockedReason === 'peak_series_start_contamination', result);
}

{
  const result = deriveCanonicalShallowCompletionContract(makeInput({ reversalAtMs: null }));
  ok('helper/proof positive cannot outrun missing reversal time', result.satisfied === false, result);
  ok('missing reversal blocks at temporal epoch', result.blockedReason === 'temporal_epoch_order_blocked', result);
}

{
  const result = deriveCanonicalShallowCompletionContract(
    makeInput({ standingRecoveredAtMs: 1700 })
  );
  ok('standing recovery before reversal fail-closes', result.satisfied === false, result);
  ok('bad recovery order blocks at temporal epoch', result.blockedReason === 'temporal_epoch_order_blocked', result);
}

{
  const result = deriveCanonicalShallowCompletionContract(
    makeInput({
      eventCycleHasFreezeOrLatchMissing: true,
      officialShallowClosureProofSatisfied: true,
    })
  );
  ok('freeze/latch missing contamination fail-closes', result.satisfied === false, result);
  ok('epoch contamination reason preserved', result.blockedReason === 'rep_epoch_integrity_blocked', result);
}

console.log(`\nDone: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
