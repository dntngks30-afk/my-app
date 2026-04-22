import type { PoseFeaturesFrame } from '../pose-features';
import { deriveSquatCompletionMachinePhase } from '../squat-completion-machine';
import type {
  EvaluateSquatCompletionStateOptions,
  OfficialShallowConsumptionDecision,
  SquatCompletionState,
  SquatEvidenceLabel,
} from '../squat-completion-state';
import type { GuardedShallowLocalPeakAnchor } from './squat-completion-core';
import type {
  ShallowAuthoritativeContractStatus,
  ShallowClosureProofTrace,
  ShallowClosureProofTraceStage,
  ShallowNormalizedBlockerFamily,
  SquatAuthoritativeShallowStage,
} from './squat-completion-debug-types';
import { detectSquatEventCycle, type SquatEventCycleResult } from './squat-event-cycle';
import { deriveSquatOwnerTruthTrace } from './squat-owner-trace';

type ObservabilityDeps = {
  standardOwnerFloor: number;
  reversalDropMinAbs: number;
  mapCompletionBlockedReasonToShallowNormalizedBlockerFamily: (
    completionBlockedReason: string | null,
    completionSatisfied: boolean
  ) => ShallowNormalizedBlockerFamily;
  recoveryMeetsLowRomStyleFinalizeProof: (
    recovery: Pick<SquatCompletionState, 'recoveryReturnContinuityFrames' | 'recoveryDropRatio'>
  ) => boolean;
  getGuardedShallowLocalPeakAnchor: (args: {
    state: SquatCompletionState;
    validFrames: PoseFeaturesFrame[];
  }) => GuardedShallowLocalPeakAnchor;
  ultraLowRomEventPromotionMeetsAscentIntegrity: (
    state: Pick<
      SquatCompletionState,
      | 'relativeDepthPeak'
      | 'evidenceLabel'
      | 'reversalConfirmedAfterDescend'
      | 'recoveryConfirmedAfterReversal'
      | 'ascendConfirmed'
      | 'standingRecoveredAtMs'
      | 'standingRecoveryFinalizeReason'
      | 'squatReversalToStandingMs'
    >
  ) => boolean;
  shallowClosureProofTraceReason:
    typeof import('../squat-completion-state').SHALLOW_CLOSURE_PROOF_TRACE_REASON;
};

type GuardedTrajectoryShallowBridgeOpts = {
  setupMotionBlocked?: boolean;
  guardedShallowLocalPeakAnchor?: GuardedShallowLocalPeakAnchor;
};

const PR_04E3B_NO_EVENT_PROMOTION_BLOCKS = new Set<string>([
  'recovery_hold_too_short',
  'low_rom_standing_finalize_not_satisfied',
  'ultra_low_rom_standing_finalize_not_satisfied',
  'descent_span_too_short',
  'ascent_recovery_span_too_short',
]);

function computeAuthoritativeShallowStageForObservability(
  state: SquatCompletionState,
  deps: ObservabilityDeps
): SquatAuthoritativeShallowStage {
  if (state.completionSatisfied) return 'closed';

  const br = state.completionBlockedReason ?? null;
  if (br === 'not_armed' && !state.attemptStarted) return 'pre_attempt';

  const family = deps.mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(br, false);
  switch (family) {
    case 'admission':
      return 'admission_blocked';
    case 'reversal':
      return 'reversal_blocked';
    case 'standing_finalize':
      return 'standing_finalize_blocked';
    case 'policy':
      return 'policy_blocked';
    case 'closed':
      return 'closed';
    case 'none':
    default:
      return 'policy_blocked';
  }
}

function deriveShallowAuthoritativeContractStatusForPr2(
  state: SquatCompletionState,
  deps: ObservabilityDeps
): ShallowAuthoritativeContractStatus {
  if (state.completionSatisfied) return 'closed';
  if (!state.officialShallowPathCandidate) return 'not_in_shallow_contract';
  if (!state.officialShallowPathAdmitted) return 'admission_blocked';

  const fam = deps.mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
    state.completionBlockedReason ?? null,
    false
  );
  if (fam === 'reversal') return 'reversal_blocked';
  if (fam === 'policy') return 'policy_blocked';
  if (fam === 'standing_finalize') return 'standing_finalize_blocked';
  if (fam === 'admission') return 'admission_blocked';
  if (fam === 'none') return 'standing_finalize_blocked';
  return 'closed';
}

