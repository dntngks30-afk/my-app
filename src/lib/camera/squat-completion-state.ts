import type { PoseFeaturesFrame } from './pose-features';
import { getSquatRecoverySignal } from './pose-features';
import {
  deriveSquatCompletionMachinePhase,
  deriveSquatCompletionPassReason,
  type SquatCompletionMachinePhase,
  type SquatCompletionPassReason,
} from '@/lib/camera/squat-completion-machine';
import type { MotionCompletionResult } from '@/lib/camera/types/motion-completion';

export type SquatCompletionPhase =
  | 'idle'
  | 'armed'
  | 'descending'
  | 'committed_bottom_or_downward_commitment'
  | 'ascending'
  | 'standing_recovered';

export type SquatEvidenceLabel =
  | 'standard'
  | 'low_rom'
  | 'ultra_low_rom'
  | 'insufficient_signal';

export interface SquatCompletionState extends MotionCompletionResult {
  baselineStandingDepth: number;
  rawDepthPeak: number;
  relativeDepthPeak: number;
  currentSquatPhase: SquatCompletionPhase;
  attemptStarted: boolean;
  descendConfirmed: boolean;
  downwardCommitmentReached: boolean;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendConfirmed: boolean;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs: number;
  successPhaseAtOpen?: 'standing_recovered';
  evidenceLabel: SquatEvidenceLabel;
  startBeforeBottom: boolean;
  bottomDetected: boolean;
  recoveryDetected: boolean;
  cycleComplete: boolean;
  descendStartAtMs?: number;
  peakAtMs?: number;
  ascendStartAtMs?: number;
  cycleDurationMs?: number;
  downwardCommitmentDelta: number;
  standingRecoveryFrameCount: number;
  standingRecoveryThreshold: number;
  lowRomRecoveryReason: string | null;
  ultraLowRomRecoveryReason: string | null;
  recoveryReturnContinuityFrames?: number;
  recoveryTrailingDepthCount?: number;
  recoveryDropRatio?: number;
  /** PR-CAM-02: 역전에 요구된 depth 하락량( squatDepthProxy 단위 ) */
  squatReversalDropRequired?: number;
  /** PR-CAM-02: 피크 이후 실제 관측 최대 하락량 */
  squatReversalDropAchieved?: number;
  /** PR-CAM-02: 첫 하강~피크 시간 */
  squatDescentToPeakMs?: number;
  /** PR-CAM-02: 역전(피크) 시각~서 있기 복귀 시각 */
  squatReversalToStandingMs?: number;
  /** PR-COMP-01: 트레이스용 completion 상태기계 단계 */
  completionMachinePhase: SquatCompletionMachinePhase;
  /** PR-COMP-01: 통과 시 ROM 사이클 분류 / 미통과 not_confirmed */
  completionPassReason: SquatCompletionPassReason;
}

const BASELINE_WINDOW = 6;
const MIN_BASELINE_FRAMES = 4;
const MIN_RELATIVE_DEPTH_FOR_ATTEMPT = 0.02;
const LOW_ROM_LABEL_FLOOR = 0.07;
const STANDARD_LABEL_FLOOR = 0.1;
const STANDING_RECOVERY_TOLERANCE_FLOOR = 0.015;
const STANDING_RECOVERY_TOLERANCE_RATIO = 0.18;
const MIN_STANDING_RECOVERY_FRAMES = 2;
const MIN_STANDING_RECOVERY_HOLD_MS = 160;
/** PR-CAM-02: 절대 최소 되돌림(미세 노이즈 역전 차단) */
const REVERSAL_DROP_MIN_ABS = 0.007;
/** PR-CAM-02: 상대 피크 대비 최소 되돌림 비율 — 깊은 스쿼트에서 0.005만으로 조기 역전 되는 것 방지 */
const REVERSAL_DROP_MIN_FRAC_OF_REL_PEAK = 0.13;
/**
 * PR-CAM-02: relativeDepthPeak < 이 값이면 하강→피크 최소 시간 요구(스파이크/미세 딥 차단).
 * 저ROM 유효 사이클은 유지하되 너무 짧은 excursion은 거부.
 */
const LOW_ROM_TIMING_PEAK_MAX = 0.1;
const MIN_DESCENT_TO_PEAK_MS_LOW_ROM = 200;
/**
 * PR-CAM-02: 얕은 ROM에서 피크(역전 시점) 이후 서 있기까지 최소 시간 — 미드 라이즈 조기 pass 완화.
 */
