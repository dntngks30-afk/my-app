/**
 * PR-1 -- Shallow Owner Authority Freeze.
 *
 * Run:
 *   npx tsx scripts/camera-pr-cam-squat-official-shallow-owner-freeze-01-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeSquatPostOwnerPreLatchGateLayer,
  isFinalPassLatched,
  readSquatPassOwnerTruth,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  computeSquatCompletionOwnerTruth,
  readOfficialShallowOwnerFreezeSnapshot,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  computeSquatUiProgressionLatchGate,
} = await import('../src/lib/camera/squat/squat-ui-progression-latch-gate.ts');

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

function frozenShallowState(overrides = {}) {
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
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractAntiFalsePassClear: true,
    ...overrides,
  };
}

function standardState(overrides = {}) {
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    ...overrides,
  };
}

function uiGateInput(ownerTruth, overrides = {}) {
  return {
    completionOwnerPassed: ownerTruth.completionOwnerPassed,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.7,
    passThresholdEffective: 0.62,
    effectivePassConfirmation: true,
    passConfirmationFrameCount: 3,
    framesReq: 3,
    captureArmingSatisfied: true,
    squatIntegrityBlockForPass: null,
    reasons: [],
    hardBlockerReasons: [],
    liveReadinessNotReady: false,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    officialShallowOwnerFrozen: ownerTruth.officialShallowOwnerFrozen,
    ...overrides,
  };
}

function finalGate(ownerTruth, cs, uiOverrides = {}) {
  return computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: uiGateInput(ownerTruth, uiOverrides),
    squatCompletionState: cs,
    squatCycleDebug: undefined,
  });
}

console.log('\nPR-1 official shallow owner freeze smoke\n');

{
  const cs = frozenShallowState();
  const freeze = readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: cs });
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  const gate = finalGate(owner, cs, {
    guardrailCompletionComplete: false,
    confidence: 0.1,
    effectivePassConfirmation: false,
    passConfirmationFrameCount: 0,
    squatIntegrityBlockForPass: 'standard_cycle_signal_integrity:hard_partial',
  });
  ok('A1: official shallow freeze snapshot is frozen', freeze.officialShallowOwnerFrozen === true, freeze);
  ok('A2: completion owner reads frozen shallow truth', owner.completionOwnerPassed === true, owner);
  ok('A3: UI gate is sink-only after freeze', gate.uiGate.uiProgressionAllowed === true, gate);
  ok('A4: final pass eligible follows frozen owner snapshot', gate.progressionPassed === true, gate);
  ok(
    'A5: final latch mirrors finalPassEligible',
    isFinalPassLatched('squat', {
      completionSatisfied: false,
      confidence: 0.1,
      passConfirmationSatisfied: false,
      passConfirmationFrameCount: 0,
      guardrail: { captureQuality: 'retry', flags: [] },
      evaluatorResult: { stepId: 'squat', metrics: [], debug: { squatCompletionState: cs } },
      finalPassEligible: gate.progressionPassed,
      finalPassBlockedReason: gate.finalPassBlockedReason,
    }) === true,
    gate
  );
}

{
  const cs = frozenShallowState({ officialShallowClosureProofSatisfied: false });
  const freeze = readOfficialShallowOwnerFreezeSnapshot({ squatCompletionState: cs });
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  const gate = finalGate(owner, cs);
  ok('A6: closed shallow owner consumes closure authority even if proof mirror lags', freeze.officialShallowOwnerFrozen === true, freeze);
  ok('A7: canonical owner pass follows closed shallow owner authority', owner.completionOwnerPassed === true, owner);
  ok('A8: final pass opens from canonical owner truth, not proof mirror', gate.progressionPassed === true && gate.finalPassBlockedReason == null, gate);
}

{
  const cs = frozenShallowState({ canonicalShallowContractAntiFalsePassClear: false });
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  ok('B1: frozen path stays blocked when hard-fail guard is not clear', owner.completionOwnerPassed === false, owner);
}

{
  const cs = frozenShallowState({ officialShallowPathClosed: false });
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  ok('C1: non-closed official shallow path falls back to existing standard logic', owner.completionOwnerPassed === false, owner);
}

{
  const cs = standardState();
  const owner = readSquatPassOwnerTruth({ squatCompletionState: cs, squatPassCore: undefined });
  const gate = finalGate(owner, cs);
  ok('D1: existing standard/deep owner path remains open', owner.completionOwnerPassed === true, owner);
  ok('D2: existing standard/deep final gate remains open', gate.progressionPassed === true, gate);
}

{
  const cs = standardState();
  const owner = computeSquatCompletionOwnerTruth({ squatCompletionState: cs });
  const ui = computeSquatUiProgressionLatchGate(
    uiGateInput(owner, {
      confidence: 0.1,
      officialShallowOwnerFrozen: false,
    })
  );
  ok('E1: non-frozen owner still honors UI confidence gate', ui.uiProgressionAllowed === false, ui);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