export function attachShallowTruthObservabilityAlign01(
  state: SquatCompletionState,
  deps: ObservabilityDeps
): SquatCompletionState {
  const stamped = state;

  const shallowObservationLayerReversalTruth =
    stamped.committedAtMs != null && stamped.reversalAtMs != null;
  const shallowAuthoritativeReversalTruth = stamped.reversalConfirmedAfterDescend === true;
  const shallowObservationLayerRecoveryTruth =
    stamped.standingRecoveredAtMs != null && stamped.reversalAtMs != null;
  const shallowAuthoritativeRecoveryTruth = stamped.recoveryConfirmedAfterReversal === true;

  const shallowProvenanceOnlyReversalEvidence =
    stamped.trajectoryReversalRescueApplied === true ||
    stamped.reversalTailBackfillApplied === true ||
    stamped.ultraShallowMeaningfulDownUpRescueApplied === true ||
    stamped.officialShallowStreamBridgeApplied === true ||
    stamped.reversalConfirmedBy === 'trajectory';

  const truthMismatch_reversalTopVsCompletion =
    shallowObservationLayerReversalTruth !== shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryTopVsCompletion =
    shallowObservationLayerRecoveryTruth !== shallowAuthoritativeRecoveryTruth;
  const truthMismatch_shallowAdmissionVsClosure =
    stamped.officialShallowPathAdmitted === true &&
    stamped.officialShallowPathClosed !== true &&
    stamped.completionSatisfied !== true;
  const truthMismatch_provenanceReversalWithoutAuthoritative =
    shallowProvenanceOnlyReversalEvidence && !shallowAuthoritativeReversalTruth;
  const truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery =
    stamped.standingRecoveredAtMs != null && !shallowAuthoritativeRecoveryTruth;

  const shallowNormalizedBlockerFamily =
    deps.mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(
      stamped.completionBlockedReason ?? null,
      stamped.completionSatisfied === true
    );
  const shallowAuthoritativeContractStatus = deriveShallowAuthoritativeContractStatusForPr2(
    stamped,
    deps
  );
  const shallowContractAuthoritativeClosure = stamped.officialShallowPathClosed === true;
  const shallowContractAuthorityTrace = [
    stamped.officialShallowPathCandidate ? '1' : '0',
    stamped.officialShallowPathAdmitted ? '1' : '0',
    shallowAuthoritativeReversalTruth ? '1' : '0',
    shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus,
  ].join('|');

  const ownerTrace = deriveSquatOwnerTruthTrace({
    completionSatisfied: stamped.completionSatisfied,
    completionBlockedReason: stamped.completionBlockedReason ?? null,
    eventCyclePromoted: stamped.eventCyclePromoted === true,
    attemptStarted: stamped.attemptStarted === true,
    reversalConfirmedAfterDescend: stamped.reversalConfirmedAfterDescend === true,
    recoveryConfirmedAfterReversal: stamped.recoveryConfirmedAfterReversal === true,
  });

  return {
    ...stamped,
    shallowAuthoritativeStage: computeAuthoritativeShallowStageForObservability(stamped, deps),
    shallowObservationLayerReversalTruth,
    shallowAuthoritativeReversalTruth,
    shallowObservationLayerRecoveryTruth,
    shallowAuthoritativeRecoveryTruth,
    shallowProvenanceOnlyReversalEvidence,
    truthMismatch_reversalTopVsCompletion,
    truthMismatch_recoveryTopVsCompletion,
    truthMismatch_shallowAdmissionVsClosure,
    truthMismatch_provenanceReversalWithoutAuthoritative,
    truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery,
    shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus,
    shallowContractAuthoritativeClosure,
    shallowContractAuthorityTrace,
    ownerTruthSource: ownerTrace.ownerTruthSource,
    ownerTruthStage: ownerTrace.ownerTruthStage,
    ownerTruthBlockedBy: ownerTrace.ownerTruthBlockedBy,
    ownerAuthoritativeReversalSatisfied: stamped.ownerAuthoritativeReversalSatisfied,
    ownerAuthoritativeRecoverySatisfied: stamped.ownerAuthoritativeRecoverySatisfied,
    provenanceReversalEvidencePresent: stamped.provenanceReversalEvidencePresent,
  };
}

function deriveEventCyclePromotionObservability(
  input: {
    canPromote: boolean;
    state: SquatCompletionState;
    squatEventCycle: SquatEventCycleResult;
    ruleBlock: string | null;
    finalizeOk: boolean;
    ultraLowRomEventPromotionAllowed: boolean;
  },
  deps: ObservabilityDeps
): Pick<SquatCompletionState, 'eventCyclePromotionCandidate' | 'eventCyclePromotionBlockedReason'> {
  if (input.canPromote) {
    return {
      eventCyclePromotionCandidate: true,
      eventCyclePromotionBlockedReason: 'event_promotion_owner_disabled',
    };
  }

  const s = input.state;
  const ec = input.squatEventCycle;

  if (s.completionPassReason !== 'not_confirmed') {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'completion_pass_reason_not_pending',
    };
  }
  if (input.ruleBlock == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'no_rule_completion_blocked_reason',
    };
  }
  if (PR_04E3B_NO_EVENT_PROMOTION_BLOCKS.has(input.ruleBlock)) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'rule_block_bars_event_promotion',
    };
  }
  if (!input.finalizeOk) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'standing_finalize_not_satisfied_for_event_gate',
    };
  }
  if (s.standingRecoveredAtMs == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'standing_recovered_timestamp_missing',
    };
  }
  if (!ec.detected) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'event_cycle_not_detected',
    };
  }
  if (ec.band == null) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'event_cycle_band_missing',
    };
  }
  if (!(s.relativeDepthPeak < deps.standardOwnerFloor)) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'relative_depth_not_below_standard_owner_floor',
    };
  }
  if (!input.ultraLowRomEventPromotionAllowed) {
    return {
      eventCyclePromotionCandidate: false,
      eventCyclePromotionBlockedReason: 'ultra_low_rom_event_promotion_gate_blocked',
    };
  }

  return {
    eventCyclePromotionCandidate: false,
    eventCyclePromotionBlockedReason: 'event_promotion_not_eligible',
  };
}

const TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS = new Set<string>([
  'shallow_admission_not_satisfied',
  'no_attempt_descend_or_commitment',
  'peak_not_latched',
  'peak_anchor_at_series_start',
  'outside_shallow_owner_zone',
  'not_armed',
  'no_committed_peak_anchor',
]);

function guardedTrajectoryShallowSignalBlockReason(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts,
  deps: ObservabilityDeps
): string | null {
  if (!state.officialShallowPathCandidate || !state.officialShallowPathAdmitted) {
    return 'shallow_admission_not_satisfied';
  }
  if (!state.attemptStarted || !state.descendConfirmed || !state.downwardCommitmentReached) {
    return 'no_attempt_descend_or_commitment';
  }
  const local = opts.guardedShallowLocalPeakAnchor;
  const localAnchorOk =
    local?.found === true &&
    local.localPeakIndex != null &&
    local.localPeakIndex > 0 &&
    local.localPeakFrame != null;

  if (state.peakLatched !== true) {
    return 'peak_not_latched';
  }
  if (!localAnchorOk) {
    const pli = state.peakLatchedAtIndex;
    if (pli == null || pli <= 0) {
      return 'peak_anchor_at_series_start';
    }
    if (state.peakAnchorTruth !== 'committed_or_post_commit_peak') {
      return 'no_committed_peak_anchor';
    }
  }

  if (state.relativeDepthPeak >= deps.standardOwnerFloor) {
    return 'outside_shallow_owner_zone';
  }

  if (opts.setupMotionBlocked === true) {
    return 'setup_motion_blocked';
  }
  if (state.eventCyclePromoted === true) {
    return 'event_cycle_promoted';
  }
  if (state.currentSquatPhase === 'idle') {
    return 'idle_phase';
  }
  if (state.completionBlockedReason === 'not_armed') {
    return 'not_armed';
  }

  const notes = ec.notes ?? [];
  if (!localAnchorOk && notes.includes('peak_anchor_at_series_start')) {
    return 'peak_anchor_at_series_start';
  }
  if (notes.includes('series_too_short')) {
    return 'series_too_short';
  }

  const standingSidePhase =
    state.currentSquatPhase === 'standing_recovered' || state.currentSquatPhase === 'ascending';
  if (!standingSidePhase && !ec.nearStandingRecovered) {
    return 'bottom_hold_or_incomplete_cycle';
  }

  if (state.trajectoryReversalRescueApplied !== true) {
    return 'no_trajectory_reversal_rescue';
  }
  if (state.reversalEvidenceProvenance !== 'trajectory_anchor_rescue') {
    return 'reversal_provenance_not_trajectory_anchor';
  }

  if (!ec.reversalDetected || !ec.recoveryDetected || !ec.nearStandingRecovered) {
    return 'no_guarded_bridge_evidence';
  }

  const machinePhase = deriveSquatCompletionMachinePhase({
    completionSatisfied: false,
    currentSquatPhase: state.currentSquatPhase,
    downwardCommitmentReached: state.downwardCommitmentReached,
  });
  if (machinePhase !== 'recovered') {
    return 'completion_machine_phase_not_recovered';
  }

  if (state.standingRecoveredAtMs == null) {
    return 'no_recovery_pattern';
  }
  if (state.standingFinalizeSatisfied !== true) {
    return 'no_recovery_pattern';
  }

  const fr = state.standingRecoveryFinalizeReason;
  const finalizeOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    fr === 'low_rom_tail_guarded_finalize';
  if (!finalizeOk) {
    return 'no_recovery_pattern';
  }

  const recoveryProofOk =
    fr === 'standing_hold_met' ||
    deps.recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: state.recoveryReturnContinuityFrames,
      recoveryDropRatio: state.recoveryDropRatio,
    });
  if (!recoveryProofOk) {
    return 'no_recovery_pattern';
  }

  const req = state.squatReversalDropRequired ?? deps.reversalDropMinAbs;
  const minDrop = Math.max(deps.reversalDropMinAbs, req * 0.88) - 1e-12;
  const achieved = state.squatReversalDropAchieved ?? 0;
  if (achieved < minDrop) {
    return 'insufficient_post_peak_return';
  }

  return null;
}

function getGuardedShallowClosureProofFromTrajectoryBridge(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts,
  deps: ObservabilityDeps
): { satisfied: boolean; blockedReason: string | null } {
  const br = guardedTrajectoryShallowSignalBlockReason(state, ec, opts, deps);
  return { satisfied: br === null, blockedReason: br };
}

function getShallowTrajectoryAuthoritativeBridgeDecision(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  opts: GuardedTrajectoryShallowBridgeOpts,
  deps: ObservabilityDeps
): { eligible: boolean; satisfied: boolean; blockedReason: string | null } {
  if (state.completionSatisfied === true) {
    return { eligible: false, satisfied: false, blockedReason: null };
  }

  const br = guardedTrajectoryShallowSignalBlockReason(state, ec, opts, deps);
  if (br === null) {
    return { eligible: true, satisfied: true, blockedReason: null };
  }
  const eligible = !TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS.has(br);
  return { eligible, satisfied: false, blockedReason: br };
}

