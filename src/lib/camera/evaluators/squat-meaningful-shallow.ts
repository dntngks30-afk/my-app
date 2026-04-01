/**
 * PR-CAM-SQUAT-MEANINGFUL-SHALLOW-GATE-01
 *
 * 얕은 스쿼트는 "의미 있는 하강 -> 상승 -> 서기 복귀"가 확인될 때만 통과시킨다.
 * deep standard path는 건드리지 않고, shallow pass만 마지막 게이트에서 보수적으로 확정한다.
 *
 * PR-CAM-SHALLOW-LOW-ROM-SETUP-REARM-01
 *
 * setup/framing 이동 때문에 `setupMotionBlocked + not_armed + freeze_or_latch_missing`가 함께 남는 경우,
 * shallow low-rom 후보에 한해 later stable-standing window부터 tail을 다시 평가한다.
 * deep standard 경로는 재평가 대상에서 제외한다.
 */
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import {
  buildPoseFeaturesFrames,
  getSquatRecoverySignal,
  type PoseFeaturesFrame,
} from '@/lib/camera/pose-features';
import type { EvaluatorResult } from './types';
import type { SquatCompletionState } from '../squat-completion-state';
import {
  computeSquatReadinessStableDwell,
  computeSquatSetupMotionBlock,
  evaluateSquatCompletionState,
} from '../squat-completion-state';
import {
  computeSquatCompletionArming,
  mergeArmingDepthObservability,
  type CompletionArmingState,
} from '../squat/squat-completion-arming';
import { getSquatHmmArmingAssistDecision } from '../squat/squat-arming-assist';
import { decodeSquatHmm } from '../squat/squat-hmm';
import { evaluateSquatFromPoseFrames } from './squat';

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const MIN_DESCENT_TO_PEAK_MS_SHALLOW = 200;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;

const STANDING_DEPTH_MAX = 0.085;
const STABLE_ADJACENT_DELTA_MAX = 0.018;
const STANDING_INTERNAL_RANGE_MAX = 0.01;
const SETUP_REARM_STABLE_FRAMES = 4;
const SETUP_REARM_MIN_PEAK_INDEX = 2;
const SETUP_REARM_MIN_RETURN_CONTINUITY_FRAMES = 3;
const MIN_FRAMES_FOR_BASELINE_CAPTURE = 6;
const MIN_VALID_FRAMES = 8;

type SquatStateRecord = SquatCompletionState & Record<string, unknown>;

type ShallowLowRomRearmCandidate = {
  sliceStartIndex: number;
  stableFrames: number;
  baselineStandingDepthPrimary: number;
  baselineStandingDepthBlended: number;
  standingWindowRange: number;
};

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

