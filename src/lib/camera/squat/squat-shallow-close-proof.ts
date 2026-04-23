/**
 * PR-X2-B — Shallow Close Proof Repair.
 *
 * This module is the single owner of the "valid shallow cycle truth ->
 * shallow close proof -> completion_truth_shallow" step. Parent SSOT:
 * `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`.
 *
 * ## Scope
 * - Close the `Case A` family from the parent SSOT: reps that already satisfy
 *   attemptStarted + descendConfirmed + reversalConfirmedAfterDescend +
 *   recoveryConfirmedAfterReversal + officialShallowPathAdmitted +
 *   officialShallowReversalSatisfied + officialShallowAscentEquivalentSatisfied
 *   but still die with `shallow_descent_too_short` because the evaluator-level
 *   shallow gate is reusing the standard descent-span length as a veto.
 * - Produce a structured decision from cycle-order truth alone. No new
 *   thresholds and no new relaxation of the shallow observation band.
 * - Do NOT own final pass. Final pass owner remains `completion`.
 * - Do NOT redesign acquisition. PR-X2-A's fourth arming path and trace
 *   surface are preserved as-is.
 *
 * ## Contract — when may shallow close be granted by cycle order?
 * All of the following must hold on the same rep:
 * - `officialShallowPathAdmitted === true`
 * - `relativeDepthPeak` in the shallow band (below `STANDARD_OWNER_FLOOR`)
 * - `attemptStarted === true`, `descendConfirmed === true`,
 *   `downwardCommitmentReached === true`
 * - `reversalConfirmedAfterDescend === true`
 * - `reversalConfirmedByRuleOrHmm === true` — this is the primary jitter /
 *   fake-peak rejection. Trajectory-only or provenance-only reversals do NOT
 *   satisfy this gate.
 * - `recoveryConfirmedAfterReversal === true`
 * - `officialShallowReversalSatisfied === true`
 * - `officialShallowAscentEquivalentSatisfied === true`
 * - `canonicalTemporalEpochOrderSatisfied === true`
 * - setup clean (`setupMotionBlocked !== true`)
 * - readiness stable (`readinessStableDwellSatisfied !== false`)
 * - no eventCyclePromoted short-circuit (`eventCyclePromoted !== true`)
 * - `trajectoryReversalRescueApplied !== true` — mirrors canonical contract's
 *   anti-false-pass rule.
 *
 * ## Hard-reject band (never grant)
 * - setup-blocked, readiness-unstable, no-reversal, no-recovery, no rule/HMM
 *   reversal (trajectory-only), missing temporal order, static standing only,
 *   standard/deep band, trajectory rescue applied.
 *
 * ## Consumption point
 * `src/lib/camera/evaluators/squat-meaningful-shallow.ts` calls this helper
 * right before the `shallow_descent_too_short` gate fires and, when the
 * proof is satisfied, skips **only** that one gate. Every other gate
 * (phase, reversal-to-standing span, current-rep ownership, primary-depth
 * floor, official closure proof, ultra-low policy) stays intact.
 */

import type { SquatCompletionState } from '@/lib/camera/squat-completion-state';

/** Shallow band upper bound — mirrors the `STANDARD_OWNER_FLOOR` constant
 *  used by `squat-meaningful-shallow.ts`. Kept local to avoid coupling. */
const SHALLOW_CLOSE_PROOF_STANDARD_OWNER_FLOOR = 0.4;

export type ShallowCycleCloseProofBlockedReason =
  | null
  | 'same_rep_window_missing'
  | 'same_rep_window_mixed_or_stale'
  | 'not_admitted'
  | 'standard_or_deep_band'
  | 'attempt_not_started'
  | 'descend_not_confirmed'
  | 'reversal_not_confirmed'
  | 'reversal_provenance_insufficient'
  | 'recovery_not_confirmed'
  | 'shallow_reversal_not_satisfied'
  | 'ascent_equivalent_not_satisfied'
  | 'stream_bridge_not_satisfied'
  | 'temporal_order_not_satisfied'
  | 'setup_blocked'
  | 'setup_before_commit'
  | 'setup_within_rep_window'
  | 'readiness_unstable'
  | 'event_cycle_short_circuit'
  | 'trajectory_rescue_applied';

export type ShallowCycleCloseProofReason =
  | null
  | 'shallow_cycle_order_proved';

export type ShallowCycleCloseProofObservationStage =
  | 'not_evaluated'
  | 'pre_admission'
  | 'admitted_without_reversal'
  | 'reversal_without_recovery'
  | 'recovery_without_ascent_equivalent'
  | 'cycle_complete_but_blocked'
  | 'shallow_cycle_close_proof_candidate';