function mergeShallowTrajectoryAuthoritativeBridge(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  deps: ObservabilityDeps,
  opts?: GuardedTrajectoryShallowBridgeOpts
): SquatCompletionState {
  const dec = getShallowTrajectoryAuthoritativeBridgeDecision(
    state,
    ec,
    {
      setupMotionBlocked: opts?.setupMotionBlocked,
      guardedShallowLocalPeakAnchor: opts?.guardedShallowLocalPeakAnchor,
    },
    deps
  );

  return {
    ...state,
    shallowTrajectoryBridgeEligible: dec.eligible,
    shallowTrajectoryBridgeSatisfied: dec.satisfied,
    shallowTrajectoryBridgeBlockedReason: dec.satisfied ? null : dec.blockedReason,
  };
}

function buildShallowCompletionTicket(
  state: SquatCompletionState,
  ec: SquatEventCycleResult,
  deps: ObservabilityDeps,
  opts: { setupMotionBlocked: boolean }
) {
  const s = state;
  const rel = s.relativeDepthPeak ?? 0;
  const inShallowOwnerZone = rel < deps.standardOwnerFloor;

  const admissionSatisfied =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inShallowOwnerZone;

  const attemptSatisfied = s.attemptStarted === true;
  const descendSatisfied = s.descendConfirmed === true;
  const commitmentSatisfied = s.downwardCommitmentReached === true;

  const machinePhase = deriveSquatCompletionMachinePhase({
    completionSatisfied: false,
    currentSquatPhase: s.currentSquatPhase,
    downwardCommitmentReached: s.downwardCommitmentReached,
  });
  const machinePhaseOk = machinePhase === 'recovered' || machinePhase === 'completed';

  const trajectorySuffixOk =
    s.trajectoryReversalRescueApplied === true &&
    s.reversalEvidenceProvenance === 'trajectory_anchor_rescue';

  const ecSuffixOk =
    ec.reversalDetected === true &&
    ec.recoveryDetected === true &&
    ec.nearStandingRecovered === true;

  const standingTsOk = s.standingRecoveredAtMs != null;

  const fr = s.standingRecoveryFinalizeReason;
  const finalizeReasonOk =
    fr === 'standing_hold_met' ||
    fr === 'low_rom_guarded_finalize' ||
    fr === 'ultra_low_rom_guarded_finalize' ||
    fr === 'low_rom_tail_guarded_finalize';

  const continuityOk = deps.recoveryMeetsLowRomStyleFinalizeProof({
    recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
    recoveryDropRatio: s.recoveryDropRatio,
  });

  const st = s as SquatCompletionState & { standingRecoveryFinalizeSatisfied?: boolean };
  const finalizeBundleOk =
    st.standingRecoveryFinalizeSatisfied === true ||
    finalizeReasonOk ||
    continuityOk ||
    s.standingFinalizeSatisfied === true;

  const recoveryProofOk =
    fr === 'standing_hold_met' ||
    deps.recoveryMeetsLowRomStyleFinalizeProof({
      recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
      recoveryDropRatio: s.recoveryDropRatio,
    });

  const req = s.squatReversalDropRequired ?? deps.reversalDropMinAbs;
  const minDrop = Math.max(deps.reversalDropMinAbs, req * 0.88) - 1e-12;
  const achieved = s.squatReversalDropAchieved ?? 0;
  const postPeakReturnOk = achieved >= minDrop;

  const trajectoryLateSuffixOk =
    machinePhaseOk &&
    trajectorySuffixOk &&
    ecSuffixOk &&
    standingTsOk &&
    finalizeBundleOk &&
    recoveryProofOk &&
    postPeakReturnOk;

  const streamBridgeLateSuffixOk =
    s.officialShallowStreamBridgeApplied === true &&
    machinePhaseOk &&
    ecSuffixOk &&
    standingTsOk &&
    finalizeBundleOk &&
    recoveryProofOk &&
    postPeakReturnOk;

  const lateRecoveredSuffixSatisfied =
    s.guardedShallowRecoveredSuffixSatisfied === true ||
    trajectoryLateSuffixOk ||
    streamBridgeLateSuffixOk;

  const notes = ec.notes ?? [];
  const antiFalsePassGuardsSatisfied =
    opts.setupMotionBlocked !== true &&
    s.eventCyclePromoted !== true &&
    !notes.includes('series_too_short') &&
    !notes.includes('jitter_spike_reject') &&
    s.evidenceLabel !== 'insufficient_signal' &&
    s.completionBlockedReason !== 'no_descend' &&
    s.completionBlockedReason !== 'no_commitment' &&
    s.completionBlockedReason !== 'not_armed' &&
    s.currentSquatPhase !== 'idle';

  const innerSatisfied =
    admissionSatisfied &&
    attemptSatisfied &&
    descendSatisfied &&
    commitmentSatisfied &&
    lateRecoveredSuffixSatisfied &&
    antiFalsePassGuardsSatisfied;

  const eligible =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inShallowOwnerZone &&
    s.completionPassReason === 'not_confirmed' &&
    s.completionSatisfied !== true &&
    s.eventCyclePromoted !== true &&
    opts.setupMotionBlocked !== true;

  let firstFailedStage: string | null = null;
  if (!admissionSatisfied) firstFailedStage = 'admission';
  else if (!attemptSatisfied) firstFailedStage = 'attempt';
  else if (!descendSatisfied) firstFailedStage = 'descend';
  else if (!commitmentSatisfied) firstFailedStage = 'commitment';
  else if (!lateRecoveredSuffixSatisfied) {
    if (
      machinePhaseOk &&
      trajectorySuffixOk &&
      ecSuffixOk &&
      standingTsOk &&
      !finalizeBundleOk
    ) {
      firstFailedStage = 'finalize_bundle';
    } else {
      firstFailedStage = 'late_suffix';
    }
  } else if (!antiFalsePassGuardsSatisfied) firstFailedStage = 'anti_false_pass';

  const satisfied = eligible && innerSatisfied;
  const blockedReason =
    eligible && !innerSatisfied && firstFailedStage != null
      ? `shallow_ticket_${firstFailedStage}`
      : null;

  return {
    eligible,
    satisfied,
    blockedReason,
    admissionSatisfied,
    attemptSatisfied,
    descendSatisfied,
    commitmentSatisfied,
    lateRecoveredSuffixSatisfied,
    antiFalsePassGuardsSatisfied,
    proofSatisfied: satisfied,
    consumptionSatisfied: satisfied,
    firstFailedStage,
  };
}

