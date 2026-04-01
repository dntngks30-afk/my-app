/**
 * PR-CAM-SQUAT-LOW-ROM-ANGLE-RULE-01
 *
 * 얕은 low-rom 스쿼트에서 depth-only rule이 놓치는 실제 하강→상승을
 * knee / hip angle 변화로 한 번 더 확인한다.
 *
 * - low-rom 대역(0.07 <= relativeDepthPeak < 0.4)만 대상
 * - standing / descent-only / ultra-low / trajectory rescue / event promotion 은 승격 금지
 * - deep standard path는 기존 wrapper 결과를 그대로 사용
 */
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
import {
  buildPoseFeaturesFrames,
  type PoseFeaturesFrame,
} from '@/lib/camera/pose-features';
import type { EvaluatorResult } from './types';
import type { SquatCompletionState } from '../squat-completion-state';
import { evaluateSquat as evaluateSquatBase } from './squat-meaningful-shallow';

const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_OWNER_FLOOR = 0.4;
const MIN_DESCENT_TO_PEAK_MS_SHALLOW = 200;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;

const LOW_ROM_BASELINE_FRAMES = 4;
const LOW_ROM_MIN_PRE_PEAK_FRAMES = 4;
const LOW_ROM_MIN_POST_PEAK_FRAMES = 4;
const LOW_ROM_MIN_KNEE_FLEX_DEG = 6;
const LOW_ROM_MIN_HIP_FLEX_DEG = 4;
const LOW_ROM_EXTENSION_RATIO = 0.45;
const LOW_ROM_STEP_KNEE_DEG = 1.0;
const LOW_ROM_STEP_HIP_DEG = 0.8;
const LOW_ROM_MIN_DEPTH_RETURN_ABS = 0.012;
const LOW_ROM_RETURN_DROP_RATIO = 0.35;
const LOW_ROM_STANDING_RATIO = 0.45;
const LOW_ROM_STANDING_MIN_FRAMES = 2;

type SquatStateRecord = SquatCompletionState & Record<string, unknown>;

type LowRomAngleRuleCycleEvidence = {
  peakIndex: number;
  peakRelativeDepth: number;
  depthReturnDrop: number;
  standingRecoveredAtMs: number;
  standingRecoveryHoldMs: number;
  standingRecoveryFrameCount: number;
  descentToPeakMs: number;
  reversalToStandingMs: number;
  reversalFrameCount: number;
};

