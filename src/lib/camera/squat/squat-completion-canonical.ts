import type {
  SquatCompletionAssistSource,
  SquatCompletionFinalizeMode,
  SquatCompletionState,
} from '../squat-completion-state';
import type { CanonicalShallowCompletionContract } from './shallow-completion-contract';

const SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS = 800;

type ApplyCanonicalShallowClosureFromContractDeps = {
  standardOwnerFloor: number;
  deriveSquatCompletionFinalizeMode: (input: {
    completionSatisfied: boolean;
    eventCyclePromoted: boolean;
    assistSourcesWithoutPromotion: SquatCompletionAssistSource[];
    officialShallowAuthoritativeClosure?: boolean;
  }) => SquatCompletionFinalizeMode;
};

export function buildCanonicalShallowContractInputFromState(s: SquatCompletionState) {
  const rawPeakLatchedAtIndex = s.peakLatchedAtIndex ?? null;

  return {
    relativeDepthPeak: s.relativeDepthPeak ?? 0,
    officialShallowPathCandidate: s.officialShallowPathCandidate === true,
    officialShallowPathAdmitted: s.officialShallowPathAdmitted === true,
    attemptStarted: s.attemptStarted === true,
    descendConfirmed: s.descendConfirmed === true,
    downwardCommitmentReached: s.downwardCommitmentReached === true,
    currentSquatPhase: s.currentSquatPhase,
    completionBlockedReason: s.completionBlockedReason ?? null,
    ownerAuthoritativeReversalSatisfied: s.ownerAuthoritativeReversalSatisfied === true,
    ownerAuthoritativeRecoverySatisfied: s.ownerAuthoritativeRecoverySatisfied === true,
    officialShallowStreamBridgeApplied: s.officialShallowStreamBridgeApplied === true,
    officialShallowAscentEquivalentSatisfied: s.officialShallowAscentEquivalentSatisfied === true,
    officialShallowClosureProofSatisfied: s.officialShallowClosureProofSatisfied === true,
    officialShallowPrimaryDropClosureFallback: s.officialShallowPrimaryDropClosureFallback === true,
    provenanceReversalEvidencePresent: s.provenanceReversalEvidencePresent === true,
    trajectoryReversalRescueApplied: s.trajectoryReversalRescueApplied === true,
    reversalTailBackfillApplied: s.reversalTailBackfillApplied === true,
    ultraShallowMeaningfulDownUpRescueApplied: s.ultraShallowMeaningfulDownUpRescueApplied === true,
    standingFinalizeSatisfied: s.standingFinalizeSatisfied === true,
    standingRecoveryFinalizeReason: s.standingRecoveryFinalizeReason ?? null,
    setupMotionBlocked: s.setupMotionBlocked === true,
    peakLatchedAtIndex: rawPeakLatchedAtIndex,
    descentStartAtMs: s.descendStartAtMs ?? null,
    peakAtMs: s.peakAtMs ?? null,
    reversalAtMs: s.reversalAtMs ?? null,
    standingRecoveredAtMs: s.standingRecoveredAtMs ?? null,
    canonicalTemporalEpochOrderSatisfied: s.canonicalTemporalEpochOrderSatisfied,
    canonicalTemporalEpochOrderBlockedReason: s.canonicalTemporalEpochOrderBlockedReason ?? null,
    evidenceLabel: s.evidenceLabel,
    officialShallowPathClosed: s.officialShallowPathClosed === true,
    guardedShallowTrajectoryClosureProofSatisfied:
      s.guardedShallowTrajectoryClosureProofSatisfied === true,
    completionPassReason: s.completionPassReason ?? undefined,
    minimumCycleDurationSatisfied:
      s.cycleDurationMs != null
        ? s.cycleDurationMs >= SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS
        : undefined,
    baselineFrozen: s.baselineFrozen,
    peakLatched: s.peakLatched,
    eventCycleDetected: s.squatEventCycle?.detected,
    eventCycleHasDescentWeak: s.squatEventCycle?.notes?.includes('descent_weak') ?? false,
    eventCycleDescentFrames: s.squatEventCycle?.descentFrames,
    eventCycleHasFreezeOrLatchMissing:
      s.squatEventCycle?.notes?.includes('freeze_or_latch_missing') ?? false,
    downwardCommitmentDelta: s.downwardCommitmentDelta,
    reversalConfirmedByRuleOrHmm: s.reversalConfirmedByRuleOrHmm,
    squatReversalToStandingMs: s.squatReversalToStandingMs,
  };
}

