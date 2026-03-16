/**
 * Capture quality / confidence guardrail 레이어
 * evaluator 위에서 입력 품질과 재촬영 권장 여부를 판단한다.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import { POSE_LANDMARKS } from '@/lib/motion/pose-types';
import type { PoseLandmark, PoseLandmarks } from '@/lib/motion/pose-types';
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

const VISIBILITY_THRESHOLD = 0.45;
const MIN_VALID_FRAMES = 8;

const STEP_CRITICAL_JOINTS: Record<CameraStepId, number[]> = {
  squat: [
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.RIGHT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
    POSE_LANDMARKS.RIGHT_ANKLE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
  ],
  'wall-angel': [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.LEFT_WRIST,
    POSE_LANDMARKS.RIGHT_WRIST,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
  ],
  'single-leg-balance': [
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.RIGHT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
    POSE_LANDMARKS.RIGHT_ANKLE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
  ],
};

const LEFT_SIDE_JOINTS = [
  POSE_LANDMARKS.LEFT_SHOULDER,
  POSE_LANDMARKS.LEFT_ELBOW,
  POSE_LANDMARKS.LEFT_WRIST,
  POSE_LANDMARKS.LEFT_HIP,
  POSE_LANDMARKS.LEFT_KNEE,
  POSE_LANDMARKS.LEFT_ANKLE,
];

const RIGHT_SIDE_JOINTS = [
  POSE_LANDMARKS.RIGHT_SHOULDER,
  POSE_LANDMARKS.RIGHT_ELBOW,
  POSE_LANDMARKS.RIGHT_WRIST,
  POSE_LANDMARKS.RIGHT_HIP,
  POSE_LANDMARKS.RIGHT_KNEE,
  POSE_LANDMARKS.RIGHT_ANKLE,
];

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getVisibleRatio(landmark: PoseLandmark | undefined): number {
  if (!landmark) return 0;
  if (typeof landmark.visibility === 'number') {
    return landmark.visibility >= VISIBILITY_THRESHOLD ? 1 : 0;
  }
  return 1;
}

function hasJoint(landmark: PoseLandmark | undefined): boolean {
  return getVisibleRatio(landmark) > 0;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collectConfidenceSamples(frames: PoseLandmarks[]): number[] {
  return frames.flatMap((frame) =>
    frame.landmarks
      .map((landmark) => landmark.visibility)
      .filter((value): value is number => typeof value === 'number')
  );
}

function getBboxArea(frame: PoseLandmarks): number {
  const xs = frame.landmarks.map((landmark) => landmark.x);
  const ys = frame.landmarks.map((landmark) => landmark.y);
  if (xs.length === 0 || ys.length === 0) return 0;
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return width * height;
}

function getJointRatio(frames: PoseLandmarks[], jointIndexes: number[]): number {
  if (frames.length === 0) return 0;
  const frameScores = frames.map((frame) =>
    mean(jointIndexes.map((jointIndex) => getVisibleRatio(frame.landmarks[jointIndex])))
  );
  return mean(frameScores);
}

function getCriticalAvailability(frames: PoseLandmarks[], stepId: CameraStepId): number {
  return getJointRatio(frames, STEP_CRITICAL_JOINTS[stepId]);
}

function getFrameVisibleRatio(frame: PoseLandmarks): number {
  return mean(frame.landmarks.map((landmark) => getVisibleRatio(landmark)));
}

function getVisibleJointsRatio(frames: PoseLandmarks[]): number {
  if (frames.length === 0) return 0;
  return mean(frames.map(getFrameVisibleRatio));
}

function getBboxStability(frames: PoseLandmarks[]): number {
  const areas = frames.map(getBboxArea).filter((area) => area > 0);
  if (areas.length < 2) return 0;
  const avg = mean(areas);
  if (avg <= 0) return 0;
  const variance = mean(areas.map((area) => (area - avg) ** 2));
  const stdDev = Math.sqrt(variance);
  return clamp(1 - stdDev / avg);
}

function countNoisyFrames(frames: PoseLandmarks[]): number {
  return frames.filter((frame) => {
    const visibleRatio = getFrameVisibleRatio(frame);
    const bboxArea = getBboxArea(frame);
    return visibleRatio < 0.45 || bboxArea < 0.05 || bboxArea > 0.95;
  }).length;
}

function angle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  return Math.abs((rad * 180) / Math.PI);
}

function getSquatAngles(frames: PoseLandmarks[]): number[] {
  return frames.flatMap((frame) => {
    const lHip = frame.landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = frame.landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = frame.landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = frame.landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = frame.landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = frame.landmarks[POSE_LANDMARKS.RIGHT_ANKLE];
    if (!lHip || !rHip || !lKnee || !rKnee || !lAnkle || !rAnkle) return [];
    return [(angle(lHip, lKnee, lAnkle) + angle(rHip, rKnee, rAnkle)) / 2];
  });
}

function getWallAngelRanges(frames: PoseLandmarks[]): { left: number[]; right: number[] } {
  const left = frames.flatMap((frame) => {
    const shoulder = frame.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const elbow = frame.landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const wrist = frame.landmarks[POSE_LANDMARKS.LEFT_WRIST];
    if (!shoulder || !elbow || !wrist) return [];
    return [angle(shoulder, elbow, wrist)];
  });
  const right = frames.flatMap((frame) => {
    const shoulder = frame.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const elbow = frame.landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const wrist = frame.landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    if (!shoulder || !elbow || !wrist) return [];
    return [angle(shoulder, elbow, wrist)];
  });
  return { left, right };
}

function getSingleLegHalfCounts(frames: PoseLandmarks[]): { firstHalf: number; secondHalf: number } {
  const pivot = Math.floor(frames.length / 2);
  return {
    firstHalf: frames.slice(0, pivot).length,
    secondHalf: frames.slice(pivot).length,
  };
}

function getMotionCompleteness(
  stepId: CameraStepId,
  frames: PoseLandmarks[],
  stats: PoseCaptureStats,
  flags: Set<CameraGuardrailFlag>
): { score: number; status: CompletionStatus } {
  if (frames.length < MIN_VALID_FRAMES) {
    flags.add('insufficient_signal');
    flags.add('valid_frames_too_few');
    return { score: 0, status: 'insufficient' };
  }

  if (stepId === 'squat') {
    const angles = getSquatAngles(frames);
    if (angles.length < MIN_VALID_FRAMES) {
      flags.add('rep_incomplete');
      return { score: 0.2, status: 'partial' };
    }
    const range = Math.max(...angles) - Math.min(...angles);
    const startWindow = angles.slice(0, Math.max(2, Math.floor(angles.length / 4)));
    const endWindow = angles.slice(-Math.max(2, Math.floor(angles.length / 4)));
    const recovered =
      mean(startWindow) - Math.min(...angles) > 15 &&
      mean(endWindow) - Math.min(...angles) > 15;
    if (range < 20 || !recovered) {
      flags.add('rep_incomplete');
      return { score: clamp(range / 35), status: 'partial' };
    }
    return { score: clamp(range / 50), status: 'complete' };
  }

  if (stepId === 'wall-angel') {
    const { left, right } = getWallAngelRanges(frames);
    const leftRange = left.length > 1 ? Math.max(...left) - Math.min(...left) : 0;
    const rightRange = right.length > 1 ? Math.max(...right) - Math.min(...right) : 0;
    const avgRange = mean([leftRange, rightRange]);
    if (frames.length < 12 || avgRange < 18) {
      flags.add('rep_incomplete');
      return { score: clamp(avgRange / 35), status: 'partial' };
    }
    return { score: clamp(avgRange / 45), status: 'complete' };
  }

  const { firstHalf, secondHalf } = getSingleLegHalfCounts(frames);
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

  const halfScore = clamp(Math.min(firstHalf, secondHalf) / 45);
  if (flags.has('left_side_missing') || flags.has('right_side_missing')) {
    return { score: clamp(halfScore * 0.7), status: 'partial' };
  }
  if (flags.has('hold_too_short')) {
    return { score: clamp(frames.length / 70), status: 'partial' };
  }
  return { score: clamp(Math.min(frames.length / 90, stats.captureDurationMs / 9000)), status: 'complete' };
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
  const validFrames = frames.filter((frame) => frame.landmarks.length >= 33);
  const flags = new Set<CameraGuardrailFlag>();

  const visibleJointsRatio = getVisibleJointsRatio(validFrames);
  const confidenceSamples = collectConfidenceSamples(validFrames);
  const averageLandmarkConfidence =
    confidenceSamples.length > 0 ? mean(confidenceSamples) : null;
  const criticalJointsAvailability = getCriticalAvailability(validFrames, stepId);
  const bboxSizeStability = getBboxStability(validFrames);
  const validFrameCount = validFrames.length;
  const droppedFrameRatio =
    stats.sampledFrameCount > 0 ? stats.droppedFrameCount / stats.sampledFrameCount : 1;
  const noisyFrameRatio =
    validFrameCount > 0 ? countNoisyFrames(validFrames) / validFrameCount : 1;
  const leftSideCompleteness = getJointRatio(validFrames, LEFT_SIDE_JOINTS);
  const rightSideCompleteness = getJointRatio(validFrames, RIGHT_SIDE_JOINTS);

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
  if (droppedFrameRatio > 0.45 || noisyFrameRatio > 0.35 || bboxSizeStability < 0.45) {
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
    },
  };
}
