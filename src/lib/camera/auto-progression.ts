import type { EvaluatorMetric, EvaluatorResult } from './evaluators/types';
import type { StepGuardrailResult } from './guardrails';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseCaptureStats } from './use-pose-capture';
import type { CameraStepId } from '@/lib/public/camera-test';
import { runEvaluator } from './run-evaluators';
import { assessStepGuardrail } from './guardrails';

export type ExerciseProgressionState =
  | 'idle'
  | 'camera_ready'
  | 'detecting'
  | 'insufficient_signal'
  | 'capturing_valid_motion'
  | 'passed'
  | 'retry_required'
  | 'failed';

export type ExerciseGateStatus = 'pass' | 'retry' | 'fail' | 'detecting';
export type CameraGuideTone = 'neutral' | 'warning' | 'success';

export interface ExerciseGateResult {
  status: ExerciseGateStatus;
  progressionState: ExerciseProgressionState;
  confidence: number;
  completionSatisfied: boolean;
  nextAllowed: boolean;
  flags: string[];
  reasons: string[];
  failureReasons: string[];
  userGuidance: string[];
  retryRecommended: boolean;
  evaluatorResult: EvaluatorResult;
  guardrail: StepGuardrailResult;
  uiMessage: string;
  autoAdvanceDelayMs: number;
}

export function getCameraGuideTone(
  gate: Pick<ExerciseGateResult, 'status' | 'progressionState'>
): CameraGuideTone {
  if (gate.status === 'pass' || gate.progressionState === 'passed') {
    return 'success';
  }

  if (
    gate.status === 'retry' ||
    gate.status === 'fail' ||
    gate.progressionState === 'retry_required' ||
    gate.progressionState === 'insufficient_signal' ||
    gate.progressionState === 'failed'
  ) {
    return 'warning';
  }

  return 'neutral';
}

const AUTO_ADVANCE_DELAY_MS: Record<CameraStepId, number> = {
  squat: 700,
  'wall-angel': 700,
  'single-leg-balance': 900,
};

const BASIC_PASS_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.62,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

const STRONG_QUALITY_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.78,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function getMetricValue(metrics: EvaluatorMetric[] | undefined, name: string): number | null {
  const metric = metrics?.find((item) => item.name === name);
  return typeof metric?.value === 'number' ? metric.value : null;
}

function getHighlightedMetric(result: EvaluatorResult, key: string): number {
  const value = result.debug?.highlightedMetrics?.[key];
  return typeof value === 'number' ? value : 0;
}

function hasAnyReason(reasons: string[], includes: string[]): boolean {
  return includes.some((value) => reasons.includes(value));
}

function getStableSignalBonus(stepId: CameraStepId, result: EvaluatorResult): number {
  if (stepId === 'squat') {
    const descentCount = getHighlightedMetric(result, 'descentCount');
    const bottomCount = getHighlightedMetric(result, 'bottomCount');
    const ascentCount = getHighlightedMetric(result, 'ascentCount');
    return descentCount > 1 && bottomCount > 0 && ascentCount > 1 ? 0.04 : 0;
  }

  if (stepId === 'wall-angel') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const lowerCount = getHighlightedMetric(result, 'lowerCount');
    return raiseCount > 1 && peakCount > 0 && lowerCount > 1 ? 0.04 : 0;
  }

  const holdOngoingCount = getHighlightedMetric(result, 'holdOngoingCount');
  const breakCount = getHighlightedMetric(result, 'breakCount');
  return holdOngoingCount >= 8 && breakCount === 0 ? 0.05 : 0;
}

function getNoisePenalty(guardrail: StepGuardrailResult): number {
  let penalty = 0;
  if (guardrail.flags.includes('unstable_motion_signal')) penalty += 0.07;
  if (guardrail.flags.includes('partial_capture')) penalty += 0.06;
  if (guardrail.flags.includes('landmark_confidence_low')) penalty += 0.04;
  if ((guardrail.debug.timestampDiscontinuityCount ?? 0) > 0) penalty += 0.04;
  return penalty;
}