function readShallowRearmDepth(frame: PoseFeaturesFrame): number | null {
  const b = frame.derived.squatDepthProxyBlended;
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

function readShallowRearmPrimaryDepth(frame: PoseFeaturesFrame): number | null {
  const p = frame.derived.squatDepthProxy;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

function isStableStandingRun(frames: PoseFeaturesFrame[], start: number, len: number): boolean {
  let dMin = Infinity;
  let dMax = -Infinity;
  for (let k = 0; k < len; k++) {
    const d = readShallowRearmDepth(frames[start + k]!);
    if (d == null || d >= STANDING_DEPTH_MAX) return false;
    if (k > 0) {
      const prev = readShallowRearmDepth(frames[start + k - 1]!);
      if (prev == null || Math.abs(d - prev) > STABLE_ADJACENT_DELTA_MAX) return false;
    }
    if (d < dMin) dMin = d;
    if (d > dMax) dMax = d;
  }
  return dMax - dMin <= STANDING_INTERNAL_RANGE_MAX;
}

function findPeakLocalIndex(frames: PoseFeaturesFrame[]): number {
  let bestIdx = -1;
  let bestDepth = -Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = readShallowRearmDepth(frames[i]!);
    if (d != null && d > bestDepth) {
      bestDepth = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function findShallowLowRomSetupRearmCandidate(
  valid: PoseFeaturesFrame[]
): ShallowLowRomRearmCandidate | null {
  if (valid.length < SETUP_REARM_STABLE_FRAMES + MIN_FRAMES_FOR_BASELINE_CAPTURE) {
    return null;
  }

  for (let end = valid.length - 2; end >= SETUP_REARM_STABLE_FRAMES - 1; end--) {
    const start = end - SETUP_REARM_STABLE_FRAMES + 1;
    if (start < 0) break;
    if (!isStableStandingRun(valid, start, SETUP_REARM_STABLE_FRAMES)) continue;

    const completionSliceStartIndex = end + 1;
    const completionFrames = valid.slice(completionSliceStartIndex);
    if (completionFrames.length < MIN_FRAMES_FOR_BASELINE_CAPTURE) continue;

    const baselineDepthsBlended = valid
      .slice(start, end + 1)
      .map(readShallowRearmDepth)
      .filter((d): d is number => d != null);
    const baselineDepthsPrimary = valid
      .slice(start, end + 1)
      .map(readShallowRearmPrimaryDepth)
      .filter((d): d is number => d != null);
    const motionDepthsBlended = completionFrames
      .map(readShallowRearmDepth)
      .filter((d): d is number => d != null);
    const motionDepthsPrimary = completionFrames
      .map(readShallowRearmPrimaryDepth)
      .filter((d): d is number => d != null);

    if (
      baselineDepthsBlended.length < SETUP_REARM_STABLE_FRAMES ||
      motionDepthsBlended.length === 0 ||
      motionDepthsPrimary.length === 0
    ) {
      continue;
    }

    const baseMinBlended = Math.min(...baselineDepthsBlended);
    const baseMinPrimary = baselineDepthsPrimary.length > 0 ? Math.min(...baselineDepthsPrimary) : baseMinBlended;
    const baseMaxBlended = Math.max(...baselineDepthsBlended);
    const motionMaxBlended = Math.max(...motionDepthsBlended);
    const motionMaxPrimary = Math.max(...motionDepthsPrimary);
    const relativePeakBlended = Math.max(0, motionMaxBlended - baseMinBlended);
    const relativePeakPrimary = Math.max(0, motionMaxPrimary - baseMinPrimary);

    if (
      relativePeakBlended < LOW_ROM_LABEL_FLOOR ||
      relativePeakBlended >= STANDARD_OWNER_FLOOR ||
      relativePeakPrimary < LOW_ROM_LABEL_FLOOR ||
      relativePeakPrimary >= STANDARD_OWNER_FLOOR
    ) {
      continue;
    }

    const peakLocalIndex = findPeakLocalIndex(completionFrames);
    if (peakLocalIndex < SETUP_REARM_MIN_PEAK_INDEX) continue;

    const recovery = getSquatRecoverySignal(completionFrames);
    const meaningfulRecovery = recovery.lowRomRecovered || recovery.recovered;
    if (!meaningfulRecovery) continue;
    if ((recovery.returnContinuityFrames ?? 0) < SETUP_REARM_MIN_RETURN_CONTINUITY_FRAMES) {
      continue;
    }

    return {
      sliceStartIndex: start,
      stableFrames: SETUP_REARM_STABLE_FRAMES,
      baselineStandingDepthPrimary: Math.round(baseMinPrimary * 1000) / 1000,
      baselineStandingDepthBlended: Math.round(baseMinBlended * 1000) / 1000,
      standingWindowRange: Math.round((baseMaxBlended - baseMinBlended) * 1000) / 1000,
    };
  }

  return null;
}

function isSetupAwareShallowLowRomRetryEligible(
  state: SquatCompletionState | undefined
): boolean {
  if (state == null) return false;
  if (state.completionSatisfied === true) return false;
  if (state.setupMotionBlocked !== true) return false;
  const blocked =
    state.completionBlockedReason ??
    state.postAssistCompletionBlockedReason ??
    state.ruleCompletionBlockedReason ??
    null;
  if (blocked !== 'not_armed' && blocked !== 'no_reversal') return false;
  if (!(state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR && state.relativeDepthPeak < STANDARD_OWNER_FLOOR)) {
    return false;
  }
  if (state.trajectoryReversalRescueApplied === true) return false;
  if (state.eventCyclePromoted === true) return false;
  return true;
}

function stripResolvedCompletionHints(hints: string[]): string[] {
  const blockedLike = new Set([
    'rep_phase_incomplete',
    'not_armed',
    'no_reversal',
    'not_standing_recovered',
    'recovery_hold_too_short',
    'low_rom_standing_finalize_not_satisfied',
    'ultra_low_rom_not_allowed',
  ]);
  return hints.filter((hint) => !blockedLike.has(hint));
}

function deriveDemotedCompletionMachinePhase(state: SquatStateRecord): string {
  if (state.recoveryConfirmedAfterReversal === true) return 'recovered';
  if (state.reversalConfirmedAfterDescend === true) return 'ascending_confirmed';
  if (state.descendConfirmed === true) return 'bottom_or_low_point';
  if (state.attemptStarted === true) return 'descending_confirmed';
  return 'idle';
}

function rerunShallowLowRomAfterSetupBlock(
  frames: PoseFeaturesFrame[],
  result: EvaluatorResult
): EvaluatorResult {
  const baseState = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  if (!isSetupAwareShallowLowRomRetryEligible(baseState)) {
    return result;
  }

  const validRaw = frames.filter((frame) => frame.isValid);
  const dwell = computeSquatReadinessStableDwell(validRaw);
  if (!dwell.satisfied) return result;

  const valid = validRaw.slice(dwell.firstSliceStartIndexInValid);
  const candidate = findShallowLowRomSetupRearmCandidate(valid);
  if (candidate == null) return result;

  const rerunValid = valid.slice(candidate.sliceStartIndex);
  if (rerunValid.length < MIN_VALID_FRAMES) return result;

  const rerunSetupBlock = computeSquatSetupMotionBlock(rerunValid);
  const { arming: baseArming, completionFrames: naturalCompletionFrames } =
    computeSquatCompletionArming(rerunValid);

  const hmmOnValid = decodeSquatHmm(rerunValid);
  const armingAssistDec = getSquatHmmArmingAssistDecision(rerunValid, hmmOnValid, {
    armed: baseArming.armed,
  });
  const effectiveArmed = baseArming.armed || armingAssistDec.assistApplied;
  const completionFrames = !effectiveArmed
    ? []
    : baseArming.armed
      ? naturalCompletionFrames
      : rerunValid;
  const squatHmm = !effectiveArmed
    ? hmmOnValid
    : baseArming.armed && naturalCompletionFrames.length > 0
      ? decodeSquatHmm(naturalCompletionFrames)
      : hmmOnValid;

  let completionArming: CompletionArmingState = {
    ...baseArming,
    hmmArmingAssistEligible: armingAssistDec.assistEligible,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    hmmArmingAssistReason: armingAssistDec.assistReason,
    effectiveArmed,
    armingFallbackUsed: true,
    armingStandingWindowRange: candidate.standingWindowRange,
    armingBaselineStandingDepthPrimary: candidate.baselineStandingDepthPrimary,
    armingBaselineStandingDepthBlended: candidate.baselineStandingDepthBlended,
    ...(armingAssistDec.assistApplied && !baseArming.armed
      ? {
          completionSliceStartIndex: 0,
          baselineCaptured: rerunValid.length >= MIN_FRAMES_FOR_BASELINE_CAPTURE,
          stableFrames: candidate.stableFrames,
          armingPeakAnchored: undefined,
        }
      : {}),
  };
  completionArming = mergeArmingDepthObservability(rerunValid, completionArming);

  let state = evaluateSquatCompletionState(completionFrames, {
    hmm: squatHmm,
    hmmArmingAssistApplied: armingAssistDec.assistApplied,
    seedBaselineStandingDepthPrimary: completionArming.armingBaselineStandingDepthPrimary,
    seedBaselineStandingDepthBlended: completionArming.armingBaselineStandingDepthBlended,
  });

  state = {
    ...state,
    readinessStableDwellSatisfied: dwell.satisfied,
    setupMotionBlocked: rerunSetupBlock.blocked,
    setupMotionBlockReason: rerunSetupBlock.reason,
    attemptStartedAfterReady: true,
  };

  if (state.completionSatisfied && rerunSetupBlock.blocked) {
    return result;
  }

  const baseBlockedReason = baseState?.completionBlockedReason ?? null;
  const shouldAdopt =
    state.completionSatisfied ||
    (baseBlockedReason === 'not_armed' && state.completionBlockedReason !== 'not_armed');
  if (!shouldAdopt) {
    return result;
  }

  const completionHints = state.completionSatisfied
    ? stripResolvedCompletionHints(result.completionHints ?? [])
    : [
        ...new Set(
          [
            ...stripResolvedCompletionHints(result.completionHints ?? []),
            state.completionBlockedReason,
          ].filter((hint): hint is string => typeof hint === 'string' && hint.length > 0)
        ),
      ];

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    'shallow_low_rom_setup_rearm_rerun',
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionMachinePhase: state.completionMachinePhase,
    completionPassReason: state.completionPassReason,
    completionSatisfied: state.completionSatisfied,
    completionBlockedReason: state.completionBlockedReason,
    successPhaseAtOpen: state.successPhaseAtOpen ?? null,
    completionArmingArmed: completionArming.armed ? 1 : 0,
    effectiveArmed: effectiveArmed ? 1 : 0,
    armingFallbackUsed: completionArming.armingFallbackUsed ? 1 : 0,
    squatLowRomSetupRearmApplied: 1,
    setupMotionBlocked: rerunSetupBlock.blocked ? 1 : 0,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionArming: completionArming,
      squatCompletionState: state,
      squatEventCycle: state.squatEventCycle,
      squatSetupPhaseTrace: {
        ...(result.debug?.squatSetupPhaseTrace ?? {}),
        readinessStableDwellSatisfied: dwell.satisfied,
        setupMotionBlocked: rerunSetupBlock.blocked,
        setupMotionBlockReason: rerunSetupBlock.reason,
        attemptStartedAfterReady: true,
        shallowLowRomSetupRearmApplied: true,
      },
      highlightedMetrics,
    },
  };
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
    completionMachinePhase: deriveDemotedCompletionMachinePhase(state),
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
    completionMachinePhase: nextState.completionMachinePhase,
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
  const frames = buildPoseFeaturesFrames('squat', landmarks);
  let result = evaluateSquatFromPoseFrames(frames);
  result = rerunShallowLowRomAfterSetupBlock(frames, result);
  const state = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  const reason = getShallowMeaningfulCycleBlockReason(state);
  return reason ? demoteMeaninglessShallowPass(result, reason) : result;
}