function firstOfficialShallowConsumptionIneligibilityReason(
  state: SquatCompletionState,
  setupMotionBlocked: boolean,
  deps: ObservabilityDeps
): string | null {
  const T = deps.shallowClosureProofTraceReason;
  if (state.officialShallowPathCandidate !== true) return T.admission_not_reached;
  if (state.officialShallowPathAdmitted !== true) return T.admission_not_admitted;
  if (state.completionSatisfied === true) return null;
  if (state.completionPassReason !== 'not_confirmed') {
    return `${T.consumption_not_eligible}_pass_reason_not_pending`;
  }
  if ((state.relativeDepthPeak ?? 0) >= deps.standardOwnerFloor) {
    return T.outside_shallow_owner_zone;
  }
  if (state.eventCyclePromoted === true) {
    return `${T.consumption_not_eligible}_event_cycle_promoted`;
  }
  if (setupMotionBlocked) {
    return `${T.consumption_not_eligible}_setup_motion_blocked`;
  }
  return null;
}

function mapGuardedClosureBlockToTraceReason(
  blocked: string | null,
  deps: ObservabilityDeps
): string | null {
  if (blocked == null) return null;
  const T = deps.shallowClosureProofTraceReason;
  if (blocked === 'peak_anchor_at_series_start') return T.peak_anchor_at_series_start;
  if (blocked === 'no_committed_peak_anchor' || blocked === 'peak_not_latched') {
    return T.local_peak_missing;
  }
  if (blocked === 'outside_shallow_owner_zone') return T.outside_shallow_owner_zone;
  if (blocked === 'no_recovery_pattern' || blocked === 'insufficient_post_peak_return') {
    return T.trajectory_bridge_no_recovery_pattern;
  }
  if (blocked === 'no_guarded_bridge_evidence' || blocked === 'no_trajectory_reversal_rescue') {
    return T.trajectory_bridge_no_recovery_pattern;
  }
  if (TRAJECTORY_GUARD_ENTRY_BLOCK_REASONS.has(blocked)) {
    return T.trajectory_bridge_not_eligible;
  }
  return blocked;
}

function computeProofLayerBlockedReason(
  s: SquatCompletionState,
  deps: ObservabilityDeps
): string | null {
  const T = deps.shallowClosureProofTraceReason;
  if (s.officialShallowClosureProofSatisfied !== true) return T.proof_closure_bundle_not_satisfied;
  if (s.officialShallowPrimaryDropClosureFallback !== true) return T.proof_primary_drop_not_satisfied;
  if (s.officialShallowReversalSatisfied !== true) return T.proof_reversal_not_satisfied;
  return null;
}

function computeFirstDecisiveShallowProofBlockedReason(
  input: {
    state: SquatCompletionState;
    shallowConsumption: OfficialShallowConsumptionDecision;
    setupMotionBlocked: boolean;
    bridgeEligible: boolean;
    guardedClosureBlockedReason: string | null;
  },
  deps: ObservabilityDeps
): string | null {
  const T = deps.shallowClosureProofTraceReason;
  const s = input.state;
  const c = input.shallowConsumption;

  if (!s.officialShallowPathCandidate) return T.admission_not_reached;
  if (!s.officialShallowPathAdmitted) return T.admission_not_admitted;
  if (!s.attemptStarted || !s.descendConfirmed) return T.no_attempt_or_descend;
  if (!s.downwardCommitmentReached) return T.no_downward_commitment;
  if (s.ruleCompletionBlockedReason === 'not_armed' || s.completionBlockedReason === 'not_armed') {
    return T.not_armed;
  }

  const inel = firstOfficialShallowConsumptionIneligibilityReason(
    s,
    input.setupMotionBlocked,
    deps
  );
  if (inel != null) return inel;

  if (c.eligible && !c.satisfied && c.blockedReason === 'official_shallow_proof_incomplete') {
    const p = computeProofLayerBlockedReason(s, deps);
    return p ?? T.proof_flags_not_set;
  }

  const proofBundleOk =
    s.officialShallowClosureProofSatisfied === true &&
    s.officialShallowPrimaryDropClosureFallback === true &&
    s.officialShallowReversalSatisfied === true;

  if (c.eligible && !c.satisfied && proofBundleOk) {
    return T.proof_synthesized_but_not_consumed;
  }

  if (c.eligible && !c.satisfied && c.blockedReason != null) {
    if (c.blockedReason === 'recovery_finalize_proof_missing') {
      return T.recovered_suffix_no_finalize_bundle;
    }
    if (c.blockedReason === 'recovery_chain_not_satisfied') {
      return T.trajectory_bridge_no_recovery_pattern;
    }
    return `${T.consumption_blocked}:${c.blockedReason}`;
  }

  if (!input.bridgeEligible && input.guardedClosureBlockedReason != null) {
    const mapped = mapGuardedClosureBlockToTraceReason(input.guardedClosureBlockedReason, deps);
    if (mapped != null) return mapped;
  }

  if (
    s.completionBlockedReason === 'no_reversal' &&
    s.officialShallowReversalSatisfied !== true &&
    proofBundleOk
  ) {
    return T.consumption_rejected_by_no_reversal;
  }

  return null;
}