function getEffectiveConfidence(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
): number {
  return clamp(guardrail.confidence + getStableSignalBonus(stepId, result) - getNoisePenalty(guardrail));
}

function isSevereInvalid(guardrail: StepGuardrailResult): boolean {
  return (
    guardrail.captureQuality === 'invalid' &&
    (guardrail.flags.includes('insufficient_signal') ||
      guardrail.flags.includes('valid_frames_too_few') ||
      guardrail.flags.includes('framing_invalid'))
  );
}

function getCommonReasons(result: EvaluatorResult, guardrail: StepGuardrailResult): string[] {
  return [
    ...(guardrail.flags ?? []),
    ...(result.qualityHints ?? []),
    ...(result.completionHints ?? []),
    ...(result.interpretedSignals ?? []),
  ];
}

function evaluateSquatCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const depth = getMetricValue(result.metrics, 'depth') ?? 0;
  const trunkLean = getMetricValue(result.metrics, 'trunk_lean') ?? 999;
  const kneeTracking = getMetricValue(result.metrics, 'knee_alignment_trend') ?? 0;
  const bottomStability = getMetricValue(result.rawMetrics, 'bottom_stability_proxy') ?? 0;
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');

  return (
    guardrail.completionStatus === 'complete' &&
    depth >= 45 &&
    trunkLean < 24 &&
    kneeTracking >= 0.82 &&
    kneeTracking <= 1.18 &&
    bottomStability >= 40 &&
    descentCount > 0 &&
    bottomCount > 0 &&
    ascentCount > 0
  );
}

function evaluateWallAngelCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const armRange = getMetricValue(result.metrics, 'arm_range') ?? 0;
  const compensation = getMetricValue(result.metrics, 'lumbar_extension') ?? 999;
  const asymmetry = getMetricValue(result.metrics, 'asymmetry') ?? 999;
  const raiseCount = getHighlightedMetric(result, 'raiseCount');
  const peakCount = getHighlightedMetric(result, 'peakCount');
  const lowerCount = getHighlightedMetric(result, 'lowerCount');

  return (
    guardrail.completionStatus === 'complete' &&
    armRange >= 120 &&
    compensation < 24 &&
    asymmetry < 30 &&
    raiseCount > 0 &&
    peakCount > 0 &&
    lowerCount > 0
  );
}

function evaluateBalanceCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const holdStability = getMetricValue(result.metrics, 'hold_stability') ?? 0;
  const sway = getMetricValue(result.metrics, 'sway') ?? 999;
  const pelvicDrop = getMetricValue(result.metrics, 'pelvic_drop') ?? 999;
  const holdDuration = getMetricValue(result.rawMetrics, 'hold_duration') ?? 0;
  const breakCount = getHighlightedMetric(result, 'breakCount');
  const holdOngoingCount = getHighlightedMetric(result, 'holdOngoingCount');

  return (
    guardrail.completionStatus === 'complete' &&
    holdDuration >= 6500 &&
    holdStability >= 65 &&
    sway < 0.06 &&
    pelvicDrop < 0.055 &&
    breakCount === 0 &&
    holdOngoingCount >= 6
  );
}

function getCompletionSatisfied(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
): boolean {
  if (stepId === 'squat') return evaluateSquatCompletion(result, guardrail);
  if (stepId === 'wall-angel') return evaluateWallAngelCompletion(result, guardrail);
  return evaluateBalanceCompletion(result, guardrail);
}

function getDetectingMessage(
  stepId: CameraStepId,
  stats: PoseCaptureStats,
  guardrail: StepGuardrailResult
): { progressionState: ExerciseProgressionState; uiMessage: string } {
  if (stats.sampledFrameCount === 0) {
    return { progressionState: 'camera_ready', uiMessage: '동작을 시작해 주세요' };
  }

  if (
    guardrail.flags.includes('insufficient_signal') ||
    guardrail.flags.includes('valid_frames_too_few')
  ) {
    return { progressionState: 'insufficient_signal', uiMessage: '조금만 더 유지해 주세요' };
  }

  return { progressionState: 'detecting', uiMessage: '신호를 확인하고 있어요' };
}

