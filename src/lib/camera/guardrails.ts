/**
 * Capture quality / confidence guardrail 레이어
 * evaluator 위에서 입력 품질과 재촬영 권장 여부를 판단한다.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildPoseFeaturesFrames, getSquatRecoverySignal } from './pose-features';
import type { PoseFeaturesFrame } from './pose-features';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult } from './evaluators/types';
import type { PoseCaptureStats } from './use-pose-capture';
import { selectQualityWindow } from './stability';

export type CaptureQuality = 'ok' | 'low' | 'invalid';
export type CameraFallbackMode = 'survey' | 'retry' | null;
export type CameraGuardrailFlag =
  | 'insufficient_signal'
  | 'framing_invalid'
  | 'landmark_confidence_low'
  | 'valid_frames_too_few'
  | 'rep_incomplete'
  | 'hold_too_short'
  | 'left_side_missing'
  | 'right_side_missing'
  | 'soft_partial'
  | 'hard_partial'
  | 'unstable_frame_timing'
  | 'unstable_bbox'
  | 'unstable_landmarks'
  | 'unilateral_joint_dropout';

type CompletionStatus = 'complete' | 'partial' | 'insufficient';

interface StepMetrics {
  visibleJointsRatio: number;
  averageLandmarkConfidence: number | null;
  criticalJointsAvailability: number;
  bboxSizeStability: number;
  validFrameCount: number;
  droppedFrameRatio: number;
  noisyFrameRatio: number;
  leftSideCompleteness: number;
  rightSideCompleteness: number;
  motionCompleteness: number;
  completionStatus: CompletionStatus;
}

export interface StepGuardrailDebug extends StepMetrics {
  sampledFrameCount: number;
  droppedFrameCount: number;
  captureDurationMs: number;
  metricSufficiency: number;
  timestampDiscontinuityCount?: number;
  warmupExcludedFrameCount?: number;
  qualityFrameCount?: number;
  selectedWindowStartMs?: number | null;
  selectedWindowEndMs?: number | null;
  selectedWindowScore?: number | null;
  /** PR-2: per-step 진단 (evaluator에서 전달, additive) */
  perStepDiagnostics?: Record<string, unknown>;
  /**
   * 발목 Y 좌표 평균 (visibility >= 0.35 인 발목 랜드마크 기준).
   * null = 충분한 가시성의 발목 랜드마크 없음 (화면 밖 또는 미감지).
   * live-readiness 에서 전신 화면 포함 여부 판단에 사용.
   */
  ankleYMean?: number | null;
}

export interface StepGuardrailResult {
  stepId: CameraStepId;
  captureQuality: CaptureQuality;
  confidence: number;
  flags: CameraGuardrailFlag[];
  retryRecommended: boolean;
  fallbackMode: CameraFallbackMode;
  completionStatus: CompletionStatus;
  debug: StepGuardrailDebug;
}

const MIN_VALID_FRAMES = 8;
/** PR G9: noise floor 0.10 — 이하만 partial. shallower valid cycle complete 허용 */
const SQUAT_NOISE_FLOOR = 0.1;
/** PR G11: low-ROM floor 0.07 — 7–10% excursion with strict recovery can complete */
const SQUAT_LOW_ROM_FLOOR = 0.07;
const WARMUP_MS = 500;
const BEST_WINDOW_MIN_MS = 800;
const BEST_WINDOW_MAX_MS = 1200;
const JITTER_PENALTY_CAP = 0.12;
const FRAMING_PENALTY_CAP = 0.08;
const LANDMARK_PENALTY_CAP = 0.06;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getVisibleJointsRatio(frames: PoseFeaturesFrame[]): number {
  if (frames.length === 0) return 0;
  return mean(frames.map((frame) => frame.visibilitySummary.visibleLandmarkRatio));
}

function getAverageLandmarkConfidence(frames: PoseFeaturesFrame[]): number | null {
  const values = frames
    .map((frame) => frame.visibilitySummary.averageVisibility)
    .filter((value): value is number => typeof value === 'number');
  return values.length > 0 ? mean(values) : null;
}

function getCriticalAvailability(frames: PoseFeaturesFrame[]): number {
  if (frames.length === 0) return 0;
  return mean(frames.map((frame) => frame.visibilitySummary.criticalJointsAvailability));
}