function isShallowClosureProofTraceRelevant(
  s: SquatCompletionState,
  deps: ObservabilityDeps
): boolean {
  const rel = s.relativeDepthPeak ?? 0;
  const shallowObs = (s as { shallowCandidateObserved?: boolean }).shallowCandidateObserved === true;
  return (
    shallowObs ||
    s.officialShallowPathCandidate === true ||
    s.officialShallowPathAdmitted === true ||
    rel < deps.standardOwnerFloor
  );
}

function buildShallowClosureProofTrace(
  input: {
    finalState: SquatCompletionState;
    ec: SquatEventCycleResult;
    localPeakAnchor: GuardedShallowLocalPeakAnchor;
    bridgeDecisionPreMerge: { eligible: boolean; satisfied: boolean; blockedReason: string | null };
    shallowConsumption: OfficialShallowConsumptionDecision;
    setupMotionBlocked: boolean;
    recoveredSuffixApply: boolean;
  },
  deps: ObservabilityDeps
): ShallowClosureProofTrace {
  const T = deps.shallowClosureProofTraceReason;
  const s = input.finalState;
  const ec = input.ec;
  const rel = s.relativeDepthPeak ?? 0;
  const inZone = rel < deps.standardOwnerFloor;
  const guardedSatisfied = s.guardedShallowTrajectoryClosureProofSatisfied === true;
  const guardedBlocked = s.guardedShallowTrajectoryClosureProofBlockedReason ?? null;

  const stFin = s as SquatCompletionState & {
    standingRecoveryFinalizeSatisfied?: boolean;
    standingRecoveryFinalizeBand?: SquatEvidenceLabel;
  };
  const finalizeSatisfied = stFin.standingRecoveryFinalizeSatisfied === true;
  const finalizeBand = stFin.standingRecoveryFinalizeBand ?? s.standingRecoveryBand ?? null;

  const continuityOk = deps.recoveryMeetsLowRomStyleFinalizeProof({
    recoveryReturnContinuityFrames: s.recoveryReturnContinuityFrames,
    recoveryDropRatio: s.recoveryDropRatio,
  });

  const recoveredSuffixEligible =
    s.officialShallowPathCandidate === true &&
    s.officialShallowPathAdmitted === true &&
    inZone &&
    s.attemptStarted === true &&
    s.descendConfirmed === true &&
    s.downwardCommitmentReached === true;

  let recoveredSuffixBlockedSummary: string | null = null;
  if (recoveredSuffixEligible && !input.recoveredSuffixApply) {
    recoveredSuffixBlockedSummary = T.recovered_suffix_not_eligible;
  } else if (
    recoveredSuffixEligible &&
    input.recoveredSuffixApply &&
    s.guardedShallowRecoveredSuffixSatisfied !== true
  ) {
    recoveredSuffixBlockedSummary =
      s.guardedShallowRecoveredSuffixBlockedReason ?? T.recovered_suffix_no_finalize_bundle;
  }

  const proofBlockedReason = computeProofLayerBlockedReason(s, deps);
  const ineligibilityFirst = firstOfficialShallowConsumptionIneligibilityReason(
    s,
    input.setupMotionBlocked,
    deps
  );

  const bridgeBlockedTrace =
    input.bridgeDecisionPreMerge.satisfied
      ? null
      : mapGuardedClosureBlockToTraceReason(input.bridgeDecisionPreMerge.blockedReason, deps) ??
        input.bridgeDecisionPreMerge.blockedReason;

  const stage: ShallowClosureProofTraceStage = (() => {
    if (!s.officialShallowPathCandidate) return 'pre_admission';
    if (!s.officialShallowPathAdmitted) return 'pre_admission';
    if (!input.bridgeDecisionPreMerge.eligible && inZone) return 'bridge';
    if (input.shallowConsumption.eligible && !input.shallowConsumption.satisfied) {
      if (input.shallowConsumption.blockedReason === 'official_shallow_proof_incomplete') {
        return 'proof';
      }
      if (
        input.shallowConsumption.blockedReason === 'recovery_finalize_proof_missing' ||
        input.shallowConsumption.blockedReason === 'recovery_chain_not_satisfied'
      ) {
        return 'suffix';
      }
      return 'consumption';
    }
    if (proofBlockedReason != null && ineligibilityFirst == null) return 'proof';
    return input.shallowConsumption.satisfied ? 'consumption' : 'admitted';
  })();

  const firstDecisive = computeFirstDecisiveShallowProofBlockedReason(
    {
      state: s,
      shallowConsumption: input.shallowConsumption,
      setupMotionBlocked: input.setupMotionBlocked,
      bridgeEligible: input.bridgeDecisionPreMerge.eligible,
      guardedClosureBlockedReason: guardedBlocked,
    },
    deps
  );

  const topBlocked =
    firstDecisive ??
    proofBlockedReason ??
    (input.shallowConsumption.eligible ? input.shallowConsumption.blockedReason : ineligibilityFirst);

  const topSatisfied = input.shallowConsumption.satisfied === true;
  const topEligible =
    ineligibilityFirst == null &&
    (input.shallowConsumption.eligible || s.completionSatisfied === true);

  return {
    stage,
    eligible: topEligible,
    satisfied: topSatisfied,
    blockedReason: topSatisfied ? null : topBlocked,
    firstDecisiveBlockedReason: firstDecisive,
    proofBlockedReason,
    consumptionBlockedReason: input.shallowConsumption.eligible
      ? input.shallowConsumption.blockedReason
      : ineligibilityFirst,
    admission: {
      candidate: s.officialShallowPathCandidate === true,
      admitted: s.officialShallowPathAdmitted === true,
      relativeDepthPeak: rel,
      inShallowOwnerZone: inZone,
    },
    attempt: {
      attemptStarted: s.attemptStarted === true,
      descendConfirmed: s.descendConfirmed === true,
      downwardCommitmentReached: s.downwardCommitmentReached === true,
      armedLike:
        s.attemptStarted === true &&
        s.completionBlockedReason !== 'not_armed' &&
        s.ruleCompletionBlockedReason !== 'not_armed',
    },
    peak: {
      peakLatched: s.peakLatched === true,
      peakLatchedAtIndex: s.peakLatchedAtIndex ?? null,
      peakAnchorTruth: s.peakAnchorTruth ?? null,
      localPeakFound: input.localPeakAnchor.found,
      localPeakIndex: input.localPeakAnchor.localPeakIndex,
      localPeakBlockedReason: input.localPeakAnchor.found
        ? null
        : input.localPeakAnchor.blockedReason,
    },
    bridge: {
      trajectoryRescue: s.trajectoryReversalRescueApplied === true,
      provenance: s.reversalEvidenceProvenance ?? null,
      eventCycleDetected: ec.detected === true,
      reversalDetected: ec.reversalDetected === true,
      recoveryDetected: ec.recoveryDetected === true,
      nearStandingRecovered: ec.nearStandingRecovered === true,
      eventCycleNotes: ec.notes != null ? [...ec.notes] : [],
      eligible: input.bridgeDecisionPreMerge.eligible,
      satisfied: input.bridgeDecisionPreMerge.satisfied,
      bridgeBlockedReason: bridgeBlockedTrace,
      guardedClosureProofSatisfied: guardedSatisfied,
      guardedClosureProofBlockedReason: guardedBlocked,
    },
    suffix: {
      completionMachinePhase: s.completionMachinePhase ?? null,
      recoveryConfirmedAfterReversal: s.recoveryConfirmedAfterReversal === true,
      standingRecoveredAtMs: s.standingRecoveredAtMs ?? null,
      finalizeSatisfied,
      finalizeReason: s.standingRecoveryFinalizeReason ?? null,
      finalizeBand,
      continuityOk,
      recoveredSuffixEligible,
      recoveredSuffixSatisfied: s.guardedShallowRecoveredSuffixSatisfied === true,
      recoveredSuffixBlockedReason: s.guardedShallowRecoveredSuffixBlockedReason ?? null,
      recoveredSuffixEvaluatorApplied: input.recoveredSuffixApply === true,
      recoveredSuffixBlockedSummary,
    },
    proof: {
      officialShallowReversalSatisfied: s.officialShallowReversalSatisfied === true,
      officialShallowClosureProofSatisfied: s.officialShallowClosureProofSatisfied === true,
      officialShallowPrimaryDropClosureFallback: s.officialShallowPrimaryDropClosureFallback === true,
      guardedTrajectoryClosureProofSatisfied: guardedSatisfied,
      guardedRecoveredSuffixSatisfied: s.guardedShallowRecoveredSuffixSatisfied === true,
      proofBlockedReason,
    },
    consumption: {
      eligible: input.shallowConsumption.eligible,
      satisfied: input.shallowConsumption.satisfied,
      blockedReason: input.shallowConsumption.blockedReason,
      ineligibilityFirstReason: ineligibilityFirst,
      completionPassReason: s.completionPassReason ?? null,
      completionBlockedReason: s.completionBlockedReason ?? null,
      completionSatisfied: s.completionSatisfied === true,
    },
  };
}

