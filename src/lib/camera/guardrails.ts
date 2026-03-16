/**
 * Capture quality / confidence guardrail 레이어
 * evaluator 위에서 입력 품질과 재촬영 권장 여부를 판단한다.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildPoseFeaturesFrames } from './pose-features';
import type { PoseFeaturesFrame } from './pose-features';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { EvaluatorResult } from './evaluators/types';
import type { PoseCaptureStats } from './use-pose-capture';

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
  | 'partial_capture'
  | 'unstable_motion_signal';

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

    if (depthValues.length < MIN_VALID_FRAMES) {
      flags.add('rep_incomplete');
      return { score: 0.2, status: 'partial' };
    }
    const peakDepth = Math.max(...depthValues);
    if (peakDepth < 0.45 || descentCount === 0 || bottomCount === 0 || ascentCount === 0) {
      flags.add('rep_incomplete');
      return { score: clamp(peakDepth), status: 'partial' };
    }
    return { score: clamp(peakDepth * 1.15), status: 'complete' };
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

  const holdFrames = frames.filter(
    (frame) => frame.phaseHint === 'hold_start' || frame.phaseHint === 'hold_ongoing'
  );
  const breakCount = frames.filter((frame) => frame.phaseHint === 'break').length;
  const firstHalf = Math.floor(holdFrames.length / 2);
  const secondHalf = holdFrames.length - firstHalf;

  if (firstHalf < 12) {
    flags.add('left_side_missing');
    flags.add('partial_capture');
  }
  if (secondHalf < 12) {
    flags.add('right_side_missing');
    flags.add('partial_capture');
  }
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

  const visibleJointsRatio = getVisibleJointsRatio(validFrames);
  const averageLandmarkConfidence = getAverageLandmarkConfidence(validFrames);
  const criticalJointsAvailability = getCriticalAvailability(validFrames);
  const bboxSizeStability = getBboxStability(validFrames);
  const validFrameCount = validFrames.length;
  const droppedFrameRatio =
    stats.sampledFrameCount > 0 ? stats.droppedFrameCount / stats.sampledFrameCount : 1;
  const noisyFrameRatio =
    validFrameCount > 0 ? countNoisyFrames(validFrames) / validFrameCount : 1;
  const leftSideCompleteness = getSideCompleteness(validFrames, 'left');
  const rightSideCompleteness = getSideCompleteness(validFrames, 'right');

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
  if (
    droppedFrameRatio > 0.45 ||
    noisyFrameRatio > 0.35 ||
    bboxSizeStability < 0.45 ||
    stats.timestampDiscontinuityCount > 0
  ) {
    flags.add('unstable_motion_signal');
  }
  if (leftSideCompleteness < 0.7 || rightSideCompleteness < 0.7) {
    flags.add('partial_capture');
  }

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
  const confidencePenalty =
    droppedFrameRatio * 0.18 +
    noisyFrameRatio * 0.12 +
    (averageLandmarkConfidence !== null && averageLandmarkConfidence < 0.45 ? 0.1 : 0);

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
    captureQuality !== 'ok' || confidence < 0.72 || flags.has('partial_capture');
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
    },
  };
}
