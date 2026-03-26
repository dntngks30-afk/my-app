import type { PoseFeaturesFrame } from './pose-features';
import { getSquatRecoverySignal } from './pose-features';
import {
  deriveSquatCompletionMachinePhase,
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
/**
 * PR-CAM-22: standard owner는 evidence label보다 더 깊은 성공에만 부여한다.
 *
 * evidenceLabel 은 interpretation/quality 범주라 0.10부터 broad하게 standard를 허용하지만,
 * pass owner는 더 보수적으로 잡아 observed shallow/moderate success(relativeDepthPeak ~0.30)가
 * standard_cycle을 너무 일찍 먹지 않게 한다.
 */
const STANDARD_OWNER_FLOOR = 0.4;
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
      completionPassReason: 'not_confirmed' as const,
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

  /**
   * PR-CAM-18: event-cycle descent 탐지 — low/ultra-low ROM에서 phaseHint='start'가 우선해
   * 'descent'가 절대 배정되지 않는 경우(모든 프레임 depth < 0.08)를 위한 trajectory 기반 폴백.
   *
   * phaseHints 우선순위 구조: `if (currentDepth < 0.08) → 'start'` 가 먼저 평가되므로
   * ultra-low-ROM 사용자(peak depth < 0.08)의 모든 프레임은 'start'만 받고
   * 'descent'/'ascent'/'bottom'이 배정되지 않는다.
   *
   * 수정 범위: 이 변수 쌍 + descendConfirmed + 타이밍 체크 + squatDescentToPeakMs 만.
   * 그 외 evaluator, guardrail, auto-progression, threshold는 일절 변경하지 않는다.
   */
  const effectiveDescentStartFrame: {
    index: number;
    depth: number;
    timestampMs: number;
    phaseHint: PoseFeaturesFrame['phaseHint'];
  } | undefined =
    descentFrame ??
    (relativeDepthPeak >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT
      ? depthFrames.find(
          (f) =>
            f.depth - baselineStandingDepth >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT * 0.4
        )
      : undefined);

  /** phaseHint 기반 descent가 없으면 true — completionPassReason 구분용 */
  const eventBasedDescentPath =
    descentFrame == null &&
    relativeDepthPeak >= MIN_RELATIVE_DEPTH_FOR_ATTEMPT &&
    effectiveDescentStartFrame != null;

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
  /** PR-CAM-18: phaseHint 'descent' 미탐지 시 trajectory 폴백 허용 */
  const descendConfirmed = (descentFrame != null || eventBasedDescentPath) && armed;
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
    effectiveDescentStartFrame != null &&
    peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs < MIN_DESCENT_TO_PEAK_MS_LOW_ROM
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

  /** PR-CAM-18: phaseHint 기반 descentFrame이 없을 때 effectiveDescentStartFrame으로 폴백 */
  const squatDescentToPeakMs =
    effectiveDescentStartFrame != null
      ? peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs
      : undefined;
  const squatReversalToStandingMs =
    reversalFrame != null && standingRecovery.standingRecoveredAtMs != null
      ? standingRecovery.standingRecoveredAtMs - reversalFrame.timestampMs
      : undefined;

  /**
   * PR-CAM-21: completion owner는 evidenceLabel이 아니라 "실제 통과 경로"에서 고른다.
   *
   * 구분 원칙:
   * - blocked → not_confirmed
   * - standard path:
   *   - phaseHint descent 경로를 실제로 탔고(eventBasedDescentPath === false)
   *   - owner 전용 cutoff(STANDARD_OWNER_FLOOR) 이상으로 충분히 깊은 경우
   * - 그 외 성공은 event-cycle owner:
   *   - low_rom_event_cycle / ultra_low_rom_event_cycle
   *
   * 즉 evidenceLabel은 여전히 quality/interpretation label이지만,
   * completionPassReason 자체를 결정하는 source-of-truth 는 아니다.
   */
  const standardPathWon =
    completionBlockedReason == null &&
    eventBasedDescentPath === false &&
    relativeDepthPeak >= STANDARD_OWNER_FLOOR;

  const completionPassReason: SquatCompletionPassReason =
    completionBlockedReason != null
      ? 'not_confirmed'
      : standardPathWon
        ? 'standard_cycle'
        : relativeDepthPeak >= LOW_ROM_LABEL_FLOOR
          ? 'low_rom_event_cycle'
          : 'ultra_low_rom_event_cycle';

  const completionSatisfied = completionPassReason !== 'not_confirmed';

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
    /** PR-CAM-18: phaseHint 'descent' 없는 경우 effectiveDescentStartFrame 타임스탬프로 폴백 */
    descendStartAtMs: effectiveDescentStartFrame?.timestampMs,
    peakAtMs: peakFrame.timestampMs,
    ascendStartAtMs: ascentFrame?.timestampMs,
    cycleDurationMs:
      effectiveDescentStartFrame != null && standingRecovery.standingRecoveredAtMs != null
        ? standingRecovery.standingRecoveredAtMs - effectiveDescentStartFrame.timestampMs
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
    completionPassReason,
  };
}