export function stampPreCanonicalObservability(
  state: SquatCompletionState,
  frames: PoseFeaturesFrame[],
  options: EvaluateSquatCompletionStateOptions | undefined,
  deps: ObservabilityDeps
): SquatCompletionState {
  const validForEventFrames =
    state.officialShallowPreferredPrefixFrameCount != null
      ? frames.slice(0, state.officialShallowPreferredPrefixFrameCount)
      : frames;
  const validForEvent = validForEventFrames.filter((f) => f.isValid);
  const squatEventCycle = detectSquatEventCycle(validForEvent, {
    hmm: options?.hmm ?? undefined,
    baselineFrozenDepth: state.baselineFrozenDepth ?? state.baselineStandingDepth,
    lockedSource: state.relativeDepthPeakSource ?? null,
    baselineFrozen: state.baselineFrozen === true,
    peakLatched: state.peakLatched === true,
    peakLatchedAtIndex: state.peakLatchedAtIndex ?? null,
  });

  state = { ...state, squatEventCycle };

  const localPeakAnchor = deps.getGuardedShallowLocalPeakAnchor({
    state,
    validFrames: validForEvent,
  });
  const shallowLocalPeakObsEligible =
    state.officialShallowPathCandidate === true &&
    state.officialShallowPathAdmitted === true &&
    state.attemptStarted === true &&
    state.descendConfirmed === true &&
    state.downwardCommitmentReached === true;

  const bridgeOpts: GuardedTrajectoryShallowBridgeOpts = {
    setupMotionBlocked: options?.setupMotionBlocked,
    guardedShallowLocalPeakAnchor: localPeakAnchor,
  };

  const guardedClosureProof = getGuardedShallowClosureProofFromTrajectoryBridge(
    state,
    squatEventCycle,
    bridgeOpts,
    deps
  );

  state = {
    ...state,
    guardedShallowTrajectoryClosureProofSatisfied: guardedClosureProof.satisfied,
    guardedShallowTrajectoryClosureProofBlockedReason: guardedClosureProof.satisfied
      ? null
      : guardedClosureProof.blockedReason,
  };

  if (shallowLocalPeakObsEligible) {
    state = {
      ...state,
      guardedShallowLocalPeakFound: localPeakAnchor.found,
      guardedShallowLocalPeakBlockedReason: localPeakAnchor.found
        ? null
        : localPeakAnchor.blockedReason,
      guardedShallowLocalPeakIndex: localPeakAnchor.localPeakIndex,
      guardedShallowLocalPeakAtMs: localPeakAnchor.localPeakAtMs,
    };
  }

  const stateBeforeMerge = state;
  const bridgeDecisionPreMerge = getShallowTrajectoryAuthoritativeBridgeDecision(
    stateBeforeMerge,
    squatEventCycle,
    bridgeOpts,
    deps
  );

  state = mergeShallowTrajectoryAuthoritativeBridge(state, squatEventCycle, deps, bridgeOpts);

  const setupMotionBlockedFlag = options?.setupMotionBlocked === true;
  const shallowCompletionTicket = buildShallowCompletionTicket(state, squatEventCycle, deps, {
    setupMotionBlocked: setupMotionBlockedFlag,
  });

  if (shallowCompletionTicket.eligible && shallowCompletionTicket.satisfied) {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: true,
      shallowCompletionTicketBlockedReason: null,
      shallowCompletionTicketStage: null,
    };
  } else if (shallowCompletionTicket.eligible && !shallowCompletionTicket.satisfied) {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: false,
      shallowCompletionTicketBlockedReason: shallowCompletionTicket.blockedReason,
      shallowCompletionTicketStage: shallowCompletionTicket.firstFailedStage ?? null,
    };
  } else {
    state = {
      ...state,
      shallowCompletionTicket,
      shallowCompletionTicketSatisfied: false,
      shallowCompletionTicketBlockedReason: null,
      shallowCompletionTicketStage: null,
    };
  }

  const shallowConsumption: OfficialShallowConsumptionDecision = {
    eligible: shallowCompletionTicket.eligible,
    satisfied: shallowCompletionTicket.eligible && shallowCompletionTicket.satisfied,
    blockedReason:
      shallowCompletionTicket.eligible && !shallowCompletionTicket.satisfied
        ? shallowCompletionTicket.blockedReason
        : null,
  };

  const ruleBlock = state.ruleCompletionBlockedReason ?? null;
  const finalizeOk =
    state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
    state.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
    state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize';

  const ultraLowRomEventCandidate =
    squatEventCycle.detected && squatEventCycle.band === 'ultra_low_rom';

  const ultraLowRomEventPromotionAllowed =
    !ultraLowRomEventCandidate ||
    state.evidenceLabel !== 'ultra_low_rom' ||
    deps.ultraLowRomEventPromotionMeetsAscentIntegrity(state);

  const canEventPromote =
    state.completionPassReason === 'not_confirmed' &&
    ruleBlock != null &&
    !PR_04E3B_NO_EVENT_PROMOTION_BLOCKS.has(ruleBlock) &&
    finalizeOk &&
    state.standingRecoveredAtMs != null &&
    squatEventCycle.detected &&
    squatEventCycle.band != null &&
    state.relativeDepthPeak < deps.standardOwnerFloor &&
    ultraLowRomEventPromotionAllowed;

  const promoObs = deriveEventCyclePromotionObservability(
    {
      canPromote: canEventPromote,
      state,
      squatEventCycle,
      ruleBlock,
      finalizeOk,
      ultraLowRomEventPromotionAllowed,
    },
    deps
  );

  const shallowClosureProofTrace = isShallowClosureProofTraceRelevant(state, deps)
    ? buildShallowClosureProofTrace(
        {
          finalState: state,
          ec: squatEventCycle,
          localPeakAnchor,
          bridgeDecisionPreMerge,
          shallowConsumption,
          setupMotionBlocked: options?.setupMotionBlocked === true,
          recoveredSuffixApply: options?.guardedShallowRecoveredSuffixClosureApply === true,
        },
        deps
      )
    : undefined;

  return {
    ...state,
    eventCyclePromotionCandidate: promoObs.eventCyclePromotionCandidate,
    eventCyclePromotionBlockedReason: promoObs.eventCyclePromotionBlockedReason,
    eventCyclePromoted: false,
    ...(shallowClosureProofTrace != null ? { shallowClosureProofTrace } : {}),
  };
}
