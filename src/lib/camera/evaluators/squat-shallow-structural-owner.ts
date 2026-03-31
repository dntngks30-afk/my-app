/**
 * PR-CAM-SQUAT-SHALLOW-STRUCTURAL-CYCLE-OWNER-PROMOTION-01
 *
 * trajectory rescue를 다시 owner truth로 되돌리지 않고,
 * 최신 JSON에서 드러난 bounded shallow structural cycle만
 * post-process wrapper에서 승격한다.
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult } from './types';
import type { SquatCompletionState } from '../squat-completion-state';
import { evaluateSquat as evaluateSquatBase } from './squat';

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const LEGACY_ATTEMPT_FLOOR = 0.02;
const RELAXED_LOW_ROM_MIN_CONTINUITY_FRAMES = 4;
const RELAXED_LOW_ROM_MIN_DROP_RATIO = 0.45;
const MIN_DESCENT_TO_PEAK_MS_LOW_ROM = 200;
const RELAXED_MIN_DESCENT_TO_PEAK_MS_LOW_ROM = 120;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;
const RELAXED_MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 140;
const MIN_DESCENT_FRAMES = 3;
const MIN_REVERSAL_FRAMES = 2;
const MIN_RECOVERY_FRAMES = 2;

const STRUCTURAL_CYCLE_BANNED_NOTES = new Set([
  'freeze_or_latch_missing',
  'peak_anchor_at_series_start',
  'jitter_spike_reject',
  'series_too_short',
  'no_baseline',
]);

type ShallowStructuralPromotionBand = 'low_rom' | 'ultra_low_rom';

type ShallowStructuralCycleDecision = {
  ok: boolean;
  band: ShallowStructuralPromotionBand | null;
  blockedReason: string | null;
};

function deriveShallowPromotionBand(
  state: Pick<SquatCompletionState, 'relativeDepthPeak' | 'evidenceLabel'>
): ShallowStructuralPromotionBand | null {
  if (
    state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR &&
    state.relativeDepthPeak < STANDARD_OWNER_FLOOR
  ) {
    return 'low_rom';
  }
  if (
    state.relativeDepthPeak >= LEGACY_ATTEMPT_FLOOR &&
    state.relativeDepthPeak < LOW_ROM_LABEL_FLOOR &&
    state.evidenceLabel === 'ultra_low_rom'
  ) {
    return 'ultra_low_rom';
  }
  return null;
}

function hasStructuralCycleBannedNotes(notes: string[] | undefined): boolean {
  if (!notes || notes.length === 0) return false;
  return notes.some((note) => STRUCTURAL_CYCLE_BANNED_NOTES.has(note));
}

function structuralCycleUsesRelaxedTiming(
  state: Pick<
    SquatCompletionState,
    | 'standingRecoveryBand'
    | 'evidenceLabel'
    | 'recoveryReturnContinuityFrames'
    | 'recoveryDropRatio'
  >
): boolean {
  const shallowBand =
    state.standingRecoveryBand === 'low_rom' ||
    state.standingRecoveryBand === 'ultra_low_rom' ||
    state.evidenceLabel === 'low_rom' ||
    state.evidenceLabel === 'ultra_low_rom';

  return (
    shallowBand &&
    (state.recoveryReturnContinuityFrames ?? 0) >= RELAXED_LOW_ROM_MIN_CONTINUITY_FRAMES &&
    (state.recoveryDropRatio ?? 0) >= RELAXED_LOW_ROM_MIN_DROP_RATIO
  );
}

export function shouldPromoteShallowStructuralCycleResult(
  state: SquatCompletionState | undefined
): ShallowStructuralCycleDecision {
  if (state == null) {
    return { ok: false, band: null, blockedReason: 'no_state' };
  }

  const band = deriveShallowPromotionBand(state);
  if (band == null) {
    return { ok: false, band: null, blockedReason: 'band_out_of_range' };
  }

  if (state.completionSatisfied === true || state.completionPassReason !== 'not_confirmed') {
    return { ok: false, band, blockedReason: 'already_completed_or_not_pending' };
  }

  const blockedReason = state.ruleCompletionBlockedReason ?? state.completionBlockedReason ?? null;
  if (blockedReason !== 'no_reversal') {
    return { ok: false, band, blockedReason: blockedReason ?? 'blocked_reason_mismatch' };
  }

  if (state.officialShallowPathAdmitted !== true) {
    return { ok: false, band, blockedReason: 'official_shallow_not_admitted' };
  }
  if (state.attemptStarted !== true) {
    return { ok: false, band, blockedReason: 'attempt_not_started' };
  }
  if (state.descendConfirmed !== true) {
    return { ok: false, band, blockedReason: 'descent_not_confirmed' };
  }
  if (state.downwardCommitmentReached !== true) {
    return { ok: false, band, blockedReason: 'downward_commitment_not_reached' };
  }
  if (state.trajectoryReversalRescueApplied !== true) {
    return { ok: false, band, blockedReason: 'trajectory_rescue_not_applied' };
  }
  if (state.currentSquatPhase !== 'standing_recovered') {
    return { ok: false, band, blockedReason: 'not_standing_recovered_phase' };
  }
  if (state.standingRecoveredAtMs == null) {
    return { ok: false, band, blockedReason: 'standing_recovery_missing' };
  }
  if (state.recoveryConfirmedAfterReversal !== true) {
    return { ok: false, band, blockedReason: 'recovery_after_reversal_missing' };
  }

  const finalizeOk =
    state.standingRecoveryFinalizeReason === 'standing_hold_met' ||
    state.standingRecoveryFinalizeReason === 'low_rom_guarded_finalize' ||
    state.standingRecoveryFinalizeReason === 'ultra_low_rom_guarded_finalize';

  if (!finalizeOk) {
    return { ok: false, band, blockedReason: 'standing_finalize_not_satisfied' };
  }

  if (state.peakLatched !== true || state.peakLatchedAtIndex == null) {
    return { ok: false, band, blockedReason: 'peak_not_latched' };
  }
  if (state.peakLatchedAtIndex < MIN_DESCENT_FRAMES) {
    return { ok: false, band, blockedReason: 'peak_too_early' };
  }

  const cycle = state.squatEventCycle;
  if (cycle == null) {
    return { ok: false, band, blockedReason: 'no_event_cycle' };
  }
  if (cycle.reversalDetected !== true) {
    return { ok: false, band, blockedReason: 'event_cycle_reversal_missing' };
  }
  if (cycle.recoveryDetected !== true) {
    return { ok: false, band, blockedReason: 'event_cycle_recovery_missing' };
  }
  if (cycle.nearStandingRecovered !== true) {
    return { ok: false, band, blockedReason: 'event_cycle_near_standing_missing' };
  }
  if ((cycle.reversalFrames ?? 0) < MIN_REVERSAL_FRAMES) {
    return { ok: false, band, blockedReason: 'event_cycle_reversal_frames_too_few' };
  }
  if ((cycle.recoveryFrames ?? 0) < MIN_RECOVERY_FRAMES) {
    return { ok: false, band, blockedReason: 'event_cycle_recovery_frames_too_few' };
  }
  if (hasStructuralCycleBannedNotes(cycle.notes)) {
    return { ok: false, band, blockedReason: 'event_cycle_banned_note' };
  }

  const relaxedTiming = structuralCycleUsesRelaxedTiming(state);
  const minDescentToPeakMs = relaxedTiming
    ? RELAXED_MIN_DESCENT_TO_PEAK_MS_LOW_ROM
    : MIN_DESCENT_TO_PEAK_MS_LOW_ROM;
  const minReversalToStandingMs = relaxedTiming
    ? RELAXED_MIN_REVERSAL_TO_STANDING_MS_SHALLOW
    : MIN_REVERSAL_TO_STANDING_MS_SHALLOW;

  if ((state.squatDescentToPeakMs ?? 0) < minDescentToPeakMs) {
    return { ok: false, band, blockedReason: 'descent_to_peak_too_short' };
  }
  if ((state.squatReversalToStandingMs ?? 0) < minReversalToStandingMs) {
    return { ok: false, band, blockedReason: 'reversal_to_standing_too_short' };
  }

  return { ok: true, band, blockedReason: null };
}

export function promoteSquatResultWithShallowStructuralCycle(
  result: EvaluatorResult
): EvaluatorResult {
  const state = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  const decision = shouldPromoteShallowStructuralCycleResult(state);
  if (!decision.ok || state == null || decision.band == null) {
    return result;
  }

  const nextEventCycle = state.squatEventCycle == null
    ? undefined
    : {
        ...state.squatEventCycle,
        detected: true,
        band: decision.band,
        notes: state.squatEventCycle.notes?.includes('descent_structural_cycle_fallback')
          ? state.squatEventCycle.notes
          : [...(state.squatEventCycle.notes ?? []), 'descent_structural_cycle_fallback'],
      };

  const nextSource =
    nextEventCycle?.source === 'rule_plus_hmm' ? 'rule_plus_hmm' : 'rule';
  const nextPassReason = decision.band === 'low_rom' ? 'low_rom_cycle' : 'ultra_low_rom_cycle';
  const blockedReason = state.ruleCompletionBlockedReason ?? state.completionBlockedReason ?? null;

  const nextState: SquatCompletionState = {
    ...state,
    squatEventCycle: nextEventCycle,
    currentSquatPhase: 'standing_recovered',
    completionBlockedReason: null,
    completionSatisfied: true,
    completionPassReason: nextPassReason,
    cycleComplete: true,
    successPhaseAtOpen: 'standing_recovered',
    completionMachinePhase: 'completed',
    eventCyclePromoted: true,
    eventCycleSource: nextSource,
    postAssistCompletionBlockedReason: null,
    completionFinalizeMode: 'event_promoted_finalized',
    promotionBaseRuleBlockedReason: blockedReason,
    officialShallowPathClosed: state.officialShallowPathCandidate === true,
    officialShallowPathBlockedReason: null,
    officialShallowClosureProofSatisfied: true,
    officialShallowReversalSatisfied: true,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
  };

  const completionHints = (result.completionHints ?? []).filter(
    (hint) =>
      hint !== 'rep_phase_incomplete' &&
      hint !== 'no_reversal' &&
      hint !== 'not_standing_recovered' &&
      hint !== 'recovery_hold_too_short' &&
      hint !== blockedReason
  );

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    'bounded shallow structural cycle promoted',
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionMachinePhase: 'completed',
    completionPassReason: nextPassReason,
    completionSatisfied: true,
    completionBlockedReason: null,
    successPhaseAtOpen: 'standing_recovered',
    contractB_officialShallowReversal: 1,
    contractC_officialShallowClosed: nextState.officialShallowPathClosed ? 1 : 0,
    contractC_closureProof: 1,
    squatEventCycleDetected: 1,
    squatEventCycleBandCode: decision.band === 'low_rom' ? 1 : 2,
    squatEventCyclePromoted: 1,
    squatEventCycleSourceCode: nextSource === 'rule_plus_hmm' ? 2 : 1,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionState: nextState,
      squatEventCycle: nextEventCycle,
      highlightedMetrics,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  return promoteSquatResultWithShallowStructuralCycle(evaluateSquatBase(landmarks));
}