export function mergeCanonicalShallowContractResult(
  state: SquatCompletionState,
  canonicalShallowContract: CanonicalShallowCompletionContract
): SquatCompletionState {
  return {
    ...state,
    canonicalShallowContractEligible: canonicalShallowContract.eligible,
    canonicalShallowContractAdmissionSatisfied: canonicalShallowContract.admissionSatisfied,
    canonicalShallowContractAttemptSatisfied: canonicalShallowContract.attemptSatisfied,
    canonicalShallowContractReversalEvidenceSatisfied:
      canonicalShallowContract.reversalEvidenceSatisfied,
    canonicalShallowContractRecoveryEvidenceSatisfied:
      canonicalShallowContract.recoveryEvidenceSatisfied,
    canonicalShallowContractAntiFalsePassClear: canonicalShallowContract.antiFalsePassClear,
    canonicalShallowContractSatisfied: canonicalShallowContract.satisfied,
    canonicalShallowContractStage: canonicalShallowContract.stage,
    canonicalShallowContractBlockedReason: canonicalShallowContract.blockedReason,
    canonicalShallowContractAuthoritativeClosureWouldBeSatisfied:
      canonicalShallowContract.authoritativeClosureWouldBeSatisfied,
    canonicalShallowContractProvenanceOnlySignalPresent:
      canonicalShallowContract.provenanceOnlySignalPresent,
    canonicalShallowContractSplitBrainDetected: canonicalShallowContract.splitBrainDetected,
    canonicalShallowContractTrace: canonicalShallowContract.trace,
    canonicalShallowContractClosureSource: canonicalShallowContract.closureSource,
  };
}

export function applyCanonicalShallowClosureFromContract(
  state: SquatCompletionState,
  deps: ApplyCanonicalShallowClosureFromContractDeps
): SquatCompletionState {
  if (state.canonicalShallowContractSatisfied !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.completionPassReason !== 'not_confirmed') {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource:
        state.canonicalShallowContractClosureSource ?? 'none',
    };
  }
  if (!(state.relativeDepthPeak < deps.standardOwnerFloor)) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.officialShallowPathCandidate !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }
  if (state.officialShallowPathAdmitted !== true) {
    return {
      ...state,
      canonicalShallowContractClosureApplied: false,
      canonicalShallowContractClosureSource: 'none',
    };
  }

  const closureSource = state.canonicalShallowContractClosureSource ?? 'canonical_authoritative';

  const completionFinalizeMode = deps.deriveSquatCompletionFinalizeMode({
    completionSatisfied: true,
    eventCyclePromoted: false,
    assistSourcesWithoutPromotion: state.completionAssistSources ?? [],
    officialShallowAuthoritativeClosure: true,
  });

  return {
    ...state,
    completionPassReason: 'official_shallow_cycle',
    completionSatisfied: true,
    completionBlockedReason: null,
    cycleComplete: true,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
    successPhaseAtOpen: 'standing_recovered',
    officialShallowPathClosed: true,
    officialShallowPathBlockedReason: null,
    ownerAuthoritativeShallowClosureSatisfied: true,
    shallowAuthoritativeClosureReason:
      closureSource === 'canonical_guarded_trajectory'
        ? 'canonical_shallow_contract_guarded_trajectory'
        : 'canonical_shallow_contract',
    shallowAuthoritativeClosureBlockedReason: null,
    completionFinalizeMode,
    officialShallowClosureProofSatisfied: true,
    canonicalShallowContractClosureApplied: true,
    canonicalShallowContractClosureSource: closureSource,
  };
}
