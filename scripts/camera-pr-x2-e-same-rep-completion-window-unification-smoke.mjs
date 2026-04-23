/**
 * PR-X2-E - Same-rep completion window unification smoke.
 *
 * Pins the narrow X2-E contract:
 * - same-rep completion window becomes the canonical close/finalize/veto truth
 * - shallow valid-cycle reps stop dying on residual short-descent re-reads
 * - deep/standard finalized reps stop getting retro-vetoed by late setup contamination
 * - completion=false / setup-before-commit / too-short recovery-hold families stay blocked
 *
 * Run:
 *   npx tsx scripts/camera-pr-x2-e-same-rep-completion-window-unification-smoke.mjs
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, '..'));

const {
  computeShallowCycleCloseProofDecision,
} = await import('../src/lib/camera/squat/squat-shallow-close-proof.ts');
const {
  getShallowMeaningfulCycleBlockReason,
} = await import('../src/lib/camera/evaluators/squat-meaningful-shallow.ts');
const {
  computeSquatCompletionOwnerTruth,
} = await import('../src/lib/camera/squat/squat-progression-contract.ts');
const {
  computeSquatPostOwnerPreLatchGateLayer,
  isFinalPassLatched,
} = await import('../src/lib/camera/auto-progression.ts');
const {
  readSquatFinalPassSemanticsTruth,
} = await import('../src/lib/camera/squat/squat-final-pass-semantics.ts');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.error(
      `  FAIL ${name}`,
      extra !== undefined ? JSON.stringify(extra).slice(0, 800) : ''
    );
    process.exitCode = 1;
  }
}

function makeUiGateInput(ownerPassed, setupMotionBlocked = false) {
  return {
    completionOwnerPassed: ownerPassed,
    guardrailCompletionComplete: true,
    captureQualityInvalid: false,
    confidence: 0.88,
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
    setupMotionBlocked,
    confidenceDecoupleEligible: false,
  };
}

function makeGate(layer, squatCompletionState) {
  return {
    completionSatisfied: squatCompletionState?.completionSatisfied === true,
    confidence: 0.88,
    passConfirmationSatisfied: true,
    passConfirmationFrameCount: 3,
    guardrail: { captureQuality: 'high' },
    evaluatorResult: { debug: { squatCompletionState } },
    squatCycleDebug: {
      finalPassSource: 'completion',
      finalSuccessOwner: layer.ownerTruth.finalSuccessOwner,
      completionFinalizedForSurface: layer.ownerTruth.completionFinalizedForSurface,
      surfaceTemporalTruthSource: layer.ownerTruth.surfaceTemporalTruthSource,
      squatFinalPassTruth: layer.squatFinalPassTruth,
    },
    finalPassEligible: layer.progressionPassed,
    finalPassBlockedReason: layer.finalPassBlockedReason,
  };
}

function runSurface(state) {
  const ownerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: state,
  });
  const layer = computeSquatPostOwnerPreLatchGateLayer({
    stepId: 'squat',
    ownerTruth,
    uiGateInput: makeUiGateInput(ownerTruth.completionOwnerPassed, state.setupMotionBlocked === true),
    squatCompletionState: state,
    squatCycleDebug: undefined,
    squatPassCore: undefined,
  });
  const gate = makeGate(layer, state);
  const semantics = readSquatFinalPassSemanticsTruth({
    finalPassEligible: gate.finalPassEligible,
    squatFinalPassTruth: layer.squatFinalPassTruth,
  });
  return { ownerTruth, layer, gate, semantics };
}

function makeSameRepWindow(overrides = {}) {
  return {
    repEpochId: 'same_rep:1000:1120:1260:1400',
    sameRepCompletionWindowPresent: true,
    sameRepCompletionWindowMixedOrStale: false,
    attemptStarted: true,
    officialShallowPathAdmitted: true,
    evidenceLabel: 'low_rom',
    relativeDepthPeak: 0.15,
    baselineFrozen: true,
    peakLatched: true,
    peakLatchedAtIndex: 18,
    committedAtMs: 1040,
    peakAtMs: 1120,
    reversalAtMs: 1260,
    standingRecoveredAtMs: 1400,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    officialShallowStreamBridgeApplied: true,
    reversalConfirmedByRuleOrHmm: true,
    trajectoryReversalRescueApplied: false,
    canonicalTemporalEpochOrderSatisfied: true,
    sameRepSetupCleanWithinRepWindow: true,
    sameRepSetupBlockFirstSeenBeforeCommit: false,
    sameRepSetupBlockFirstSeenAfterCompletion: false,
    sameRepRecoveryHoldMs: 186.4,
    sameRepStandingRecoveryFinalizeSatisfied: true,
    sameRepShallowCloseEligible: true,
    sameRepShallowCloseBlockedReason: null,
    sameRepStandardFinalizeEligible: false,
    sameRepStandardFinalizeBlockedReason: 'not_standard_finalize_band',
    retroVetoSuppressedBySameRepCompletion: false,
    retroVetoSuppressedReason: null,
    ...overrides,
  };
}

function makeShallowPayloadFirstState(overrides = {}) {
  const sameRep = makeSameRepWindow();
  return {
    completionSatisfied: true,
    completionBlockedReason: null,
    completionPassReason: 'official_shallow_cycle',
    relativeDepthPeak: 0.15,
    currentSquatPhase: 'standing_recovered',
    baselineStandingDepth: 0,
    baselineFrozenDepth: 0,
    rawDepthPeakPrimary: 0.15,
    squatDescentToPeakMs: 80,
    squatReversalToStandingMs: 2200,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    reversalConfirmedAfterDescend: true,
    reversalConfirmedByRuleOrHmm: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    officialShallowAscentEquivalentSatisfied: true,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'missing_reversal_epoch',
    setupMotionBlocked: false,
    readinessStableDwellSatisfied: true,
    eventCyclePromoted: false,
    trajectoryReversalRescueApplied: false,
    sameRepCompletionWindow: sameRep,
    sameRepCompletionWindowPresent: sameRep.sameRepCompletionWindowPresent,
    sameRepCompletionWindowRepEpochId: sameRep.repEpochId,
    sameRepCompletionWindowMixedOrStale: sameRep.sameRepCompletionWindowMixedOrStale,
    sameRepSetupCleanWithinRepWindow: sameRep.sameRepSetupCleanWithinRepWindow,
    sameRepSetupBlockFirstSeenBeforeCommit: sameRep.sameRepSetupBlockFirstSeenBeforeCommit,
    sameRepSetupBlockFirstSeenAfterCompletion: sameRep.sameRepSetupBlockFirstSeenAfterCompletion,
    sameRepStandingRecoveryFinalizeSatisfied: sameRep.sameRepStandingRecoveryFinalizeSatisfied,
    sameRepRecoveryHoldMs: sameRep.sameRepRecoveryHoldMs,
    sameRepShallowCloseEligible: sameRep.sameRepShallowCloseEligible,
    sameRepShallowCloseBlockedReason: sameRep.sameRepShallowCloseBlockedReason,
    sameRepStandardFinalizeEligible: sameRep.sameRepStandardFinalizeEligible,
    sameRepStandardFinalizeBlockedReason: sameRep.sameRepStandardFinalizeBlockedReason,
    retroVetoSuppressedBySameRepCompletion: true,
    retroVetoSuppressedReason: 'descent_span_too_short',
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

function makeFinalizedShallowState(overrides = {}) {
  const sameRep = makeSameRepWindow({
    retroVetoSuppressedBySameRepCompletion: true,
    retroVetoSuppressedReason: 'descent_span_too_short',
  });
  return {
    completionSatisfied: true,
    completionPassReason: 'official_shallow_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.11,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: true,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1400,
    attemptStartedAfterReady: true,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: false,
    evidenceLabel: 'low_rom',
    peakLatchedAtIndex: 18,
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: true,
    officialShallowClosureProofSatisfied: true,
    baselineFrozen: true,
    peakLatched: true,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'missing_reversal_epoch',
    selectedCanonicalDescentTimingEpochValidIndex: 12,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalPeakEpochValidIndex: 18,
    selectedCanonicalPeakEpochAtMs: 1120,
    selectedCanonicalReversalEpochValidIndex: null,
    selectedCanonicalReversalEpochAtMs: null,
    selectedCanonicalRecoveryEpochValidIndex: 26,
    selectedCanonicalRecoveryEpochAtMs: 1400,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: true,
    officialShallowAscentEquivalentSatisfied: true,
    stillSeatedAtPass: false,
    sameRepCompletionWindow: sameRep,
    sameRepCompletionWindowPresent: sameRep.sameRepCompletionWindowPresent,
    sameRepCompletionWindowRepEpochId: sameRep.repEpochId,
    sameRepCompletionWindowMixedOrStale: sameRep.sameRepCompletionWindowMixedOrStale,
    sameRepSetupCleanWithinRepWindow: sameRep.sameRepSetupCleanWithinRepWindow,
    sameRepSetupBlockFirstSeenBeforeCommit: sameRep.sameRepSetupBlockFirstSeenBeforeCommit,
    sameRepSetupBlockFirstSeenAfterCompletion: sameRep.sameRepSetupBlockFirstSeenAfterCompletion,
    sameRepStandingRecoveryFinalizeSatisfied: sameRep.sameRepStandingRecoveryFinalizeSatisfied,
    sameRepRecoveryHoldMs: sameRep.sameRepRecoveryHoldMs,
    sameRepShallowCloseEligible: sameRep.sameRepShallowCloseEligible,
    sameRepShallowCloseBlockedReason: sameRep.sameRepShallowCloseBlockedReason,
    sameRepStandardFinalizeEligible: sameRep.sameRepStandardFinalizeEligible,
    sameRepStandardFinalizeBlockedReason: sameRep.sameRepStandardFinalizeBlockedReason,
    retroVetoSuppressedBySameRepCompletion: true,
    retroVetoSuppressedReason: 'descent_span_too_short',
    squatEventCycle: {
      detected: true,
      descentFrames: 6,
      notes: [],
    },
    completionFinalizedForSurface: true,
    completionFinalizedOwner: 'completion',
    completionFinalizedEpochId: 'completion:1000:1120:1260:1400',
    completionFinalizedTemporalOrderSatisfied: true,
    completionFinalizedPassReason: 'official_shallow_cycle',
    completionFinalizedDescentAtMs: 1000,
    completionFinalizedPeakAtMs: 1120,
    completionFinalizedReversalAtMs: 1260,
    completionFinalizedRecoveryAtMs: 1400,
    ...overrides,
  };
}

function makeFinalizedDeepState(overrides = {}) {
  const sameRep = makeSameRepWindow({
    officialShallowPathAdmitted: false,
    evidenceLabel: 'standard',
    relativeDepthPeak: 0.42,
    officialShallowReversalSatisfied: false,
    officialShallowAscentEquivalentSatisfied: false,
    officialShallowStreamBridgeApplied: false,
    sameRepShallowCloseEligible: false,
    sameRepShallowCloseBlockedReason: 'not_admitted',
    sameRepStandardFinalizeEligible: true,
    sameRepStandardFinalizeBlockedReason: null,
    sameRepSetupBlockFirstSeenAfterCompletion: true,
    retroVetoSuppressedBySameRepCompletion: true,
    retroVetoSuppressedReason: 'large_framing_translation',
  });
  return {
    completionSatisfied: true,
    completionPassReason: 'standard_cycle',
    completionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    cycleComplete: true,
    attemptStarted: true,
    descendConfirmed: true,
    downwardCommitmentReached: true,
    downwardCommitmentDelta: 0.42,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    officialShallowReversalSatisfied: false,
    ownerAuthoritativeRecoverySatisfied: true,
    standingFinalizeSatisfied: true,
    standingRecoveredAtMs: 1400,
    attemptStartedAfterReady: true,
    readinessStableDwellSatisfied: true,
    setupMotionBlocked: true,
    evidenceLabel: 'standard',
    peakLatchedAtIndex: 20,
    officialShallowPathCandidate: false,
    officialShallowPathAdmitted: false,
    officialShallowPathClosed: false,
    officialShallowClosureProofSatisfied: false,
    baselineFrozen: true,
    peakLatched: true,
    canonicalTemporalEpochOrderSatisfied: false,
    canonicalTemporalEpochOrderBlockedReason: 'reversal_not_after_peak',
    selectedCanonicalDescentTimingEpochValidIndex: 12,
    selectedCanonicalDescentTimingEpochAtMs: 1000,
    selectedCanonicalPeakEpochValidIndex: 20,
    selectedCanonicalPeakEpochAtMs: 1140,
    selectedCanonicalReversalEpochValidIndex: 24,
    selectedCanonicalReversalEpochAtMs: 1260,
    selectedCanonicalRecoveryEpochValidIndex: 28,
    selectedCanonicalRecoveryEpochAtMs: 1400,
    reversalConfirmedByRuleOrHmm: true,
    officialShallowStreamBridgeApplied: false,
    officialShallowAscentEquivalentSatisfied: false,
    stillSeatedAtPass: false,
    sameRepCompletionWindow: sameRep,
    sameRepCompletionWindowPresent: sameRep.sameRepCompletionWindowPresent,
    sameRepCompletionWindowRepEpochId: 'same_rep:1000:1140:1260:1400',
    sameRepCompletionWindowMixedOrStale: sameRep.sameRepCompletionWindowMixedOrStale,
    sameRepSetupCleanWithinRepWindow: sameRep.sameRepSetupCleanWithinRepWindow,
    sameRepSetupBlockFirstSeenBeforeCommit: false,
    sameRepSetupBlockFirstSeenAfterCompletion: true,
    sameRepStandingRecoveryFinalizeSatisfied: true,
    sameRepRecoveryHoldMs: 186.4,
    sameRepShallowCloseEligible: false,
    sameRepShallowCloseBlockedReason: 'not_admitted',
    sameRepStandardFinalizeEligible: true,
    sameRepStandardFinalizeBlockedReason: null,
    retroVetoSuppressedBySameRepCompletion: true,
    retroVetoSuppressedReason: 'large_framing_translation',
    squatEventCycle: {
      detected: true,
      descentFrames: 7,
      notes: [],
    },
    completionFinalizedForSurface: true,
    completionFinalizedOwner: 'completion',
    completionFinalizedEpochId: 'completion:1000:1140:1260:1400',
    completionFinalizedTemporalOrderSatisfied: true,
    completionFinalizedPassReason: 'standard_cycle',
    completionFinalizedDescentAtMs: 1000,
    completionFinalizedPeakAtMs: 1140,
    completionFinalizedReversalAtMs: 1260,
    completionFinalizedRecoveryAtMs: 1400,
    ...overrides,
  };
}

console.log('\nPR-X2-E same-rep completion window unification smoke\n');

{
  const state = makeShallowPayloadFirstState();
  const proof = computeShallowCycleCloseProofDecision(state);
  const reason = getShallowMeaningfulCycleBlockReason(state);

  ok(
    'same-rep payload proves shallow close even when raw temporal ledger is stale',
    proof.cycleCloseProofSatisfied === true &&
      proof.cycleCloseProofBlockedReason == null &&
      proof.gates.sameRepWindowPresent === true,
    proof
  );
  ok(
    'payload-first shallow proof removes shallow_descent_too_short at evaluator surface',
    reason == null,
    { reason, proof }
  );
}

{
  const sameRep = makeSameRepWindow({
    sameRepSetupCleanWithinRepWindow: false,
    sameRepSetupBlockFirstSeenBeforeCommit: true,
    sameRepShallowCloseEligible: false,
    sameRepShallowCloseBlockedReason: 'setup_before_commit',
  });
  const proof = computeShallowCycleCloseProofDecision(
    makeShallowPayloadFirstState({
      sameRepCompletionWindow: sameRep,
      sameRepSetupCleanWithinRepWindow: false,
      sameRepSetupBlockFirstSeenBeforeCommit: true,
      sameRepShallowCloseEligible: false,
      sameRepShallowCloseBlockedReason: 'setup_before_commit',
      retroVetoSuppressedBySameRepCompletion: false,
      retroVetoSuppressedReason: null,
    })
  );
  ok(
    'setup-before-commit shallow family stays blocked under same-rep payload',
    proof.cycleCloseProofSatisfied === false &&
      proof.cycleCloseProofBlockedReason === 'setup_before_commit',
    proof
  );
}

{
  const state = makeFinalizedShallowState();
  const { ownerTruth, layer, gate, semantics } = runSurface(state);

  ok(
    'finalized shallow same-rep payload opens owner/final surface/UI/latch/semantics together',
    ownerTruth.completionOwnerPassed === true &&
      ownerTruth.surfaceTemporalTruthSource === 'completion_finalized_payload' &&
      layer.progressionPassed === true &&
      layer.uiGate.uiProgressionAllowed === true &&
      isFinalPassLatched('squat', gate) === true &&
      semantics.finalPassGranted === true,
    {
      ownerTruth,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      uiProgressionAllowed: layer.uiGate.uiProgressionAllowed,
      semantics,
    }
  );
  ok(
    'shallow same-rep trace exposes retro-veto suppression and completion-owned source',
    state.retroVetoSuppressedBySameRepCompletion === true &&
      state.retroVetoSuppressedReason === 'descent_span_too_short' &&
      ownerTruth.finalPassSource === 'completion',
    {
      retroVetoSuppressedBySameRepCompletion: state.retroVetoSuppressedBySameRepCompletion,
      retroVetoSuppressedReason: state.retroVetoSuppressedReason,
      finalPassSource: ownerTruth.finalPassSource,
    }
  );
}

{
  const state = makeFinalizedDeepState();
  const { ownerTruth, layer, gate, semantics } = runSurface(state);

  ok(
    'late setup contamination after finalized deep completion does not retro-veto current rep',
    state.setupMotionBlocked === true &&
      state.sameRepSetupBlockFirstSeenAfterCompletion === true &&
      ownerTruth.completionOwnerPassed === true &&
      layer.uiGate.uiProgressionAllowed === true &&
      layer.finalPassBlockedReason == null &&
      gate.finalPassEligible === true &&
      semantics.finalPassGranted === true,
    {
      ownerTruth,
      uiProgressionAllowed: layer.uiGate.uiProgressionAllowed,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      sameRepSetupBlockFirstSeenAfterCompletion: state.sameRepSetupBlockFirstSeenAfterCompletion,
    }
  );
  ok(
    'deep same-rep trace records same-rep standard finalize and retro-veto suppression',
    state.sameRepStandardFinalizeEligible === true &&
      state.sameRepStandardFinalizeBlockedReason == null &&
      state.retroVetoSuppressedBySameRepCompletion === true,
    {
      sameRepStandardFinalizeEligible: state.sameRepStandardFinalizeEligible,
      sameRepStandardFinalizeBlockedReason: state.sameRepStandardFinalizeBlockedReason,
      retroVetoSuppressedReason: state.retroVetoSuppressedReason,
    }
  );
}

{
  const blocked = makeFinalizedDeepState({
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'setup_motion_blocked',
    completionFinalizedForSurface: false,
    completionFinalizedOwner: null,
    completionFinalizedEpochId: null,
    completionFinalizedTemporalOrderSatisfied: false,
    completionFinalizedPassReason: null,
    completionFinalizedDescentAtMs: null,
    completionFinalizedPeakAtMs: null,
    completionFinalizedReversalAtMs: null,
    completionFinalizedRecoveryAtMs: null,
    sameRepSetupCleanWithinRepWindow: false,
    sameRepSetupBlockFirstSeenBeforeCommit: true,
    sameRepSetupBlockFirstSeenAfterCompletion: false,
    sameRepStandardFinalizeEligible: false,
    sameRepStandardFinalizeBlockedReason: 'setup_before_commit',
    retroVetoSuppressedBySameRepCompletion: false,
    retroVetoSuppressedReason: null,
  });
  const { ownerTruth, layer, gate, semantics } = runSurface(blocked);

  ok(
    'pre-commit setup contamination deep family stays blocked',
    ownerTruth.completionOwnerPassed === false &&
      ownerTruth.completionOwnerBlockedReason === 'setup_motion_blocked' &&
      layer.finalPassBlockedReason === 'setup_motion_blocked' &&
      gate.finalPassEligible === false &&
      semantics.finalPassGranted === false,
    {
      ownerTruth,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      semantics,
    }
  );
}

{
  const blocked = makeFinalizedDeepState({
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: 'recovery_hold_too_short',
    completionFinalizedForSurface: false,
    completionFinalizedOwner: null,
    completionFinalizedEpochId: null,
    completionFinalizedTemporalOrderSatisfied: false,
    completionFinalizedPassReason: null,
    completionFinalizedDescentAtMs: null,
    completionFinalizedPeakAtMs: null,
    completionFinalizedReversalAtMs: null,
    completionFinalizedRecoveryAtMs: null,
    setupMotionBlocked: false,
    sameRepSetupCleanWithinRepWindow: true,
    sameRepSetupBlockFirstSeenBeforeCommit: false,
    sameRepSetupBlockFirstSeenAfterCompletion: false,
    sameRepStandingRecoveryFinalizeSatisfied: false,
    sameRepRecoveryHoldMs: 60,
    sameRepStandardFinalizeEligible: false,
    sameRepStandardFinalizeBlockedReason: 'recovery_hold_too_short',
    retroVetoSuppressedBySameRepCompletion: false,
    retroVetoSuppressedReason: null,
  });
  const { ownerTruth, layer, gate, semantics } = runSurface(blocked);

  ok(
    'too-short same-rep recovery hold deep family stays blocked',
    ownerTruth.completionOwnerPassed === false &&
      ownerTruth.completionOwnerBlockedReason === 'recovery_hold_too_short' &&
      layer.finalPassBlockedReason === 'recovery_hold_too_short' &&
      gate.finalPassEligible === false &&
      semantics.finalPassGranted === false,
    {
      ownerTruth,
      finalPassBlockedReason: layer.finalPassBlockedReason,
      semantics,
    }
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