function getRetryMessage(guardrail: StepGuardrailResult): string {
  if (
    guardrail.flags.includes('rep_incomplete') ||
    guardrail.flags.includes('hold_too_short')
  ) {
    return '한 번 더 천천히 해주세요';
  }

  if (
    guardrail.flags.includes('framing_invalid') ||
    guardrail.flags.includes('partial_capture') ||
    guardrail.flags.includes('left_side_missing') ||
    guardrail.flags.includes('right_side_missing')
  ) {
    return '머리부터 발끝까지 보이게 해주세요';
  }

  return '조금 더 안정적으로 해주세요';
}

function toUniqueGuidance(messages: string[]): string[] {
  return [...new Set(messages)].slice(0, 2);
}

function getUserGuidance(
  stepId: CameraStepId,
  failureReasons: string[],
  guardrail: StepGuardrailResult
): string[] {
  const messages: string[] = [];

  if (failureReasons.includes('framing_invalid')) {
    messages.push('머리부터 발끝까지 보이게 해주세요');
  }

  if (
    failureReasons.includes('partial_capture') ||
    failureReasons.includes('left_side_missing') ||
    failureReasons.includes('right_side_missing')
  ) {
    messages.push('조금 더 가까이 와주세요');
  }

  if (
    failureReasons.includes('capture_quality_invalid') ||
    failureReasons.includes('capture_quality_low')
  ) {
    messages.push('몸이 화면 안에서 더 크게 보이게 해주세요');
  }

  if (guardrail.flags.includes('landmark_confidence_low')) {
    messages.push('조명을 조금 더 밝게 해주세요');
  }

  if (guardrail.flags.includes('unstable_motion_signal')) {
    messages.push('카메라를 고정하고 천천히 움직여주세요');
  }

  if (
    failureReasons.includes('insufficient_signal') ||
    guardrail.flags.includes('valid_frames_too_few')
  ) {
    messages.push('한 번 더 천천히 해주세요');
  }

  if (stepId === 'squat') {
    if (failureReasons.includes('depth_not_reached')) {
      messages.push('조금 더 깊게 앉아주세요');
    }
    if (failureReasons.includes('ascent_not_detected')) {
      messages.push('조금 더 앉았다가 다시 올라와주세요');
    }
    if (failureReasons.includes('rep_incomplete')) {
      messages.push('조금 더 앉았다가 다시 올라와주세요');
    }
  }

  if (stepId === 'wall-angel' && failureReasons.includes('rep_incomplete')) {
    messages.push('팔을 끝까지 올렸다가 천천히 내려주세요');
  }

  if (stepId === 'single-leg-balance') {
    if (guardrail.flags.includes('hold_too_short')) {
      messages.push('한 발 자세를 조금만 더 유지해 주세요');
    }
    if (failureReasons.includes('side_missing')) {
      messages.push('좌우 자세가 모두 보이게 다시 맞춰주세요');
    }
  }

  if (failureReasons.includes('confidence_too_low')) {
    messages.push('자세를 잠깐 고정한 뒤 다시 해주세요');
  }

  return toUniqueGuidance(messages);
}

interface SquatQualitySignals {
  depthTooShallow: boolean;
  trunkLeanHigh: boolean;
  kneeTrackingOff: boolean;
  bottomStabilityLow: boolean;
  strongQuality: boolean;
}

function getSquatQualitySignals(
  result: EvaluatorResult,
  confidence: number
): SquatQualitySignals {
  const depth = getMetricValue(result.metrics, 'depth') ?? 0;
  const trunkLean = getMetricValue(result.metrics, 'trunk_lean') ?? 999;
  const kneeTracking = getMetricValue(result.metrics, 'knee_alignment_trend') ?? 0;
  const bottomStability = getMetricValue(result.rawMetrics, 'bottom_stability_proxy') ?? 0;
  const depthTooShallow = depth < 45;
  const trunkLeanHigh = trunkLean >= 24;
  const kneeTrackingOff = kneeTracking < 0.82 || kneeTracking > 1.18;
  const bottomStabilityLow = bottomStability < 40;

  return {
    depthTooShallow,
    trunkLeanHigh,
    kneeTrackingOff,
    bottomStabilityLow,
    strongQuality:
      confidence >= STRONG_QUALITY_CONFIDENCE_THRESHOLD.squat &&
      !depthTooShallow &&
      !trunkLeanHigh &&
      !kneeTrackingOff &&
      !bottomStabilityLow,
  };
}