function meanSafe(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minSafe(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.min(...values);
}

function maxSafe(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function angleDeg(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const rad =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  return Math.abs((rad * 180) / Math.PI);
}

function getHipAngleAvg(frame: PoseFeaturesFrame): number | null {
  const left =
    frame.joints.leftShoulder && frame.joints.leftHip && frame.joints.leftKnee
      ? angleDeg(frame.joints.leftShoulder, frame.joints.leftHip, frame.joints.leftKnee)
      : null;
  const right =
    frame.joints.rightShoulder && frame.joints.rightHip && frame.joints.rightKnee
      ? angleDeg(frame.joints.rightShoulder, frame.joints.rightHip, frame.joints.rightKnee)
      : null;
  return meanSafe([left, right].filter((v): v is number => typeof v === 'number' && Number.isFinite(v)));
}

function readPromotionDepth(frame: PoseFeaturesFrame): number | null {
  const p = frame.derived.squatDepthProxy;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  const b = frame.derived.squatDepthProxyBlended;
  return typeof b === 'number' && Number.isFinite(b) ? b : null;
}

function readUnderlyingBlockedReason(state: SquatCompletionState | undefined): string | null {
  if (state == null) return null;
  return (
    state.ruleCompletionBlockedReason ??
    state.postAssistCompletionBlockedReason ??
    state.completionBlockedReason ??
    null
  );
}

function findPeakIndex(valid: PoseFeaturesFrame[], state: SquatCompletionState): number {
  if (
    typeof state.peakLatchedAtIndex === 'number' &&
    Number.isInteger(state.peakLatchedAtIndex) &&
    state.peakLatchedAtIndex >= 0 &&
    state.peakLatchedAtIndex < valid.length
  ) {
    return state.peakLatchedAtIndex;
  }
  let bestIdx = -1;
  let bestDepth = -Infinity;
  for (let i = 0; i < valid.length; i += 1) {
    const depth = readPromotionDepth(valid[i]!);
    if (depth != null && depth > bestDepth) {
      bestDepth = depth;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function getTailStandingRecovery(
  postPeak: PoseFeaturesFrame[],
  baselineStandingDepth: number,
  peakRelativeDepth: number
): { count: number; standingRecoveredAtMs: number | null } {
  const depthCeil =
    baselineStandingDepth +
    Math.max(LOW_ROM_MIN_DEPTH_RETURN_ABS, peakRelativeDepth * LOW_ROM_STANDING_RATIO);

  let count = 0;
  let standingRecoveredAtMs: number | null = null;

  for (let i = postPeak.length - 1; i >= 0; i -= 1) {
    const depth = readPromotionDepth(postPeak[i]!);
    if (depth == null || depth > depthCeil) break;
    count += 1;
    standingRecoveredAtMs = postPeak[i]!.timestampMs;
  }

  return { count, standingRecoveredAtMs };
}

function isLowRomAngleRulePromotionEligible(
  state: SquatCompletionState | undefined
): boolean {
  if (state == null) return false;
  if (state.completionSatisfied === true) return false;
  if (state.setupMotionBlocked === true) return false;
  if (state.trajectoryReversalRescueApplied === true) return false;
  if (state.eventCyclePromoted === true) return false;
  if (state.readinessStableDwellSatisfied !== true) return false;
  if (!(state.relativeDepthPeak >= LOW_ROM_LABEL_FLOOR && state.relativeDepthPeak < STANDARD_OWNER_FLOOR)) {
    return false;
  }
  const blocked = readUnderlyingBlockedReason(state);
  return (
    blocked === 'not_armed' ||
    blocked === 'no_reversal' ||
    blocked === 'not_standing_recovered' ||
    blocked === 'recovery_hold_too_short' ||
    blocked === 'low_rom_standing_finalize_not_satisfied'
  );
}

export function detectLowRomAngleRuleCycle(
  frames: PoseFeaturesFrame[],
  state: SquatCompletionState | undefined
): LowRomAngleRuleCycleEvidence | null {
  if (!isLowRomAngleRulePromotionEligible(state)) return null;
  if (state == null || state.baselineFrozen !== true || state.peakLatched !== true) {
    return null;
  }

  const valid = frames.filter((frame) => frame.isValid);
  if (valid.length < LOW_ROM_MIN_PRE_PEAK_FRAMES + LOW_ROM_MIN_POST_PEAK_FRAMES + 1) {
    return null;
  }

  const peakIndex = findPeakIndex(valid, state);
  if (
    peakIndex < LOW_ROM_MIN_PRE_PEAK_FRAMES ||
    peakIndex >= valid.length - LOW_ROM_MIN_POST_PEAK_FRAMES
  ) {
    return null;
  }

  const prePeak = valid.slice(0, peakIndex);
  const postPeak = valid.slice(peakIndex + 1);
  if (prePeak.length < LOW_ROM_MIN_PRE_PEAK_FRAMES || postPeak.length < LOW_ROM_MIN_POST_PEAK_FRAMES) return null;
  }

  const baselineFrames = prePeak.slice(0, Math.min(LOW_ROM_BASELINE_FRAMES, prePeak.length));
  const peakWindow = valid.slice(Math.max(0, peakIndex - 1), Math.min(valid.length, peakIndex + 2));

  const baselineKnee = maxSafe(
    baselineFrames
      .map((frame) => frame.derived.kneeAngleAvg)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  );
  const baselineHip = maxSafe(
    baselineFrames
      .map(getHipAngleAvg)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  );
  const peakKnee = minSafe(
    peakWindow
      .map((frame) => frame.derived.kneeAngleAvg)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  );
  const peakHip = minSafe(
    peakWindow
      .map(getHipAngleAvg)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  );

  if (
    baselineKnee == null ||
    baselineHip == null ||
    peakKnee == null ||
    peakHip == null
  ) {
    return null;
  }

  const kneeFlexion = baselineKnee - peakKnee;
  const hipFlexion = baselineHip - peakHip;
  if (kneeFlexion < LOW_ROM_MIN_KNEE_FLEX_DEG || hipFlexion < LOW_ROM_MIN_HIP_FLEX_DEG) {
    return null;
  }

  const requiredKneeRecovery = Math.max(LOW_ROM_MIN_KNEE_FLEX_DEG, kneeFlexion * LOW_ROM_EXTENSION_RATIO);
  const requiredHipRecovery = Math.max(LOW_ROM_MIN_HIP_FLEX_DEG, hipFlexion * LOW_ROM_EXTENSION_RATIO);

  let previousKnee = peakKnee;
  let previousHip = peakHip;
  let extensionStreak = 0;
  let bestExtensionStreak = 0;
  let maxKneeRecovery = 0;
  let maxHipRecovery = 0;

  for (const frame of postPeak) {
    const knee = frame.derived.kneeAngleAvg;
    const hip = getHipAngleAvg(frame);
    if (
      typeof knee !== 'number' ||
      !Number.isFinite(knee) ||
      typeof hip !== 'number' ||
      !Number.isFinite(hip)
    ) {
      extensionStreak = 0;
      continue;
    }

    const kneeRecovery = knee - peakKnee;
    const hipRecovery = hip - peakHip;
    maxKneeRecovery = Math.max(maxKneeRecovery, kneeRecovery);
    maxHipRecovery = Math.max(maxHipRecovery, hipRecovery);

    const extensionStep =
      knee >= previousKnee + LOW_ROM_STEP_KNEE_DEG &&
      hip >= previousHip + LOW_ROM_STEP_HIP_DEG;
    const movedAwayFromPeak =
      kneeRecovery >= Math.max(2, kneeFlexion * 0.2) &&
      hipRecovery >= Math.max(1.5, hipFlexion * 0.2);

    if (extensionStep && movedAwayFromPeak) {
      extensionStreak += 1;
      bestExtensionStreak = Math.max(bestExtensionStreak, extensionStreak);
    } else {
      extensionStreak = 0;
    }

    previousKnee = knee;
    previousHip = hip;
  }

  if (
    maxKneeRecovery < requiredKneeRecovery ||
    maxHipRecovery < requiredHipRecovery ||
    bestExtensionStreak < 2
  ) {
    return null;
  }

  const baselineStandingDepth =
    typeof state.baselineFrozenDepth === 'number' && Number.isFinite(state.baselineFrozenDepth)
      ? state.baselineFrozenDepth
      : typeof state.baselineStandingDepth === 'number' && Number.isFinite(state.baselineStandingDepth)
        ? state.baselineStandingDepth
        : 0;

  const postPeakRelativeDepths = postPeak 
    .map((frame) => readPromotionDepth(frame))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .map((depth) => Math.max(0, depth - baselineStandingDepth));

  if (postPeakRelativeDepths.length < LOW_ROM_MIN_POST_PEAK_FRAMES) return null;

  const minPostPeakRelative = Math.min(...postPeakRelativeDepths);
  const depthReturnDrop = Math.max(0, state.relativeDepthPeak - minPostPeakRelative);
  const requiredDepthReturnDrop = Math.max(
    LOW_ROM_MIN_DEPTH_RETURN_ABS,
    state.relativeDepthPeak * LOW_ROM_RETURN_DROP_RATIO
  );
  if (depthReturnDrop < requiredDepthReturnDrop) return null;

  const tailRecovery = getTailStandingRecovery(postPeak, baselineStandingDepth, state.relativeDepthPeak);
  if (tailRecovery.count < LOW_ROM_STANDING_MIN_FRAMES || tailRecovery.standingRecoveredAtMs == null) {
    return null;
  }

  const peakAtMs =
    typeof state.peakAtMs === 'number' && Number.isFinite(state.peakAtMs)
      ? state.peakAtMs
      : valid[peakIndex]!.timestampMs;
  const descentStartAtMs =
    typeof state.descendStartAtMs === 'number' && Number.isFinite(state.descendStartAtMs)
      ? state.descendStartAtMs
      : prePeak[Math.max(0, prePeak.length - LOW_ROM_MIN_PRE_PEAK_FRAMES)]!.timestampMs;
  const descentToPeakMs =
    typeof state.squatDescentToPeakMs === 'number' && Number.isFinite(state.squatDescentToPeakMs)
      ? state.squatDescentToPeakMs
      : peakAtMs - descentStartAtMs;
  const reversalToStandingMs = tailRecovery.standingRecoveredAtMs - peakAtMs;

  if (descentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW) return null;
  if (reversalToStandingMs < MIN_REVERSAL_TO_STANDING_MS_SHALLOW) return null;

  return {
    peakIndex,
    peakRelativeDepth: state.relativeDepthPeak,
    depthReturnDrop,
    standingRecoveredAtMs: tailRecovery.standingRecoveredAtMs,
    standingRecoveryHoldMs:
      valid[valid.length - 1]!.timestampMs - tailRecovery.standingRecoveredAtMs,
    standingRecoveryFrameCount: tailRecovery.count,
    descentToPeakMs,
    reversalToStandingMs,
    reversalFrameCount: Math.max(2, bestExtensionStreak),
  };
}

export function promoteAngleAwareLowRomRuleCycle(
  frames: PoseFeaturesFrame[],
  result: EvaluatorResult
): EvaluatorResult {
  const state = result.debug?.squatCompletionState as SquatCompletionState | undefined;
  const evidence = detectLowRomAngleRuleCycle(frames, state);
  if (evidence == null || state == null) return result;

  const nextState: SquatStateRecord = {
    ...(state as SquatStateRecord),
    completionSatisfied: true,
    completionPassReason: 'low_rom_cycle',
    completionBlockedReason: null,
    ruleCompletionBlockedReason: null,
    postAssistCompletionBlockedReason: null,
    currentSquatPhase: 'standing_recovered',
    completionMachinePhase: 'completed',
    cycleComplete: true,
    successPhaseAtOpen: 'standing_recovered',
    eventCyclePromoted: false,
    eventCycleSource: null,
    completionFinalizeMode: 'rule_finalized',
    completionAssistApplied: false,
    completionAssistSources: [],
    completionAssistMode: 'none',
    promotionBaseRuleBlockedReason: null,
    trajectoryReversalRescueApplied: false,
    reversalConfirmedBy: 'rule',
    reversalDepthDrop: evidence.depthReturnDrop,
    reversalFrameCount: evidence.reversalFrameCount,
    reversalConfirmedAfterDescend: true,
    recoveryConfirmedAfterReversal: true,
    standingRecoveredAtMs: evidence.standingRecoveredAtMs,
    standingRecoveryHoldMs: evidence.standingRecoveryHoldMs,
    standingRecoveryFrameCount: evidence.standingRecoveryFrameCount,
    standingRecoveryBand: 'low_rom',
    standingRecoveryFinalizeReason: 'low_rom_angle_rule_finalize',
    evidenceLabel: 'low_rom',
    officialShallowPathCandidate: true,
    officialShallowPathAdmitted: true,
    officialShallowPathClosed: true,
    officialShallowPathReason:
      state.officialShallowPathReason ?? 'low_rom_angle_rule_cycle',
    officialShallowPathBlockedReason: null,
    officialShallowClosureProofSatisfied: true,
    officialShallowReversalSatisfied: true,
    squatDescentToPeakMs: evidence.descentToPeakMs,
    squatReversalToStandingMs: evidence.reversalToStandingMs,
    recoveryReturnContinuityFrames: Math.max(
      state.recoveryReturnContinuityFrames ?? 0,
      evidence.standingRecoveryFrameCount
    ),
    recoveryDropRatio:
      evidence.peakRelativeDepth > 0
        ? evidence.depthReturnDrop / evidence.peakRelativeDepth
        : state.recoveryDropRatio ?? 0,
    squatEventCycle: {
      ...(state.squatEventCycle ?? {
        baselineFrozen: true,
        peakLatched: true,
        peakLatchedAtIndex: evidence.peakIndex,
        peakDepth: evidence.peakRelativeDepth,
        relativePeak: evidence.peakRelativeDepth,
        source: 'rule' as const,
        notes: [] as string[],
      }),
      detected: true,
      band: 'low_rom',
      baselineFrozen: true,
      peakLatched: true,
      peakLatchedAtIndex: evidence.peakIndex,
      descentDetected: true,
      reversalDetected: true,
      recoveryDetected: true,
      nearStandingRecovered: true,
      peakDepth: evidence.peakRelativeDepth,
      relativePeak: evidence.peakRelativeDepth,
      descentFrames: Math.max(2, LOW_ROM_MIN_PRE_PEAK_FRAMES),
      reversalFrames: evidence.reversalFrameCount,
      recoveryFrames: evidence.standingRecoveryFrameCount,
      source: 'rule',
      notes: ['low_rom_angle_rule_cycle_promoted'],
    },
  };

  nextState.completionTruthPassed = true;
  nextState.completionOwnerPassed = true;
  nextState.completionOwnerReason = 'low_rom_cycle';
  nextState.completionOwnerBlockedReason = null;
  nextState.uiProgressionAllowed = true;
  nextState.uiProgressionBlockedReason = null;

  const completionHints = (result.completionHints ?? []).filter((hint) => {
    return !new Set([
      'rep_phase_incomplete',
      'not_armed',
      'no_reversal',
      'not_standing_recovered',
      'recovery_hold_too_short',
      'low_rom_standing_finalize_not_satisfied',
    ]).has(hint);
  });

  const interpretedSignals = [
    ...(result.interpretedSignals ?? []),
    'low_rom_angle_rule_cycle_promoted',
  ];

  const highlightedMetrics = {
    ...(result.debug?.highlightedMetrics ?? {}),
    completionMachinePhase: 'completed',
    completionPassReason: 'low_rom_cycle',
    completionSatisfied: true,
    completionBlockedReason: null,
    successPhaseAtOpen: 'standing_recovered',
    squatEventCycleDetected: 1,
    squatEventCycleBandCode: 1,
    squatLowRomAngleRulePromoted: 1,
  };

  return {
    ...result,
    completionHints,
    interpretedSignals,
    debug: {
      ...(result.debug ?? {}),
      squatCompletionState: nextState,
      squatEventCycle: nextState.squatEventCycle,
      highlightedMetrics,
    },
  };
}

export function evaluateSquat(landmarks: PoseLandmarks[]): EvaluatorResult {
  const result = evaluateSquatBase(landmarks);
  const frames = buildPoseFeaturesFrames('squat', landmarks);
  return promoteAngleAwareLowRomRuleCycle(frames, result);
}
