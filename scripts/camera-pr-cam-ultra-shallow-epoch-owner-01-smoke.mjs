/**
 * PR-CAM-ULTRA-SHALLOW-EPOCH-OWNER-01
 *
 * npx tsx scripts/camera-pr-cam-ultra-shallow-epoch-owner-01-smoke.mjs
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const { deriveCanonicalShallowCompletionContract } = await import(
  '../src/lib/camera/squat/shallow-completion-contract.ts'
);
const { readSquatPassOwnerTruth } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  OK ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra ?? '');
    process.exitCode = 1;
  }
}

function legalEpochInput(overrides = {}) {
  return {
    relativeDepthPeak: 0.055,
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    ownerAuthoritativeReversalSatisfied: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowClosureProofSatisfied: false,
    officialShallowPrimaryDropClosureFallback: false,
    guardedShallowTrajectoryClosureProofSatisfied: false,
    provenanceReversalEvidencePresent: false,
    trajectoryReversalRescueApplied: false,
    reversalTailBackfillApplied: false,
    ultraShallowMeaningfulDownUpRescueApplied: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveryFinalizeReason: 'ultra_low_rom_guarded_finalize',
    setupMotionBlocked: false,
    peakLatchedAtIndex: 5,
    descentStartAtMs: 1000,
    peakAtMs: 1500,
    reversalAtMs: 1900,
    standingRecoveredAtMs: 2600,
    minimumCycleDurationSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    eventCycleDetected: true,
    eventCycleHasDescentWeak: false,
    eventCycleDescentFrames: 5,
    eventCycleHasFreezeOrLatchMissing: false,
    downwardCommitmentDelta: 0.05,
    squatReversalToStandingMs: 700,
    reversalConfirmedByRuleOrHmm: true,
    currentSquatPhase: 'standing_recovered',
    completionBlockedReason: null,
    officialShallowPathClosed: false,
    completionPassReason: 'not_confirmed',
    ...overrides,
  };
}

function derive(overrides = {}) {
  return deriveCanonicalShallowCompletionContract(legalEpochInput(overrides));
}

console.log('\nPR-CAM-ULTRA-SHALLOW-EPOCH-OWNER-01 smoke\n');

{
  const c = derive();
  ok('A: legal ultra-low epoch closes canonical contract', c.satisfied === true, c);
  ok('A: legal ultra-low closure source remains canonical', c.closureWouldWriteOfficialShallowCycle === true, c);
}

{
  const c = derive({
    relativeDepthPeak: 0.12,
    evidenceLabel: 'low_rom',
    standingRecoveryFinalizeReason: 'low_rom_guarded_finalize',
  });
  ok('B: legal shallow low-rom epoch closes canonical contract', c.satisfied === true, c);
}

{
  const c = derive({ descentStartAtMs: null, officialShallowClosureProofSatisfied: true });
  ok('E1: descendConfirmed true but descentStartAtMs null fail-closes', c.satisfied === false, c);
  ok('E1: missing descentStartAtMs blocks at temporal epoch order', c.blockedReason === 'temporal_epoch_order_blocked', c);
}

{
  const c = derive({ peakLatchedAtIndex: 0 });
  ok('D: series-start peakLatchedAtIndex=0 fail-closes', c.satisfied === false, c);
  ok('D: series-start blocked reason preserved', c.blockedReason === 'peak_series_start_contamination', c);
}

{
  const c = derive({ peakLatchedAtIndex: -1 });
  ok('D: invalid peakLatchedAtIndex<0 fail-closes', c.satisfied === false, c);
  ok('D: invalid peak index blocked as series-start contamination', c.blockedReason === 'peak_series_start_contamination', c);
}

{
  const c = derive({ peakAtMs: 1000 });
  ok('D: peakAtMs <= descentStartAtMs fail-closes', c.satisfied === false, c);
  ok('D: bad peak order blocked by temporal epoch', c.blockedReason === 'temporal_epoch_order_blocked', c);
}

{
  const c = derive({ reversalAtMs: 1500 });
  ok('D: reversalAtMs <= peakAtMs fail-closes', c.satisfied === false, c);
  ok('D: bad reversal order blocked by temporal epoch', c.blockedReason === 'temporal_epoch_order_blocked', c);
}

{
  const c = derive({ standingRecoveredAtMs: 1900 });
  ok('D: standingRecoveredAtMs <= reversalAtMs fail-closes', c.satisfied === false, c);
  ok('D: bad recovery order blocked by temporal epoch', c.blockedReason === 'temporal_epoch_order_blocked', c);
}

{
  const c = derive({
    ownerAuthoritativeReversalSatisfied: false,
    reversalConfirmedByRuleOrHmm: false,
    officialShallowClosureProofSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowPrimaryDropClosureFallback: true,
    guardedShallowTrajectoryClosureProofSatisfied: true,
    provenanceReversalEvidencePresent: true,
  });
  ok('D: helper/proof positive without owner reversal fail-closes', c.satisfied === false, c);
  ok('D: helper/proof cannot become owner reversal', c.blockedReason === 'authoritative_reversal_missing', c);
}

{
  const c = derive({ setupMotionBlocked: true });
  ok('D: setup motion fail-closes', c.satisfied === false, c);
  ok('D: setup blocked reason preserved', c.blockedReason === 'setup_motion_blocked', c);
}

{
  const owner = readSquatPassOwnerTruth({
    squatCompletionState: {
      completionSatisfied: true,
      completionPassReason: 'official_shallow_cycle',
      completionBlockedReason: null,
      currentSquatPhase: 'standing_recovered',
      cycleComplete: true,
    },
    squatPassCore: {
      passDetected: false,
      passBlockedReason: 'missing_descent_epoch',
    },
  });
  ok('D: positive completion/helper cannot pass when pass-core is blocked', owner.completionOwnerPassed === false, owner);
  ok('D: pass-core blocked reason wins', owner.completionOwnerBlockedReason === 'missing_descent_epoch', owner);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
