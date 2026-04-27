/**
 * RF09 boundary cleanup: type-only shallow completion debug surface.
 *
 * Keep these debug/compat contracts out of the runtime host facade so external
 * consumers do not need to import `squat-completion-state.ts` just for trace types.
 */

export type SquatAuthoritativeShallowStage =
  | 'pre_attempt'
  | 'admission_blocked'
  | 'reversal_blocked'
  | 'policy_blocked'
  | 'standing_finalize_blocked'
  | 'closed';

export type ShallowNormalizedBlockerFamily =
  | 'admission'
  | 'reversal'
  | 'policy'
  | 'standing_finalize'
  | 'closed'
  | 'none';

export type ShallowAuthoritativeContractStatus =
  | 'not_in_shallow_contract'
  | 'admission_blocked'
  | 'reversal_blocked'
  | 'policy_blocked'
  | 'standing_finalize_blocked'
  | 'closed';

export type ShallowClosureProofTraceStage =
  | 'pre_admission'
  | 'admitted'
  | 'bridge'
  | 'suffix'
  | 'proof'
  | 'consumption';

export type ShallowCompletionTicket = {
  eligible: boolean;
  satisfied: boolean;
  blockedReason: string | null;
  admissionSatisfied: boolean;
  attemptSatisfied: boolean;
  descendSatisfied: boolean;
  commitmentSatisfied: boolean;
  lateRecoveredSuffixSatisfied: boolean;
  antiFalsePassGuardsSatisfied: boolean;
  proofSatisfied: boolean;
  consumptionSatisfied: boolean;
  firstFailedStage?: string | null;
};

export type ShallowClosureProofTrace = {
  stage: ShallowClosureProofTraceStage;
  eligible: boolean;
  satisfied: boolean;
  blockedReason: string | null;
  firstDecisiveBlockedReason: string | null;
  proofBlockedReason: string | null;
  consumptionBlockedReason: string | null;

  admission: {
    candidate: boolean;
    admitted: boolean;
    relativeDepthPeak: number;
    inShallowOwnerZone: boolean;
  };

  attempt: {
    attemptStarted: boolean;
    descendConfirmed: boolean;
    downwardCommitmentReached: boolean;
    armedLike: boolean;
  };

  peak: {
    peakLatched: boolean;
    peakLatchedAtIndex: number | null;
    peakAnchorTruth: string | null;
    localPeakFound: boolean;
    localPeakIndex: number | null;
    localPeakBlockedReason: string | null;
  };

  bridge: {
    trajectoryRescue: boolean;
    provenance: string | null;
    eventCycleDetected: boolean;
    reversalDetected: boolean;
    recoveryDetected: boolean;
    nearStandingRecovered: boolean;
    eventCycleNotes: string[];
    eligible: boolean;
    satisfied: boolean;
    bridgeBlockedReason: string | null;
    guardedClosureProofSatisfied: boolean;
    guardedClosureProofBlockedReason: string | null;
  };

  suffix: {
    completionMachinePhase: string | null;
    recoveryConfirmedAfterReversal: boolean;
    standingRecoveredAtMs: number | null;
    finalizeSatisfied: boolean;
    finalizeReason: string | null;
    finalizeBand: string | null;
    continuityOk: boolean;
    recoveredSuffixEligible: boolean;
    recoveredSuffixSatisfied: boolean;
    recoveredSuffixBlockedReason: string | null;
    recoveredSuffixEvaluatorApplied: boolean;
    recoveredSuffixBlockedSummary: string | null;
  };

  proof: {
    officialShallowReversalSatisfied: boolean;
    officialShallowClosureProofSatisfied: boolean;
    officialShallowPrimaryDropClosureFallback: boolean;
    guardedTrajectoryClosureProofSatisfied: boolean;
    guardedRecoveredSuffixSatisfied: boolean;
    proofBlockedReason: string | null;
  };

  consumption: {
    eligible: boolean;
    satisfied: boolean;
    blockedReason: string | null;
    ineligibilityFirstReason: string | null;
    completionPassReason: string | null;
    completionBlockedReason: string | null;
    completionSatisfied: boolean;
  };
};

/**
 * Descent timing + ledger peak/reversal/recovery source literals — mirrors
 * `squat-completion-core` (CanonicalTemporalEpoch). No catch-all `string`.
 */
export type DescentTimingEpochSource =
  | 'phase_hint_descent'
  | 'trajectory_descent_start'
  | 'shared_descent_epoch'
  | 'legitimate_kinematic_shallow_descent_onset'
  | 'pre_arming_kinematic_descent_epoch';

export type CanonicalTemporalEpochSource =
  | DescentTimingEpochSource
  | 'completion_core_peak'
  | 'rule_or_hmm_reversal_epoch'
  | 'standing_recovery_finalize_epoch';
