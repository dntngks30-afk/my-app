/**
 * PR-2 -- False Pass Guard Lock.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-false-pass-guard-lock-02-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  readOfficialShallowFalsePassGuardSnapshot,
  readOfficialShallowOwnerFreezeSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const { readSquatPassOwnerTruth } = await import('../src/lib/camera/auto-progression.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${name}`);
    return;
  }
  failed++;
  console.error(`  FAIL: ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  process.exitCode = 1;
}

function officialClosedState(overrides = {}) {
  return {
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'descent_span_too_short',
    currentSquatPhase: 'standing_recovered',
    cycleComplete: false,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.04,
    peakLatchedAtIndex: 4,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1320,
    attemptStartedAfterReady: true,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: 'ultra_low_rom',
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractAntiFalsePassClear: true,
    canonicalTemporalEpochOrderSatisfied: true,
    canonicalTemporalEpochOrderBlockedReason: null,
    selectedCanonicalDescentTimingEpochValidIndex: 1,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalPeakEpochValidIndex: 4,
    selectedCanonicalPeakEpochAtMs: 1120,
    selectedCanonicalReversalEpochValidIndex: 7,
    selectedCanonicalReversalEpochAtMs: 1240,
    selectedCanonicalRecoveryEpochValidIndex: 9,
    selectedCanonicalRecoveryEpochAtMs: 1320,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    squatEventCycle: { detected: true, descentFrames: 3, notes: [] },
    ...overrides,
  };
}

function expectBlockedFamily(family, overrides) {
  const cs = officialClosedState(overrides);
  const guard = readOfficialShallowFalsePassGuardSnapshot({ squatCompletionState: cs });
  const freeze = readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: cs });
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  ok(`${family}: guard family`, guard.officialShallowFalsePassGuardFamily === family, guard);
  ok(`${family}: freeze blocked`, freeze.officialShallowOwnerFrozen === false, freeze);
  ok(`${family}: owner blocked`, owner.completionOwnerPassed === false, owner);
}

console.log('\nPR-2 official shallow false-pass guard lock smoke\n');

{
  const cs = officialClosedState();
  const guard = readOfficialShallowFalsePassGuardSnapshot({ squatCompletionState: cs });
  const freeze = readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: cs });
  ok('A1: valid same-epoch shallow guard clear', guard.officialShallowFalsePassGuardClear === true, guard);
  ok('A2: valid same-epoch shallow can freeze', freeze.officialShallowOwnerFrozen === true, freeze);
}

expectBlockedFamily('no_real_descent', {
  descendConfirmed: false,
  downwardCommitmentDelta: 0.04,
});

expectBlockedFamily('standing_still_or_jitter_only', {
  downwardCommitmentDelta: 0,
  squatEventCycle: { detected: false, descentFrames: 0, notes: ['jitter_spike_reject'] },
});

expectBlockedFamily('no_real_reversal', {
  reversalConfirmedAfterDescend: false,
  officialShallowReversalSatisfied: false,
  reversalConfirmedByRuleOrHmm: false,
  officialShallowStreamBridgeApplied: false,
});

expectBlockedFamily('assist_only_closure_without_raw_epoch_provenance', {
  reversalConfirmedByRuleOrHmm: false,
  officialShallowStreamBridgeApplied: true,
  canonicalTemporalEpochOrderSatisfied: false,
  selectedCanonicalReversalEpochValidIndex: null,
  selectedCanonicalReversalEpochAtMs: null,
});

expectBlockedFamily('seated_hold_without_upward_recovery', {
  currentSquatPhase: 'ascending',
  recoveryConfirmedAfterReversal: false,
  ownerAuthoritativeRecoverySatisfied: false,
  standingFinalizeSatisfied: false,
  standingRecoveredAtMs: null,
});

expectBlockedFamily('still_seated_at_pass', {
  stillSeatedAtPass: true,
});

expectBlockedFamily('setup_motion_blocked', {
  setupMotionBlocked: true,
});

expectBlockedFamily('ready_before_start_success', {
  attemptStartedAfterReady: false,
});

expectBlockedFamily('cross_epoch_stitched_proof', {
  canonicalTemporalEpochOrderSatisfied: true,
  selectedCanonicalReversalEpochValidIndex: 12,
  selectedCanonicalReversalEpochAtMs: 1500,
  selectedCanonicalRecoveryEpochValidIndex: 9,
  selectedCanonicalRecoveryEpochAtMs: 1320,
});

expectBlockedFamily('canonical_false_pass_guard_not_clear', {
  canonicalShallowContractAntiFalsePassClear: false,
});

{
  const cs = {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
  };
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  ok('Z1: standard/deep path remains governed by existing owner logic', owner.completionOwnerPassed === true, owner);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