function getSideCompleteness(
  frames: PoseFeaturesFrame[],
  side: 'left' | 'right'
): number {
  if (frames.length === 0) return 0;
  return mean(
    frames.map((frame) =>
      side === 'left'
        ? frame.visibilitySummary.leftSideCompleteness
        : frame.visibilitySummary.rightSideCompleteness
    )
  );
}

function getBboxStability(frames: PoseFeaturesFrame[]): number {
  const areas = frames.map((frame) => frame.bodyBox.area).filter((area) => area > 0);
  if (areas.length < 2) return 0;
  const avg = mean(areas);
  if (avg <= 0) return 0;
  const variance = mean(areas.map((area) => (area - avg) ** 2));
  const stdDev = Math.sqrt(variance);
  return clamp(1 - stdDev / avg);
}

/**
 * visibility >= 0.35 인 발목 랜드마크의 Y 좌표 평균을 반환한다.
 * 반환값이 null 이면 확인 가능한 발목 랜드마크가 없음을 의미한다.
 */
function getAnkleYMean(frames: PoseFeaturesFrame[]): number | null {
  const ys: number[] = [];
  for (const frame of frames) {
    const left = frame.joints.leftAnkle;
    const right = frame.joints.rightAnkle;
    // visibility 미제공 시 1로 간주 (레거시 프레임 호환)
    if (left && (left.visibility ?? 1) >= 0.35) ys.push(left.y);
    if (right && (right.visibility ?? 1) >= 0.35) ys.push(right.y);
  }
  return ys.length > 0 ? mean(ys) : null;
}

function countNoisyFrames(frames: PoseFeaturesFrame[]): number {
  return frames.filter((frame) => {
    return (
      frame.frameValidity !== 'valid' ||
      frame.bodyBox.area < 0.05 ||
      frame.bodyBox.area > 0.95 ||
      frame.qualityHints.includes('timestamp_gap')
    );
  }).length;
}