function getHardBlockerReasons(
  stepId: CameraStepId,
  guardrail: StepGuardrailResult
): string[] {
  const commonBlockers = [
    'insufficient_signal',
    'valid_frames_too_few',
    'framing_invalid',
  ];

  if (stepId === 'squat') {
    return [
      ...commonBlockers,
      ...(guardrail.flags.includes('left_side_missing') ? ['left_side_missing'] : []),
      ...(guardrail.flags.includes('right_side_missing') ? ['right_side_missing'] : []),
    ];
  }

  return [...commonBlockers, 'left_side_missing', 'right_side_missing', 'partial_capture'];
}

function getSquatProgressionCompletionSatisfied(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
): boolean {
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');

  return (
    guardrail.completionStatus === 'complete' &&
    descentCount > 0 &&
    bottomCount > 0 &&
    ascentCount > 0
  );
}

function getSquatFailureReasons(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  confidence: number
): string[] {
  const failureReasons = new Set<string>();
  const depth = getMetricValue(result.metrics, 'depth') ?? 0;
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const qualitySignals = getSquatQualitySignals(result, confidence);

  if (guardrail.flags.includes('insufficient_signal')) {
    failureReasons.add('insufficient_signal');
  }
  if (guardrail.flags.includes('valid_frames_too_few')) {
    failureReasons.add('valid_frames_too_few');
  }
  if (guardrail.flags.includes('framing_invalid')) {
    failureReasons.add('framing_invalid');
  }
  if (guardrail.flags.includes('rep_incomplete') || result.completionHints?.includes('rep_phase_incomplete')) {
    failureReasons.add('rep_incomplete');
  }
  if (guardrail.captureQuality !== 'ok') {
    failureReasons.add(
      guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid'
    );
  }
  if (confidence < BASIC_PASS_CONFIDENCE_THRESHOLD.squat) {
    failureReasons.add('confidence_too_low');
  }
  if (qualitySignals.depthTooShallow) {
    failureReasons.add('depth_not_reached');
  }
  if (ascentCount === 0 || (descentCount > 0 && bottomCount > 0 && ascentCount === 0)) {
    failureReasons.add('ascent_not_detected');
  }
  if (guardrail.flags.includes('left_side_missing')) {
    failureReasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    failureReasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('partial_capture')) {
    failureReasons.add('partial_capture');
  }

  return Array.from(failureReasons);
}