export interface ShallowCycleCloseProofGates {
  sameRepWindowPresent: boolean;
  admitted: boolean;
  shallowBand: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  reversalConfirmed: boolean;
  reversalByRuleOrHmm: boolean;
  recoveryConfirmed: boolean;
  shallowReversalSatisfied: boolean;
  ascentEquivalentSatisfied: boolean;
  streamBridgeSatisfied: boolean;
  temporalOrderSatisfied: boolean;
  setupClean: boolean;
  readinessStable: boolean;
  noEventCycleShortCircuit: boolean;
  noTrajectoryRescue: boolean;
}

export interface ShallowCycleCloseProofDecision {
  /** True when cycle-order truth alone is sufficient to grant shallow close
   *  (i.e. the `shallow_descent_too_short` gate may be bypassed). */
  cycleCloseProofSatisfied: boolean;
  /** `'shallow_cycle_order_proved'` when satisfied, otherwise null. */
  cycleCloseProofReason: ShallowCycleCloseProofReason;
  /** Null when satisfied, otherwise the single earliest blocking gate. */
  cycleCloseProofBlockedReason: ShallowCycleCloseProofBlockedReason;
  /** Diagnostic stage summary used by trace builders. */
  observationStage: ShallowCycleCloseProofObservationStage;
  /** Full gate-by-gate breakdown. */
  gates: ShallowCycleCloseProofGates;
  /** Trace-compact notes. */
  notes: string[];
}

function readSameRepShallowCloseTruth(
  state: SquatCompletionState
): {
  present: boolean;
  admitted: boolean;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  reversalConfirmed: boolean;
  reversalByRuleOrHmm: boolean;
  recoveryConfirmed: boolean;
  shallowReversalSatisfied: boolean;
  ascentEquivalentSatisfied: boolean;
  streamBridgeSatisfied: boolean;
  temporalOrderSatisfied: boolean;
  setupClean: boolean;
  setupBeforeCommit: boolean;
  sameRepWindowMixedOrStale: boolean;
  shallowBand: boolean;
  noTrajectoryRescue: boolean;
  eligible: boolean;
  blockedReason: string | null;
} | null {
  const payload = state.sameRepCompletionWindow ?? null;
  const hasFlatPayload =
    state.sameRepCompletionWindowPresent !== undefined ||
    state.sameRepShallowCloseEligible !== undefined ||
    state.sameRepShallowCloseBlockedReason !== undefined;
  if (payload == null && !hasFlatPayload) return null;

  const relativeDepthPeak = payload?.relativeDepthPeak ?? state.relativeDepthPeak ?? 0;
  return {
    present:
      payload?.sameRepCompletionWindowPresent ??
      (state.sameRepCompletionWindowPresent === true),
    admitted:
      payload?.officialShallowPathAdmitted ??
      (state.officialShallowPathAdmitted === true),
    attemptStarted: payload?.attemptStarted ?? (state.attemptStarted === true),
    descendConfirmed: state.descendConfirmed === true && state.downwardCommitmentReached === true,
    reversalConfirmed:
      payload?.reversalConfirmedAfterDescend ??
      (state.reversalConfirmedAfterDescend === true),
    reversalByRuleOrHmm:
      payload?.reversalConfirmedByRuleOrHmm ??
      (state.reversalConfirmedByRuleOrHmm === true),
    recoveryConfirmed:
      payload?.recoveryConfirmedAfterReversal ??
      (state.recoveryConfirmedAfterReversal === true),
    shallowReversalSatisfied:
      payload?.officialShallowReversalSatisfied ??
      (state.officialShallowReversalSatisfied === true),
    ascentEquivalentSatisfied:
      payload?.officialShallowAscentEquivalentSatisfied ??
      (state.officialShallowAscentEquivalentSatisfied === true),
    streamBridgeSatisfied:
      payload?.officialShallowStreamBridgeApplied ??
      (state.officialShallowStreamBridgeApplied === true),
    temporalOrderSatisfied:
      payload?.canonicalTemporalEpochOrderSatisfied ??
      (state.canonicalTemporalEpochOrderSatisfied === true),
    setupClean:
      payload?.sameRepSetupCleanWithinRepWindow ??
      (state.sameRepSetupCleanWithinRepWindow ?? state.setupMotionBlocked !== true),
    setupBeforeCommit:
      payload?.sameRepSetupBlockFirstSeenBeforeCommit ??
      (state.sameRepSetupBlockFirstSeenBeforeCommit === true),
    sameRepWindowMixedOrStale:
      payload?.sameRepCompletionWindowMixedOrStale ??
      (state.sameRepCompletionWindowMixedOrStale === true),
    shallowBand:
      typeof relativeDepthPeak === 'number' &&
      relativeDepthPeak > 0 &&
      relativeDepthPeak < SHALLOW_CLOSE_PROOF_STANDARD_OWNER_FLOOR,
    noTrajectoryRescue:
      (payload?.trajectoryReversalRescueApplied ?? state.trajectoryReversalRescueApplied) !== true,
    eligible:
      payload?.sameRepShallowCloseEligible ?? (state.sameRepShallowCloseEligible === true),
    blockedReason:
      payload?.sameRepShallowCloseBlockedReason ?? state.sameRepShallowCloseBlockedReason ?? null,
  };
}