function getMotionCompleteness(
  stepId: CameraStepId,
  frames: PoseFeaturesFrame[],
  stats: PoseCaptureStats,
  flags: Set<CameraGuardrailFlag>
): { score: number; status: CompletionStatus } {
  if (frames.length < MIN_VALID_FRAMES) {
    flags.add('insufficient_signal');
    flags.add('valid_frames_too_few');
    return { score: 0, status: 'insufficient' };
  }

  if (stepId === 'squat') {
    const depthValues = frames
      .map((frame) => frame.derived.squatDepthProxy)
      .filter((value): value is number => typeof value === 'number');
    const descentCount = frames.filter((frame) => frame.phaseHint === 'descent').length;
    const bottomCount = frames.filter((frame) => frame.phaseHint === 'bottom').length;
    const ascentCount = frames.filter((frame) => frame.phaseHint === 'ascent').length;
    const recovery = getSquatRecoverySignal(frames);
    const ascentSatisfied = ascentCount > 0 || recovery.recovered || recovery.lowRomRecovered;

    if (depthValues.length < MIN_VALID_FRAMES) {
      flags.add('rep_incomplete');
      return { score: 0.2, status: 'partial' };
    }
    const peakDepth = Math.max(...depthValues);
    /** PR G10: recovery proves meaningful excursion. Allow complete without bottom phase. */
    const standardExcursion = bottomCount > 0 || recovery.recovered;
    /** PR G11: low-ROM path — peak 7–10%, stricter recovery proof. */
    const lowRomExcursion =
      peakDepth >= SQUAT_LOW_ROM_FLOOR &&
      peakDepth < SQUAT_NOISE_FLOOR &&
      recovery.lowRomRecovered;
    const excursionOrBottom = standardExcursion || lowRomExcursion;
    if (
      peakDepth < SQUAT_LOW_ROM_FLOOR ||
      descentCount === 0 ||
      !excursionOrBottom ||
      !ascentSatisfied
    ) {
      flags.add('rep_incomplete');
      return { score: clamp(peakDepth), status: 'partial' };
    }
    return { score: clamp(0.45 + peakDepth * 0.55), status: 'complete' };
  }

  if (stepId === 'wall-angel') {
    const armElevations = frames
      .map((frame) => frame.derived.armElevationAvg)
      .filter((value): value is number => typeof value === 'number');
    const raiseCount = frames.filter((frame) => frame.phaseHint === 'raise').length;
    const peakCount = frames.filter((frame) => frame.phaseHint === 'peak').length;
    const lowerCount = frames.filter((frame) => frame.phaseHint === 'lower').length;
    const peakElevation = armElevations.length > 0 ? Math.max(...armElevations) : 0;

    if (frames.length < 12 || peakElevation < 95 || raiseCount === 0 || peakCount === 0 || lowerCount === 0) {
      flags.add('rep_incomplete');
      return { score: clamp(peakElevation / 140), status: 'partial' };
    }
    return { score: clamp(peakElevation / 155), status: 'complete' };
  }

  /* PR G8/G9: overhead reach — hold_too_short at 650ms creates buffer before completion (800ms).
   * PR G10: hold only counts after true top entry — blocks early pass from arm raise alone. */
  if (stepId === 'overhead-reach') {
    const armElevations = frames
      .map((frame) => frame.derived.armElevationAvg)
      .filter((value): value is number => typeof value === 'number');
    const peakFrames = frames.filter((frame) => frame.phaseHint === 'peak');
    const raiseCount = frames.filter((frame) => frame.phaseHint === 'raise').length;
    const peakElevation = armElevations.length > 0 ? Math.max(...armElevations) : 0;
    const topEntryThreshold = Math.max(peakElevation * 0.95, 118);
    let topEntryIndex = -1;
    for (let i = 0; i < frames.length; i++) {
      const e = frames[i]!.derived.armElevationAvg;
      const prev = i > 0 ? frames[i - 1]!.derived.armElevationAvg : null;
      const delta = typeof e === 'number' && typeof prev === 'number' ? e - prev : 0;
      if (typeof e === 'number' && e >= topEntryThreshold && Math.abs(delta) < 2.6) {
        topEntryIndex = i;
        break;
      }
    }
    const topConfirmedPeaks =
      topEntryIndex >= 0 ? peakFrames.filter((f) => frames.indexOf(f) >= topEntryIndex) : [];
    const peakCount = topConfirmedPeaks.length;
    const holdDurationMs =
      topConfirmedPeaks.length > 1
        ? topConfirmedPeaks[topConfirmedPeaks.length - 1]!.timestampMs - topConfirmedPeaks[0]!.timestampMs
        : 0;

    if (frames.length < 10 || peakElevation < 120 || raiseCount === 0 || peakCount === 0) {
      flags.add('rep_incomplete');
      return { score: clamp(peakElevation / 150), status: 'partial' };
    }
    if (holdDurationMs < 650) {
      flags.add('hold_too_short');
      return { score: clamp(Math.max(peakElevation / 155, holdDurationMs / 900)), status: 'partial' };
    }
    return {
      score: clamp(Math.min(peakElevation / 160, Math.max(holdDurationMs / 900, 0.75))),
      status: 'complete',
    };
  }

  const holdFrames = frames.filter(
    (frame) => frame.phaseHint === 'hold_start' || frame.phaseHint === 'hold_ongoing'
  );
  const breakCount = frames.filter((frame) => frame.phaseHint === 'break').length;
  const firstHalf = Math.floor(holdFrames.length / 2);
  const secondHalf = holdFrames.length - firstHalf;

  if (firstHalf < 12) flags.add('left_side_missing');
  if (secondHalf < 12) flags.add('right_side_missing');
  if (firstHalf < 12 || secondHalf < 12) flags.add('hard_partial');
  if (stats.captureDurationMs < 6000 || frames.length < 45) {
    flags.add('hold_too_short');
  }

  const holdDurationMs =
    holdFrames.length > 1 ? holdFrames[holdFrames.length - 1]!.timestampMs - holdFrames[0]!.timestampMs : 0;
  const halfScore = clamp(Math.min(firstHalf, secondHalf) / 35);
  if (flags.has('left_side_missing') || flags.has('right_side_missing')) {
    return { score: clamp(halfScore * 0.7), status: 'partial' };
  }
  if (flags.has('hold_too_short') || holdFrames.length === 0 || breakCount > 0) {
    return { score: clamp(Math.max(holdDurationMs / 9000, holdFrames.length / 70)), status: 'partial' };
  }
  return { score: clamp(Math.min(holdDurationMs / 9000, holdFrames.length / 80)), status: 'complete' };
}

