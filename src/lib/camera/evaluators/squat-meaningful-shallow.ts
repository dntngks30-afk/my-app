/**
 * PR-CAM-SQUAT-MEANINGFUL-SHALLOW-GATE-01
 *
 * 얕은 스쿼트는 "의미 있는 하강 -> 상승 -> 서기 복귀"가 확인될 때만 통과시킨다.
 * deep standard path는 건드리지 않고, shallow pass만 마지막 게이트에서 보수적으로 확정한다.
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult } from './types';
import type { SquatCompletionState } from '../squat-completion-state';
import { evaluateSquat as evaluateSquatBase } from './squat';

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const MIN_DESCENT_TO_PEAK_MS_SHALLOW = 200;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;

type SquatStateRecord = SquatCompletionState & Record<string, unknown>;

function getPrimaryRelativePeak(state: SquatStateRecord): number | null {
  const rawPrimary = state.rawDepthPeakPrimary;
  if (typeof rawPrimary !== 'number' || !Number.isFinite(rawPrimary)) return null;
  const baseline =
    typeof state.baselineFrozenDepth === 'number' && Number.isFinite(state.baselineFrozenDepth)
      ? state.baselineFrozenDepth
      : typeof state.baselineStandingDepth === 'number' && Number.isFinite(state.baselineStandingDepth)
        ? state.baselineStandingDepth
        : 0;
  return Math.max(0, rawPrimary - baseline);
}

export function getShallowMeaningfulCycleBlockReason(
  state: SquatCompletionState | undefined
): string | null {
  if (state == null) return null;

  if (
    state.completionPassReason !== 'low_rom_cycle' &&
    state.completionPassReason !== 'ultra_low_rom_cycle'
  ) {
    return null;
  }

  if (state.completionPassReason === 'ultra_low_rom_cycle') {
    return 'ultra_low_rom_not_allowed';
  }

  if (
    !(state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR && state.relativeDepthPeak < STANDARD_OWNER_FLOOR)
  ) {
    return 'low_rom_band_required';
  }

  if (state.currentSquatPhase !== 'standing_recovered') {
    return 'standing_recovered_required';
  }

  if (state.trajectoryReversalRescueApplied === true) {
    return 'trajectory_rescue_not_allowed';
  }

  if (state.eventCyclePromoted === true) {
    return 'event_promotion_not_allowed';
  }

  const cycle = state.squatEventCycle;
  if (cycle == null || cycle.detected !== true) {
    return 'event_cycle_not_detected';
  }
  if (cycle.band !== 'low_rom') {
    return 'event_cycle_band_not_low_rom';
  }
  if (cycle.descentDetected !== true) {
    return 'event_cycle_descent_missing';
  }
  if (cycle.reversalDetected !== true) {
    return 'event_cycle_reversal_missing';
  }
  if (cycle.recoveryDetected !== true) {
    return 'event_cycle_recovery_missing';
  }
  if (cycle.nearStandingRecovered !== true) {
    return 'event_cycle_near_standing_missing';
  }

  if (state.reversalConfirmedBy !== 'rule' && state.reversalConfirmedBy !== 'rule_plus_hmm') {
    return 'rule_based_reversal_required';
  }

  if (
    state.squatDescentToPeakMs == null ||
    state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW
  ) {
    return 'shallow_descent_too_short';
  }

  if (
    state.squatReversalToStandingMs == null ||
    state.squatReversalToStandingMs < MIN_REVERSAL_TO_STANDING_MS_SHALLOW
  ) {
    return 'shallow_reversal_to_standing_too_short';
  }

  const primaryRelativePeak = getPrimaryRelativePeak(state as SquatStateRecord);
  if (primaryRelativePeak != null && primaryRelativePeak < LOW_ROM_LABEL_FLOOR) {
    return 'primary_depth_below_low_rom_floor';
  }

  if (state.officialShallowPathClosed !== true || state.officialShallowClosureProofSatisfied !== true) {
    return 'official_shallow_closure_not_satisfied';
  }

  return null;
}

export function demoteMeaninglessShallowPass(
  result: EvaluatorResult,
  reason: string
): EvaluatorResult {
  const state = result.debug?.squatCompletionState as SquatStateRecord | undefined;
  if (state == null) return result;

  const nextState = {
    ...state,
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: reason,
    cycleComplete: false,
    successPhaseAtOpen: undefined,
    eventCyclePromoted: false,
    eventCycleSource: null,
    postAssistCompletionBlockedReason: reason,
    completionFinalizeMode: 'blocked',
    completionAssistApplied: false,
    completionAssistSources: [],
    completionAssistMode: 'none',
    promotionBaseRuleBlockedReason: null,
    officialShallowPathClosed: false,
    officialShallowPathBlockedReason: reason,
    officialShallowClosureProofSatisfied: false,
  } as SquatStateRecord;

  nextState.completionTruthPassed = false;
  nextState.completionOwnerPassed = false;
  nextState.completionOwnerReason = null;
  nextState.completionOwnerBlockedReason = reason;
  nextState.uiProgressionAllowed = false;
  nextState.uiProgressionBlockedReason = reason;
  nextState.passOwner = null;
  nextState.finalSuccessOwner = null;
  nextState.standardOwnerEligible = false;
  nextState.shadowEventOwnerEligible = false;

  const completionHints = [
    ...new Set([...(result.completionHints ?? []), reason]),
  ];

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    `meaningful_shallow_gate_rejected:${reason}`,
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionSatisfied: false,
    completionPassReason: 'not_confirmed',
    completionBlockedReason: reason,
    successPhaseAtOpen: null,
    squatEventCyclePromoted: 0,
    squatMeaningfulShallowGateRejected: 1,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionState: nextState,
      highlightedMetrics,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  const result = evaluateSquatBase(landmarks);
  const state = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  const reason = getShallowMeaningfulCycleBlockReason(state);
  return reason ? demoteMeaninglessShallowPass(result, reason) : result;
}