const SHALLOW_REVERSAL_TIMING_PEAK_MAX = 0.11;
const MIN_REVERSAL_TO_STANDING_MS_SHALLOW = 200;

function getStandingRecoveryWindow(
  frames: Array<{ index: number; depth: number; timestampMs: number }>,
  baselineStandingDepth: number,
  relativeDepthPeak: number
): {
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs: number;
  standingRecoveryFrameCount: number;
  standingRecoveryThreshold: number;
} {
  if (frames.length === 0) {
    return {
      standingRecoveryHoldMs: 0,
      standingRecoveryFrameCount: 0,
      standingRecoveryThreshold: STANDING_RECOVERY_TOLERANCE_FLOOR,
    };
  }

  const standingRecoveryThreshold = Math.max(
    STANDING_RECOVERY_TOLERANCE_FLOOR,
    relativeDepthPeak * STANDING_RECOVERY_TOLERANCE_RATIO
  );

  let standingRecoveryFrameCount = 0;
  let standingRecoveredIndex = -1;

  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const relativeDepth = Math.max(0, frames[i]!.depth - baselineStandingDepth);
    if (relativeDepth <= standingRecoveryThreshold) {
      standingRecoveryFrameCount += 1;
      standingRecoveredIndex = i;
    } else {
      break;
    }
  }

  if (standingRecoveredIndex < 0) {
    return {
      standingRecoveryHoldMs: 0,
      standingRecoveryFrameCount,
      standingRecoveryThreshold,
    };
  }

  const standingRecoveredAtMs = frames[standingRecoveredIndex]!.timestampMs;
  const standingRecoveryHoldMs =
    frames[frames.length - 1]!.timestampMs - standingRecoveredAtMs;

  return {
    standingRecoveredAtMs,
    standingRecoveryHoldMs,
    standingRecoveryFrameCount,
    standingRecoveryThreshold,
  };
}