function getMetricSufficiency(stepId: CameraStepId, evaluatorResult: EvaluatorResult): number {
  const expectedMetricsByStep: Record<CameraStepId, number> = {
    squat: 4,
    'overhead-reach': 3,
    'wall-angel': 3,
    'single-leg-balance': 4,
  };
  return clamp(evaluatorResult.metrics.length / expectedMetricsByStep[stepId]);
}

export function assessStepGuardrail(
  stepId: CameraStepId,
  frames: PoseLandmarks[],
  stats: PoseCaptureStats,
  evaluatorResult: EvaluatorResult
): StepGuardrailResult {
  const featureFrames = buildPoseFeaturesFrames(stepId, frames);
  const validFrames = featureFrames.filter((frame) => frame.isValid);
  const flags = new Set<CameraGuardrailFlag>();

  const qualitySelection = selectQualityWindow(validFrames, {
    warmupMs: WARMUP_MS,
    minWindowMs: BEST_WINDOW_MIN_MS,
    maxWindowMs: BEST_WINDOW_MAX_MS,
  });
  const qualityFrames = qualitySelection.frames;

  const visibleJointsRatio = getVisibleJointsRatio(qualityFrames);
  const averageLandmarkConfidence = getAverageLandmarkConfidence(qualityFrames);
  const criticalJointsAvailability = getCriticalAvailability(qualityFrames);
  const bboxSizeStability = getBboxStability(qualityFrames);
  const validFrameCount = validFrames.length;
  const droppedFrameRatio =
    stats.sampledFrameCount > 0 ? stats.droppedFrameCount / stats.sampledFrameCount : 1;
  const noisyFrameRatio =
    validFrameCount > 0 ? countNoisyFrames(validFrames) / validFrameCount : 1;
  const leftSideCompleteness = getSideCompleteness(qualityFrames, 'left');
  const rightSideCompleteness = getSideCompleteness(qualityFrames, 'right');

  if (validFrameCount < MIN_VALID_FRAMES) {
    flags.add('insufficient_signal');
    flags.add('valid_frames_too_few');
  }
  if (visibleJointsRatio < 0.45) flags.add('framing_invalid');
  if (averageLandmarkConfidence !== null && averageLandmarkConfidence < 0.45) {
    flags.add('landmark_confidence_low');
  }
  if (leftSideCompleteness < 0.55) flags.add('left_side_missing');
  if (rightSideCompleteness < 0.55) flags.add('right_side_missing');
  if (Math.abs(leftSideCompleteness - rightSideCompleteness) > 0.35) {
    flags.add('unilateral_joint_dropout');
  }
  const perStep = evaluatorResult.debug?.perStepDiagnostics;
  if (perStep && typeof perStep === 'object') {
    const steps = Object.values(perStep) as Array<{
      missingCriticalJoints?: string[];
      criticalJointAvailability?: number;
      leftSideCompleteness?: number;
      rightSideCompleteness?: number;
    }>;
    const hasHardPartial = steps.some(
      (s) =>
        (s.missingCriticalJoints?.length ?? 0) >= 2 ||
        (s.leftSideCompleteness ?? 1) < 0.55 ||
        (s.rightSideCompleteness ?? 1) < 0.55
    );
    const hasSoftPartial = steps.some(
      (s) =>
        ((s.missingCriticalJoints?.length ?? 0) === 1 && (s.criticalJointAvailability ?? 0) >= 0.6) ||
        ((s.leftSideCompleteness ?? 0) >= 0.55 && (s.leftSideCompleteness ?? 0) < 0.7) ||
        ((s.rightSideCompleteness ?? 0) >= 0.55 && (s.rightSideCompleteness ?? 0) < 0.7)
    );
    if (hasHardPartial) flags.add('hard_partial');
    else if (hasSoftPartial) flags.add('soft_partial');
  } else {
    if (leftSideCompleteness < 0.55 || rightSideCompleteness < 0.55) {
      flags.add('hard_partial');
    }
    if (
      (leftSideCompleteness >= 0.55 && leftSideCompleteness < 0.7) ||
      (rightSideCompleteness >= 0.55 && rightSideCompleteness < 0.7)
    ) {
      flags.add('soft_partial');
    }
  }
  if (droppedFrameRatio > 0.45 || stats.timestampDiscontinuityCount > 0) {
    flags.add('unstable_frame_timing');
  }
  if (bboxSizeStability < 0.45) flags.add('unstable_bbox');
  if (noisyFrameRatio > 0.35) flags.add('unstable_landmarks');

  const motion = getMotionCompleteness(stepId, validFrames, stats, flags);
  const metricSufficiency = getMetricSufficiency(stepId, evaluatorResult);

  let captureQuality: CaptureQuality = 'ok';
  if (
    validFrameCount < MIN_VALID_FRAMES ||
    criticalJointsAvailability < 0.4 ||
    visibleJointsRatio < 0.35 ||
    motion.status === 'insufficient'
  ) {
    captureQuality = 'invalid';
  } else if (
    validFrameCount < 16 ||
    criticalJointsAvailability < 0.7 ||
    droppedFrameRatio > 0.25 ||
    noisyFrameRatio > 0.25 ||
    motion.status === 'partial' ||
    leftSideCompleteness < 0.8 ||
    rightSideCompleteness < 0.8
  ) {
    captureQuality = 'low';
  }

  const qualityScore = captureQuality === 'ok' ? 1 : captureQuality === 'low' ? 0.65 : 0.2;
  const validFrameScore = clamp(validFrameCount / 30);
  const sideScore = Math.min(leftSideCompleteness, rightSideCompleteness);

  const jitterRaw =
    (flags.has('unstable_frame_timing') ? droppedFrameRatio * 0.08 : 0) +
    (flags.has('unstable_landmarks') ? noisyFrameRatio * 0.06 : 0);
  const framingRaw =
    (flags.has('soft_partial') ? 0.04 : 0) + (flags.has('hard_partial') ? 0.06 : 0);
  const landmarkRaw =
    averageLandmarkConfidence !== null && averageLandmarkConfidence < 0.45 ? 0.1 : 0;
  const confidencePenalty =
    Math.min(jitterRaw, JITTER_PENALTY_CAP) +
    Math.min(framingRaw, FRAMING_PENALTY_CAP) +
    Math.min(landmarkRaw, LANDMARK_PENALTY_CAP);

  const confidence = round(
    clamp(
      qualityScore * 0.3 +
        validFrameScore * 0.18 +
        motion.score * 0.22 +
        criticalJointsAvailability * 0.15 +
        sideScore * 0.08 +
        bboxSizeStability * 0.04 +
        metricSufficiency * 0.03 -
        confidencePenalty
    )
  );

  const retryRecommended =
    captureQuality !== 'ok' || confidence < 0.72 || flags.has('hard_partial');
  const fallbackMode: CameraFallbackMode =
    captureQuality === 'invalid' ? 'survey' : retryRecommended ? 'retry' : null;

  return {
    stepId,
    captureQuality,
    confidence,
    flags: Array.from(flags),
    retryRecommended,
    fallbackMode,
    completionStatus: motion.status,
    debug: {
      visibleJointsRatio: round(visibleJointsRatio),
      averageLandmarkConfidence:
        averageLandmarkConfidence === null ? null : round(averageLandmarkConfidence),
      criticalJointsAvailability: round(criticalJointsAvailability),
      bboxSizeStability: round(bboxSizeStability),
      validFrameCount,
      droppedFrameRatio: round(droppedFrameRatio),
      noisyFrameRatio: round(noisyFrameRatio),
      leftSideCompleteness: round(leftSideCompleteness),
      rightSideCompleteness: round(rightSideCompleteness),
      motionCompleteness: round(motion.score),
      completionStatus: motion.status,
      sampledFrameCount: stats.sampledFrameCount,
      droppedFrameCount: stats.droppedFrameCount,
      captureDurationMs: Math.round(stats.captureDurationMs),
      metricSufficiency: round(metricSufficiency),
      timestampDiscontinuityCount: stats.timestampDiscontinuityCount,
      warmupExcludedFrameCount: qualitySelection.warmupExcludedFrameCount,
      qualityFrameCount: qualitySelection.qualityFrameCount,
      selectedWindowStartMs: qualitySelection.selectedWindowStartMs,
      selectedWindowEndMs: qualitySelection.selectedWindowEndMs,
      selectedWindowScore: qualitySelection.selectedWindowScore === null
        ? null
        : round(qualitySelection.selectedWindowScore),
      perStepDiagnostics: evaluatorResult.debug?.perStepDiagnostics,
      ankleYMean: getAnkleYMean(qualityFrames),
    },
  };
}