function getFailureReasons(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  confidence: number,
  completionSatisfied: boolean,
  nextAllowed: boolean
): string[] {
  if (stepId === 'squat') {
    return getSquatFailureReasons(result, guardrail, confidence);
  }

  const reasons = new Set<string>();
  if (guardrail.flags.includes('insufficient_signal')) {
    reasons.add('insufficient_signal');
  }
  if (guardrail.flags.includes('valid_frames_too_few')) {
    reasons.add('valid_frames_too_few');
  }
  if (guardrail.flags.includes('framing_invalid')) {
    reasons.add('framing_invalid');
  }
  if (guardrail.captureQuality !== 'ok') {
    reasons.add(guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid');
  }
  if (confidence < BASIC_PASS_CONFIDENCE_THRESHOLD[stepId]) {
    reasons.add('confidence_too_low');
  }
  if (guardrail.flags.includes('left_side_missing')) {
    reasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    reasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('partial_capture')) {
    reasons.add('partial_capture');
  }
  return Array.from(reasons);
}

export function evaluateExerciseAutoProgress(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[],
  stats: PoseCaptureStats
): ExerciseGateResult {
  const evaluatorResult = runEvaluator(stepId, landmarks);
  const guardrail = assessStepGuardrail(stepId, landmarks, stats, evaluatorResult);
  const confidence = getEffectiveConfidence(stepId, evaluatorResult, guardrail);
  const reasons = getCommonReasons(evaluatorResult, guardrail);
  const passThreshold = BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  const completionSatisfied =
    stepId === 'squat'
      ? getSquatProgressionCompletionSatisfied(evaluatorResult, guardrail)
      : getCompletionSatisfied(stepId, evaluatorResult, guardrail);
  const squatQualitySignals =
    stepId === 'squat' ? getSquatQualitySignals(evaluatorResult, confidence) : null;
  const severeFail = isSevereInvalid(guardrail) && stats.captureDurationMs >= 4500;
  const autoAdvanceDelayMs = AUTO_ADVANCE_DELAY_MS[stepId];
  const lowConfidenceRetry =
    guardrail.retryRecommended && confidence < passThreshold;
  const hardBlockerReasons = getHardBlockerReasons(stepId, guardrail);
  const noNextAllowed = false;
  const failureReasons = getFailureReasons(
    stepId,
    evaluatorResult,
    guardrail,
    confidence,
    completionSatisfied,
    noNextAllowed
  );
  const userGuidance = getUserGuidance(stepId, failureReasons, guardrail);

  if (
    stats.sampledFrameCount === 0 ||
    (!completionSatisfied && stats.captureDurationMs < 2200 && guardrail.captureQuality !== 'invalid')
  ) {
    const detecting = getDetectingMessage(stepId, stats, guardrail);
    return {
      status: 'detecting',
      progressionState: detecting.progressionState,
      confidence,
      completionSatisfied: false,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: guardrail.retryRecommended,
      evaluatorResult,
      guardrail,
      uiMessage: detecting.uiMessage,
      autoAdvanceDelayMs,
    };
  }

  const progressionPassed =
    completionSatisfied &&
    guardrail.captureQuality !== 'invalid' &&
    confidence >= passThreshold &&
    !hasAnyReason(reasons, hardBlockerReasons) &&
    !hasAnyReason(reasons, ['rep_incomplete', 'hold_too_short']);

  if (progressionPassed) {
    return {
      status: 'pass',
      progressionState: 'passed',
      confidence,
      completionSatisfied: true,
      nextAllowed: true,
      flags: guardrail.flags,
      reasons,
      failureReasons: [],
      userGuidance: [],
      retryRecommended: false,
      evaluatorResult,
      guardrail,
      uiMessage:
        stepId === 'squat' && squatQualitySignals && !squatQualitySignals.strongQuality
          ? '좋습니다, 동작을 확인했어요'
          : '충분한 신호를 확인했어요',
      autoAdvanceDelayMs,
    };
  }

  if (severeFail) {
    return {
      status: 'fail',
      progressionState: 'failed',
      confidence,
      completionSatisfied,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: true,
      evaluatorResult,
      guardrail,
      uiMessage: '설문형으로 전환할 수 있어요',
      autoAdvanceDelayMs,
    };
  }

  if (
    guardrail.captureQuality === 'invalid' ||
    lowConfidenceRetry ||
    hasAnyReason(reasons, [
      'rep_incomplete',
      'hold_too_short',
      'left_side_missing',
      'right_side_missing',
      'partial_capture',
    ])
  ) {
    const progressionState =
      guardrail.captureQuality === 'invalid' &&
      (guardrail.flags.includes('insufficient_signal') || guardrail.flags.includes('valid_frames_too_few'))
        ? 'insufficient_signal'
        : 'retry_required';

    return {
      status: 'retry',
      progressionState,
      confidence,
      completionSatisfied,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: true,
      evaluatorResult,
      guardrail,
      uiMessage:
        progressionState === 'insufficient_signal'
          ? '조금만 더 유지해 주세요'
          : getRetryMessage(guardrail),
      autoAdvanceDelayMs,
    };
  }

  return {
    status: 'detecting',
    progressionState: 'capturing_valid_motion',
    confidence,
    completionSatisfied,
    nextAllowed: false,
    flags: guardrail.flags,
    reasons,
    failureReasons,
    userGuidance,
    retryRecommended: guardrail.retryRecommended,
    evaluatorResult,
    guardrail,
    uiMessage: '좋습니다, 계속하세요',
    autoAdvanceDelayMs,
  };
}