export function evaluateSquatCompletionState(
  frames: PoseFeaturesFrame[]
): SquatCompletionState {
  const validFrames = frames.filter((frame) => frame.isValid);
  const depthFrames = validFrames
    .map((frame, index) => ({
      index,
      depth: frame.derived.squatDepthProxy,
      timestampMs: frame.timestampMs,
      phaseHint: frame.phaseHint,
    }))
    .filter(
      (
        frame
      ): frame is {
        index: number;
        depth: number;
        timestampMs: number;
        phaseHint: PoseFeaturesFrame['phaseHint'];
      } => typeof frame.depth === 'number'
    );

  if (depthFrames.length === 0) {
    const emptyBase = {
      baselineStandingDepth: 0,
      rawDepthPeak: 0,
      relativeDepthPeak: 0,
      currentSquatPhase: 'idle' as const,
      attemptStarted: false,
      descendConfirmed: false,
      downwardCommitmentReached: false,
      ascendConfirmed: false,
      standingRecoveryHoldMs: 0,
      evidenceLabel: 'insufficient_signal' as const,
      completionBlockedReason: 'not_armed',
      completionSatisfied: false,
      startBeforeBottom: false,
      bottomDetected: false,
      recoveryDetected: false,
      cycleComplete: false,
      downwardCommitmentDelta: 0,
      standingRecoveryFrameCount: 0,
      standingRecoveryThreshold: STANDING_RECOVERY_TOLERANCE_FLOOR,
      lowRomRecoveryReason: null,
      ultraLowRomRecoveryReason: null,
    };
    return {
      ...emptyBase,
      completionMachinePhase: deriveSquatCompletionMachinePhase(emptyBase),
      completionPassReason: deriveSquatCompletionPassReason(emptyBase),
    };
  }

  const baselineDepths = depthFrames
    .slice(0, BASELINE_WINDOW)
    .map((frame) => frame.depth);
  const baselineStandingDepth =
    baselineDepths.length > 0 ? Math.min(...baselineDepths) : 0;

  const peakFrame = depthFrames.reduce((best, frame) =>
    frame.depth > best.depth ? frame : best
  );
  const rawDepthPeak = peakFrame.depth;
  const relativeDepthPeak = Math.max(0, rawDepthPeak - baselineStandingDepth);

  const descentFrame = depthFrames.find((frame) => frame.phaseHint === 'descent');
  const bottomFrame = depthFrames.find((frame) => frame.phaseHint === 'bottom');
  const ascentFrame = depthFrames.find(
    (frame) => frame.phaseHint === 'ascent' && frame.index > peakFrame.index
  );
  const startFrame = depthFrames.find((frame) => frame.phaseHint === 'start');
  const startBeforeBottom =
    startFrame != null &&
    (bottomFrame == null || startFrame.index < bottomFrame.index);

  const prePeakDepths = depthFrames
    .filter((frame) => frame.index < peakFrame.index)
    .map((frame) => frame.depth);
  const minPrePeakDepth =
    prePeakDepths.length > 0 ? Math.min(...prePeakDepths) : baselineStandingDepth;
  const downwardCommitmentDelta = Math.max(0, rawDepthPeak - minPrePeakDepth);
  const downwardCommitmentReached =
    relativeDepthPeak >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT ||
    downwardCommitmentDelta >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT ||
    bottomFrame != null;

  const committedFrame =
    bottomFrame ??
    depthFrames.find(
      (frame) =>
        frame.index >= (descentFrame?.index ?? 0) &&
        frame.depth - baselineStandingDepth >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT
    );

  /** 피크 대비 되돌림 요구량: 깊을수록 큰 상승 구간을 요구해 조기 역전·미드라이즈 오판 감소 */
  const squatReversalDropRequired = Math.max(
    REVERSAL_DROP_MIN_ABS,
    relativeDepthPeak * REVERSAL_DROP_MIN_FRAC_OF_REL_PEAK
  );
  const postPeakDepths = depthFrames
    .filter((frame) => frame.index > peakFrame.index)
    .map((frame) => frame.depth);
  const minPostPeakDepth =
    postPeakDepths.length > 0 ? Math.min(...postPeakDepths) : peakFrame.depth;
  const squatReversalDropAchieved = Math.max(0, peakFrame.depth - minPostPeakDepth);

  const hasPostPeakDrop = depthFrames.some(
    (frame) =>
      frame.index > peakFrame.index &&
      frame.depth <= peakFrame.depth - squatReversalDropRequired
  );
  const reversalFrame =
    committedFrame != null && hasPostPeakDrop ? peakFrame : undefined;
  const ascendConfirmed =
    ascentFrame != null ||
    (reversalFrame != null &&
      depthFrames.some(
        (frame) =>
          frame.index > reversalFrame.index &&
          frame.depth < peakFrame.depth - squatReversalDropRequired
      ));

  const recovery = getSquatRecoverySignal(validFrames);
  const standingRecovery = getStandingRecoveryWindow(
    depthFrames.filter((frame) => frame.index > peakFrame.index),
    baselineStandingDepth,
    relativeDepthPeak
  );

  const armed =
    baselineDepths.length >= MIN_BASELINE_FRAMES &&
    startFrame != null &&
    startBeforeBottom;
  const descendConfirmed = descentFrame != null && armed;
  const attemptStarted = descendConfirmed && downwardCommitmentReached;
  const bottomDetected = bottomFrame != null;
  const recoveryDetected = standingRecovery.standingRecoveredAtMs != null;

  let currentSquatPhase: SquatCompletionPhase = 'idle';
  if (armed) currentSquatPhase = 'armed';
  if (descendConfirmed) currentSquatPhase = 'descending';
  if (committedFrame != null && downwardCommitmentReached) {
    currentSquatPhase = 'committed_bottom_or_downward_commitment';
  }
  if (ascendConfirmed && reversalFrame != null) {
    currentSquatPhase = 'ascending';
  }
  if (
    ascendConfirmed &&
    standingRecovery.standingRecoveredAtMs != null &&
    standingRecovery.standingRecoveryFrameCount >= MIN_STANDING_RECOVERY_FRAMES &&
    standingRecovery.standingRecoveryHoldMs >= MIN_STANDING_RECOVERY_HOLD_MS
  ) {
    currentSquatPhase = 'standing_recovered';
  }

  const evidenceLabel: SquatEvidenceLabel =
    relativeDepthPeak >= STANDARD_LABEL_FLOOR
      ? 'standard'
      : relativeDepthPeak >= LOW_ROM_LABEL_FLOOR
        ? 'low_rom'
        : relativeDepthPeak >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT
          ? 'ultra_low_rom'
          : 'insufficient_signal';

  let completionBlockedReason: string | null = null;
  if (!armed) {
    completionBlockedReason = 'not_armed';
  } else if (!descendConfirmed) {
    completionBlockedReason = 'no_descend';
  } else if (relativeDepthPeak < MIN_RELATIVE_DEPTH_FOR_ATTEMPT) {
    completionBlockedReason = 'insufficient_relative_depth';
  } else if (!downwardCommitmentReached || committedFrame == null) {
    completionBlockedReason = 'no_commitment';
  } else if (reversalFrame == null) {
    completionBlockedReason = 'no_reversal';
  } else if (!ascendConfirmed) {
    completionBlockedReason = 'no_ascend';
  } else if (standingRecovery.standingRecoveredAtMs == null) {
    completionBlockedReason = 'not_standing_recovered';
  } else if (
    standingRecovery.standingRecoveryFrameCount < MIN_STANDING_RECOVERY_FRAMES ||
    standingRecovery.standingRecoveryHoldMs < MIN_STANDING_RECOVERY_HOLD_MS
  ) {
    completionBlockedReason = 'recovery_hold_too_short';
  } else if (
    relativeDepthPeak < LOW_ROM_TIMING_PEAK_MAX &&
    descentFrame != null &&
    peakFrame.timestampMs - descentFrame.timestampMs < MIN_DESCENT_TO_PEAK_MS_LOW_ROM
  ) {
    completionBlockedReason = 'descent_span_too_short';
  } else if (
    relativeDepthPeak < SHALLOW_REVERSAL_TIMING_PEAK_MAX &&
    reversalFrame != null &&
    standingRecovery.standingRecoveredAtMs != null &&
    standingRecovery.standingRecoveredAtMs - reversalFrame.timestampMs <
      MIN_REVERSAL_TO_STANDING_MS_SHALLOW
  ) {
    completionBlockedReason = 'ascent_recovery_span_too_short';
  }

  const squatDescentToPeakMs =
    descentFrame != null ? peakFrame.timestampMs - descentFrame.timestampMs : undefined;
  const squatReversalToStandingMs =
    reversalFrame != null && standingRecovery.standingRecoveredAtMs != null
      ? standingRecovery.standingRecoveredAtMs - reversalFrame.timestampMs
      : undefined;

  const completionSatisfied = completionBlockedReason == null;

  return {
    baselineStandingDepth,
    rawDepthPeak,
    relativeDepthPeak,
    currentSquatPhase,
    attemptStarted,
    descendConfirmed,
    downwardCommitmentReached,
    committedAtMs: committedFrame?.timestampMs,
    reversalAtMs: reversalFrame?.timestampMs,
    ascendConfirmed,
    standingRecoveredAtMs: standingRecovery.standingRecoveredAtMs,
    standingRecoveryHoldMs: standingRecovery.standingRecoveryHoldMs,
    successPhaseAtOpen: completionSatisfied ? 'standing_recovered' : undefined,
    evidenceLabel,
    completionBlockedReason,
    completionSatisfied,
    startBeforeBottom,
    bottomDetected,
    recoveryDetected,
    cycleComplete: completionSatisfied,
    descendStartAtMs: descentFrame?.timestampMs,
    peakAtMs: peakFrame.timestampMs,
    ascendStartAtMs: ascentFrame?.timestampMs,
    cycleDurationMs:
      descentFrame != null && standingRecovery.standingRecoveredAtMs != null
        ? standingRecovery.standingRecoveredAtMs - descentFrame.timestampMs
        : undefined,
    downwardCommitmentDelta,
    standingRecoveryFrameCount: standingRecovery.standingRecoveryFrameCount,
    standingRecoveryThreshold: standingRecovery.standingRecoveryThreshold,
    lowRomRecoveryReason: recovery.lowRomRecoveryReason ?? null,
    ultraLowRomRecoveryReason: recovery.ultraLowRomRecoveryReason ?? null,
    recoveryReturnContinuityFrames: recovery.returnContinuityFrames,
    recoveryTrailingDepthCount: recovery.trailingDepthCount,
    recoveryDropRatio: recovery.recoveryDropRatio,
    squatReversalDropRequired,
    squatReversalDropAchieved,
    squatDescentToPeakMs,
    squatReversalToStandingMs,
    completionMachinePhase: deriveSquatCompletionMachinePhase({
      completionSatisfied,
      currentSquatPhase,
      downwardCommitmentReached,
    }),
    completionPassReason: deriveSquatCompletionPassReason({
      completionSatisfied,
      evidenceLabel,
    }),
  };
}