/**
 * PR-X2-B — main entry.
 *
 * Pure function over `SquatCompletionState`. Never mutates state, never
 * consults thresholds, never looks at descent-span length.
 */
export function computeShallowCycleCloseProofDecision(
  state: SquatCompletionState | null | undefined
): ShallowCycleCloseProofDecision {
  const notes: string[] = [];

  if (state == null) {
    return {
      cycleCloseProofSatisfied: false,
      cycleCloseProofReason: null,
      cycleCloseProofBlockedReason: 'not_admitted',
      observationStage: 'not_evaluated',
      gates: {
        sameRepWindowPresent: false,
        admitted: false,
        shallowBand: false,
        attemptStarted: false,
        descendConfirmed: false,
        reversalConfirmed: false,
        reversalByRuleOrHmm: false,
        recoveryConfirmed: false,
        shallowReversalSatisfied: false,
        ascentEquivalentSatisfied: false,
        streamBridgeSatisfied: false,
        temporalOrderSatisfied: false,
        setupClean: false,
        readinessStable: false,
        noEventCycleShortCircuit: false,
        noTrajectoryRescue: false,
      },
      notes: ['state_missing'],
    };
  }

  const sameRep = readSameRepShallowCloseTruth(state);
  const admitted = sameRep?.admitted ?? (state.officialShallowPathAdmitted === true);
  const shallowBand =
    sameRep?.shallowBand ??
    (typeof state.relativeDepthPeak === 'number' &&
      state.relativeDepthPeak > 0 &&
      state.relativeDepthPeak < SHALLOW_CLOSE_PROOF_STANDARD_OWNER_FLOOR);
  const attemptStarted = sameRep?.attemptStarted ?? (state.attemptStarted === true);
  const descendConfirmed =
    sameRep?.descendConfirmed ??
    (state.descendConfirmed === true && state.downwardCommitmentReached === true);
  const reversalConfirmed =
    sameRep?.reversalConfirmed ?? (state.reversalConfirmedAfterDescend === true);
  const reversalByRuleOrHmm =
    sameRep?.reversalByRuleOrHmm ?? (state.reversalConfirmedByRuleOrHmm === true);
  const recoveryConfirmed =
    sameRep?.recoveryConfirmed ?? (state.recoveryConfirmedAfterReversal === true);
  const shallowReversalSatisfied =
    sameRep?.shallowReversalSatisfied ?? (state.officialShallowReversalSatisfied === true);
  const ascentEquivalentSatisfied =
    sameRep?.ascentEquivalentSatisfied ??
    (state.officialShallowAscentEquivalentSatisfied === true);
  const streamBridgeSatisfied =
    sameRep != null
      ? sameRep.streamBridgeSatisfied
      : true;
  const temporalOrderSatisfied =
    sameRep?.temporalOrderSatisfied ?? (state.canonicalTemporalEpochOrderSatisfied === true);
  const setupClean =
    sameRep?.setupClean ?? (state.setupMotionBlocked !== true);
  const readinessStable = state.readinessStableDwellSatisfied !== false;
  const noEventCycleShortCircuit = state.eventCyclePromoted !== true;
  const noTrajectoryRescue =
    sameRep?.noTrajectoryRescue ?? (state.trajectoryReversalRescueApplied !== true);

  const gates: ShallowCycleCloseProofGates = {
    sameRepWindowPresent: sameRep?.present ?? false,
    admitted,
    shallowBand,
    attemptStarted,
    descendConfirmed,
    reversalConfirmed,
    reversalByRuleOrHmm,
    recoveryConfirmed,
    shallowReversalSatisfied,
    ascentEquivalentSatisfied,
    streamBridgeSatisfied,
    temporalOrderSatisfied,
    setupClean,
    readinessStable,
    noEventCycleShortCircuit,
    noTrajectoryRescue,
  };

  /**
   * Resolve the earliest canonical blocker. Order matters — this gives
   * traces a single reason instead of the fan of causes that
   * `shallow_descent_too_short` collapses on this family today.
   */
  let blockedReason: ShallowCycleCloseProofBlockedReason = null;
  if (sameRep?.present === false) blockedReason = 'same_rep_window_missing';
  else if (sameRep?.sameRepWindowMixedOrStale === true) blockedReason = 'same_rep_window_mixed_or_stale';
  else if (!setupClean) {
    blockedReason =
      sameRep == null
        ? 'setup_blocked'
        : sameRep.setupBeforeCommit
        ? 'setup_before_commit'
        : 'setup_within_rep_window';
  }
  else if (!readinessStable) blockedReason = 'readiness_unstable';
  else if (!admitted) blockedReason = 'not_admitted';
  else if (!shallowBand) blockedReason = 'standard_or_deep_band';
  else if (!attemptStarted) blockedReason = 'attempt_not_started';
  else if (!descendConfirmed) blockedReason = 'descend_not_confirmed';
  else if (!reversalConfirmed) blockedReason = 'reversal_not_confirmed';
  else if (!reversalByRuleOrHmm) blockedReason = 'reversal_provenance_insufficient';
  else if (!recoveryConfirmed) blockedReason = 'recovery_not_confirmed';
  else if (!shallowReversalSatisfied) blockedReason = 'shallow_reversal_not_satisfied';
  else if (!ascentEquivalentSatisfied) blockedReason = 'ascent_equivalent_not_satisfied';
  else if (!streamBridgeSatisfied) blockedReason = 'stream_bridge_not_satisfied';
  else if (!temporalOrderSatisfied) blockedReason = 'temporal_order_not_satisfied';
  else if (!noEventCycleShortCircuit) blockedReason = 'event_cycle_short_circuit';
  else if (!noTrajectoryRescue) blockedReason = 'trajectory_rescue_applied';

  let observationStage: ShallowCycleCloseProofObservationStage;
  if ((sameRep?.present === false) || sameRep?.sameRepWindowMixedOrStale === true || !setupClean || !readinessStable) {
    observationStage = 'pre_admission';
  } else if (!admitted || !shallowBand || !attemptStarted || !descendConfirmed) {
    observationStage = 'pre_admission';
  } else if (!reversalConfirmed || !reversalByRuleOrHmm || !shallowReversalSatisfied) {
    observationStage = 'admitted_without_reversal';
  } else if (!recoveryConfirmed || (sameRep != null && !streamBridgeSatisfied)) {
    observationStage = 'reversal_without_recovery';
  } else if (!ascentEquivalentSatisfied) {
    observationStage = 'recovery_without_ascent_equivalent';
  } else if (blockedReason != null) {
    observationStage = 'cycle_complete_but_blocked';
  } else {
    observationStage = 'shallow_cycle_close_proof_candidate';
  }

  if (blockedReason != null) {
    return {
      cycleCloseProofSatisfied: false,
      cycleCloseProofReason: null,
      cycleCloseProofBlockedReason: blockedReason,
      observationStage,
      gates,
      notes,
    };
  }

  notes.push('shallow_cycle_order_proved');
  return {
    cycleCloseProofSatisfied: true,
    cycleCloseProofReason: 'shallow_cycle_order_proved',
    cycleCloseProofBlockedReason: null,
    observationStage: 'shallow_cycle_close_proof_candidate',
    gates,
    notes,
  };
}

/** Short trace-compact form for camera-trace bundle. */
export interface ShallowCycleCloseProofTraceCompact {
  sp: boolean;
  r: ShallowCycleCloseProofReason;
  br: ShallowCycleCloseProofBlockedReason;
  stage: ShallowCycleCloseProofObservationStage;
  g: ShallowCycleCloseProofGates;
}

export function buildShallowCycleCloseProofTraceCompact(
  decision: ShallowCycleCloseProofDecision | undefined | null
): ShallowCycleCloseProofTraceCompact | null {
  if (decision == null) return null;
  return {
    sp: decision.cycleCloseProofSatisfied,
    r: decision.cycleCloseProofReason,
    br: decision.cycleCloseProofBlockedReason,
    stage: decision.observationStage,
    g: decision.gates,
  };
}
