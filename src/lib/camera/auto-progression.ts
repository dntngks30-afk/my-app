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

const AUTO_ADVANCE_DELAY_MS: Record<CameraStepId, number> = {
  squat: 700,
  'wall-angel': 700,
  'single-leg-balance': 900,
};

const PASS_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
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
    return '다시 한 번 해볼게요';
  }

  if (guardrail.flags.includes('partial_capture')) {
    return '프레임을 다시 맞춰 주세요';
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

  if (
    failureReasons.includes('capture_quality_invalid') ||
    failureReasons.includes('capture_quality_low') ||
    guardrail.flags.includes('framing_invalid') ||
    guardrail.flags.includes('partial_capture')
  ) {
    messages.push('화면에 몸이 다 나오게 서주세요');
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
    messages.push('동작을 조금 더 천천히 끝까지 해주세요');
  }

  if (stepId === 'squat') {
    if (failureReasons.includes('depth_not_reached')) {
      messages.push('조금 더 깊게 앉아주세요');
    }
    if (failureReasons.includes('ascent_not_detected')) {
      messages.push('앉았다가 끝까지 다시 올라와 주세요');
    }
    if (failureReasons.includes('rep_incomplete')) {
      messages.push('한 번 더 끝까지 앉았다 일어나 주세요');
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
    messages.push('같은 동작을 한 번 더 안정적으로 해주세요');
  }

  return toUniqueGuidance(messages);
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

  if (guardrail.flags.includes('insufficient_signal') || guardrail.flags.includes('valid_frames_too_few')) {
    failureReasons.add('insufficient_signal');
  }
  if (guardrail.flags.includes('rep_incomplete') || result.completionHints?.includes('rep_phase_incomplete')) {
    failureReasons.add('rep_incomplete');
  }
  if (guardrail.captureQuality !== 'ok') {
    failureReasons.add(
      guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid'
    );
  }
  if (confidence < PASS_CONFIDENCE_THRESHOLD.squat) {
    failureReasons.add('confidence_too_low');
  }
  if (depth < 45) {
    failureReasons.add('depth_not_reached');
  }
  if (ascentCount === 0 || (descentCount > 0 && bottomCount > 0 && ascentCount === 0)) {
    failureReasons.add('ascent_not_detected');
  }
  if (
    guardrail.flags.includes('left_side_missing') ||
    guardrail.flags.includes('right_side_missing') ||
    guardrail.flags.includes('partial_capture')
  ) {
    failureReasons.add('side_missing');
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
  if (guardrail.flags.includes('insufficient_signal') || guardrail.flags.includes('valid_frames_too_few')) {
    reasons.add('insufficient_signal');
  }
  if (guardrail.captureQuality !== 'ok') {
    reasons.add(guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid');
  }
  if (confidence < PASS_CONFIDENCE_THRESHOLD[stepId]) {
    reasons.add('confidence_too_low');
  }
  if (guardrail.flags.includes('left_side_missing') || guardrail.flags.includes('right_side_missing')) {
    reasons.add('side_missing');
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
  const completionSatisfied = getCompletionSatisfied(stepId, evaluatorResult, guardrail);
  const reasons = getCommonReasons(evaluatorResult, guardrail);
  const passThreshold = PASS_CONFIDENCE_THRESHOLD[stepId];
  const severeFail = isSevereInvalid(guardrail) && stats.captureDurationMs >= 4500;
  const autoAdvanceDelayMs = AUTO_ADVANCE_DELAY_MS[stepId];
  const lowConfidenceRetry =
    guardrail.retryRecommended && confidence < passThreshold;
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

  if (
    completionSatisfied &&
    guardrail.captureQuality === 'ok' &&
    confidence >= passThreshold &&
    !hasAnyReason(reasons, [
      'rep_incomplete',
      'hold_too_short',
      'left_side_missing',
      'right_side_missing',
      'partial_capture',
      'framing_invalid',
    ])
  ) {
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
      uiMessage: '충분한 신호를 확인했어요',
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
