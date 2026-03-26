import type { EvaluatorMetric, EvaluatorResult } from './evaluators/types';
import type { StepGuardrailResult } from './guardrails';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseCaptureStats } from './use-pose-capture';
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildPoseFeaturesFrames } from './pose-features';
import { runEvaluator } from './run-evaluators';
import { assessStepGuardrail } from './guardrails';
import type { SquatInternalQuality } from './squat/squat-internal-quality';
import {
  OVERHEAD_MIN_PEAK_FRAMES,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_EASY_PASS_CONFIDENCE,
  OVERHEAD_EASY_LATCH_STABLE_FRAMES,
  OVERHEAD_EASY_MIN_PEAK_FRAMES,
} from '@/lib/camera/overhead/overhead-constants';
import {
  type SquatEvidenceLevel,
  evidenceLabelToSquatEvidenceLevel,
  squatEvidenceLevelToReasons,
  squatEvidenceLevelToConfidenceDowngradeReason,
  applySquatQualityCap,
} from './squat-evidence';
import { completionBlockedReasonToFailureTags } from './squat-retry-reason';

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

/** PR G3: squat full-cycle observability (dev/debug only) */
/** PR-A4: squat completion trace + unified standing-recovered final state */
/** PR evidence: completion과 evidence strength 분리 — result layer가 입력 품질 읽기 */
/** PR-CAM-09: SquatEvidenceLevel 은 squat-evidence.ts 에 정의. 타입 re-export */
export type { SquatEvidenceLevel };

export interface SquatCycleDebug {
  armingSatisfied: boolean;
  currentSquatPhase?:
    | 'idle'
    | 'armed'
    | 'descending'
    | 'committed_bottom_or_downward_commitment'
    | 'ascending'
    | 'standing_recovered';
  attemptStarted?: boolean;
  startPoseSatisfied: boolean;
  startBeforeBottom: boolean;
  descendDetected: boolean;
  bottomDetected: boolean;
  bottomTurningPointDetected: boolean;
  ascendDetected: boolean;
  recoveryDetected: boolean;
  cycleComplete: boolean;
  completionStatus: string;
  depthBand: 'shallow' | 'moderate' | 'deep';
  passBlockedReason: string | null;
  qualityInterpretationReason: string | null;
  passTriggeredAtPhase?: string;
  completionPathUsed?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  completionRejectedReason?: string | null;
  completionBlockedReason?: string | null;
  evidenceLabel?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  ultraLowRomCandidate?: boolean;
  ultraLowRomGuardPassed?: boolean;
  ultraLowRomRejectReason?: string | null;
  /** PR-A6: standing false positive trace */
  standingStillRejected?: boolean;
  falsePositiveBlockReason?: string | null;
  descendConfirmed?: boolean;
  ascendConfirmed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  minimumCycleDurationSatisfied?: boolean;
  standardPathBlockedReason?: string | null;
  ultraLowRomPathDisabledOrGuarded?: boolean;
  descendStartAtMs?: number;
  downwardCommitmentAtMs?: number;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendStartAtMs?: number;
  recoveryAtMs?: number;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs?: number;
  successPhaseAtOpen?: 'standing_recovered';
  cycleDurationMs?: number;
  downwardCommitmentDelta?: number;
  /** PR evidence: completion과 분리된 evidence layer */
  squatEvidenceLevel?: SquatEvidenceLevel;
  squatEvidenceReasons?: string[];
  cycleProofPassed?: boolean;
  romBand?: 'shallow' | 'moderate' | 'deep';
  confidenceDowngradeReason?: string | null;
  insufficientSignalReason?: string | null;
  /** PR squat-low-rom: trace — why low/ultra-low path blocked */
  lowRomRejectionReason?: string | null;
  ultraLowRomRejectionReason?: string | null;
  recoveryReturnContinuityFrames?: number;
  recoveryTrailingDepthCount?: number;
  recoveryDropRatio?: number;
  /** PR shallow: guardrail partial 시 이유 (guardrail_not_complete일 때) */
  guardrailPartialReason?: string;
  /** PR shallow: guardrail complete 시 경로 */
  guardrailCompletePath?: string;
  /** PR-COMP-01: 명시적 completion 상태기계 단계(트레이스) */
  completionMachinePhase?: string;
  /** PR-COMP-01: 통과 ROM 사이클 분류 */
  completionPassReason?: string;
  /** PR-COMP-03: completion·pass와 무관한 strict 내부 해석(트레이스 전용) */
  squatInternalQuality?: SquatInternalQuality;
  /** PR-CAM-10: ambiguous retry / severe-fail 완화 계약 관측 */
  squatRetryContractObservation?: {
    severeFailSoftenedToRetry?: boolean;
    fallbackUsed?: 'weak_cycle_retry_instead_of_survey_fail';
  };
}

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
  passConfirmationSatisfied: boolean;
  passConfirmationFrameCount: number;
  passConfirmationWindowCount: number;
  /** PR G3: squat cycle state (set only when stepId === 'squat') */
  squatCycleDebug?: SquatCycleDebug;
}

const REQUIRED_STABLE_FRAMES = 3;

export function isGatePassReady(
  gate: Pick<
    ExerciseGateResult,
    'status' | 'nextAllowed' | 'completionSatisfied' | 'passConfirmationSatisfied'
  >
): boolean {
  return (
    gate.status === 'pass' &&
    gate.nextAllowed &&
    gate.completionSatisfied &&
    gate.passConfirmationSatisfied
  );
}

/**
 * Strict success contract: success UI, tone, and auto-advance must depend ONLY on this.
 * Aligned with progressionPassed: captureQuality 'low' and unstable_frame_timing must NOT
 * block final latch when passConfirmed (completionSatisfied + passConfirmationSatisfied) is true.
 */
export function isFinalPassLatched(
  stepId: CameraStepId,
  gate: Pick<
    ExerciseGateResult,
    | 'completionSatisfied'
    | 'confidence'
    | 'passConfirmationSatisfied'
    | 'passConfirmationFrameCount'
    | 'guardrail'
    | 'evaluatorResult'
  >
): boolean {
  if (stepId === 'overhead-reach') {
    const hm = gate.evaluatorResult.debug?.highlightedMetrics;
    const strictMotion =
      hm?.strictMotionCompletionSatisfied === true || hm?.strictMotionCompletionSatisfied === 1;
    const easySat =
      hm?.easyCompletionSatisfied === true || hm?.easyCompletionSatisfied === 1;
    const easyOnly = Boolean(easySat && !strictMotion);
    const confTh = easyOnly
      ? OVERHEAD_EASY_PASS_CONFIDENCE
      : BASIC_PASS_CONFIDENCE_THRESHOLD['overhead-reach'];
    const framesReq = easyOnly ? OVERHEAD_EASY_LATCH_STABLE_FRAMES : REQUIRED_STABLE_FRAMES;
    return (
      gate.completionSatisfied === true &&
      gate.guardrail.captureQuality !== 'invalid' &&
      gate.confidence >= confTh &&
      gate.passConfirmationSatisfied === true &&
      gate.passConfirmationFrameCount >= framesReq
    );
  }

  const passThreshold = BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  return (
    gate.completionSatisfied === true &&
    gate.guardrail.captureQuality !== 'invalid' &&
    gate.confidence >= passThreshold &&
    gate.passConfirmationSatisfied === true &&
    gate.passConfirmationFrameCount >= REQUIRED_STABLE_FRAMES
  );
}

export function getCameraGuideTone(
  gate: Pick<
    ExerciseGateResult,
    'status' | 'progressionState' | 'nextAllowed' | 'completionSatisfied' | 'passConfirmationSatisfied'
  >
): CameraGuideTone {
  if (isGatePassReady(gate) || gate.progressionState === 'passed') {
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
  'overhead-reach': 700,
  'wall-angel': 700,
  'single-leg-balance': 900,
};

const BASIC_PASS_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.62,
  'overhead-reach': 0.72,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

const STRONG_QUALITY_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.78,
  'overhead-reach': 0.78,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
    // PR-CAM-09: squatCompletionState 에서 typed 로 읽기
    const cycleDone = result.debug?.squatCompletionState?.completionSatisfied === true;
    return cycleDone ? 0.04 : 0;
  }

  if (stepId === 'wall-angel') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const lowerCount = getHighlightedMetric(result, 'lowerCount');
    return raiseCount > 1 && peakCount > 0 && lowerCount > 1 ? 0.04 : 0;
  }

  if (stepId === 'overhead-reach') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const peakEasy = getHighlightedMetric(result, 'peakCountAtEasyFloor');
    const hm = result.debug?.highlightedMetrics;
    const progDone =
      hm?.completionSatisfied === true || hm?.completionSatisfied === 1;
    const peakOk =
      peakCount >= OVERHEAD_MIN_PEAK_FRAMES || peakEasy >= OVERHEAD_EASY_MIN_PEAK_FRAMES;
    return raiseCount > 0 && peakOk && progDone ? 0.04 : 0;
  }

  const holdOngoingCount = getHighlightedMetric(result, 'holdOngoingCount');
  const breakCount = getHighlightedMetric(result, 'breakCount');
  return holdOngoingCount >= 8 && breakCount === 0 ? 0.05 : 0;
}

const JITTER_PENALTY_CAP = 0.12;
const FRAMING_PENALTY_CAP = 0.08;
const LANDMARK_PENALTY_CAP = 0.06;

function getNoisePenalty(guardrail: StepGuardrailResult): number {
  let jitter = 0;
  if (guardrail.flags.includes('unstable_frame_timing')) jitter += 0.05;
  if (guardrail.flags.includes('unstable_landmarks')) jitter += 0.04;
  if ((guardrail.debug.timestampDiscontinuityCount ?? 0) > 0) jitter += 0.04;
  let framing = 0;
  if (guardrail.flags.includes('hard_partial')) framing += 0.06;
  if (guardrail.flags.includes('soft_partial')) framing += 0.03;
  const landmark = guardrail.flags.includes('landmark_confidence_low') ? 0.04 : 0;
  return (
    Math.min(jitter, JITTER_PENALTY_CAP) +
    Math.min(framing, FRAMING_PENALTY_CAP) +
    Math.min(landmark, LANDMARK_PENALTY_CAP)
  );
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

/**
 * PR G7 / PR-COMP-01: completion = `squat-completion-state` 단일 truth.
 * PR-CAM-09: squatCompletionState 에서 typed 로 읽는다.
 */
function evaluateSquatCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const cycleDone = result.debug?.squatCompletionState?.completionSatisfied === true;
  return guardrail.completionStatus === 'complete' && cycleDone;
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

/** PR G8/G9 + PR-COMP-04: overhead completion = `overhead-completion-state` → evaluator highlightedMetrics */
function evaluateOverheadReachCompletion(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
) {
  const hm = result.debug?.highlightedMetrics;
  const done = hm?.completionSatisfied === true || hm?.completionSatisfied === 1;
  return guardrail.completionStatus === 'complete' && done;
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

/** PR G4: overhead 최소 캡처 시간 — settle 후 유효 이벤트만 pass */
const OVERHEAD_ARMING_MS = 800;

function getCompletionSatisfied(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  stats?: PoseCaptureStats
): boolean {
  if (stepId === 'squat') return evaluateSquatCompletion(result, guardrail);
  if (stepId === 'overhead-reach') {
    if (stats && stats.captureDurationMs < OVERHEAD_ARMING_MS) return false;
    return evaluateOverheadReachCompletion(result, guardrail);
  }
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
    guardrail.flags.includes('hard_partial') ||
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
    failureReasons.includes('hard_partial') ||
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

  if (
    guardrail.flags.includes('unstable_frame_timing') ||
    guardrail.flags.includes('unstable_bbox') ||
    guardrail.flags.includes('unstable_landmarks')
  ) {
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

  if (stepId === 'overhead-reach') {
    if (failureReasons.includes('rep_incomplete')) {
      messages.push('양팔을 머리 위로 끝까지 올려주세요');
    }
    if (guardrail.flags.includes('hold_too_short')) {
      messages.push('맨 위에서 잠깐 멈춰주세요');
    }
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
  const depthPeak = getHighlightedMetric(result, 'depthPeak');
  const trunkLean = getMetricValue(result.metrics, 'trunk_lean') ?? 999;
  const kneeTracking = getMetricValue(result.metrics, 'knee_alignment_trend') ?? 0;
  const bottomStability = getMetricValue(result.rawMetrics, 'bottom_stability_proxy') ?? 0;
  const depthTooShallow = Math.max(depth, depthPeak) < 45;
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

  return [...commonBlockers, 'left_side_missing', 'right_side_missing', 'hard_partial'];
}

/** PR G3: arming window — countdown 직후 즉시 pass되지 않도록 최소 캡처 시간 */
const SQUAT_ARMING_MS = 1500;
/** PR G6: depth는 completion이 아니라 quality band. completion은 full cycle만 요구. */

function getSquatProgressionCompletionSatisfied(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  stats: PoseCaptureStats
): { satisfied: boolean; squatCycleDebug: SquatCycleDebug } {
  // ── 평가자 레이어 신호: phase counts + depth band (highlightedMetrics 유지) ──
  const startCount = getHighlightedMetric(result, 'startCount');
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const cycleComplete = getHighlightedMetric(result, 'cycleComplete') > 0;
  const depthBand = getHighlightedMetric(result, 'depthBand'); /* 0=shallow, 1=moderate, 2=deep */

  // ── completion truth: squatCompletionState (typed) 우선, highlightedMetrics fallback ──
  // PR-CAM-09: evaluators/squat.ts 가 squatCompletionState 를 직접 설정하므로
  // highlightedMetrics 캐스팅 roundtrip 없이 타입 안전하게 읽는다.
  const cs = result.debug?.squatCompletionState;

  const currentSquatPhase: SquatCycleDebug['currentSquatPhase'] =
    cs?.currentSquatPhase ??
    ((result.debug?.highlightedMetrics?.currentSquatPhase as SquatCycleDebug['currentSquatPhase']) ?? 'idle');
  const evidenceLabel: SquatCycleDebug['evidenceLabel'] =
    cs?.evidenceLabel ??
    ((result.debug?.highlightedMetrics?.evidenceLabel as SquatCycleDebug['evidenceLabel']) ?? 'insufficient_signal');
  const completionBlockedReason: string | null =
    cs?.completionBlockedReason ?? null;
  const attemptStarted = cs?.attemptStarted ?? false;
  const descendConfirmed = cs?.descendConfirmed ?? false;
  const ascendConfirmed = cs?.ascendConfirmed ?? false;
  const standingRecoveredAtMs = cs?.standingRecoveredAtMs ?? undefined;
  const standingRecoveryHoldMs = cs?.standingRecoveryHoldMs ?? 0;
  const committedAtMs = cs?.committedAtMs ?? undefined;
  const startBeforeBottom = cs?.startBeforeBottom ?? false;
  /** PR-CAM-09: downwardCommitmentDelta 는 squatCompletionState 에서 원본값으로 읽는다 */
  const downwardCommitmentDelta = cs?.downwardCommitmentDelta ?? 0;
  const cycleDurationMs = cs?.cycleDurationMs ?? 0;
  const lowRomRecoveryReason = cs?.lowRomRecoveryReason ?? null;
  const ultraLowRomRecoveryReason = cs?.ultraLowRomRecoveryReason ?? null;
  const recoveryReturnContinuityFrames = cs?.recoveryReturnContinuityFrames ?? undefined;
  const recoveryTrailingDepthCount = cs?.recoveryTrailingDepthCount ?? undefined;
  const recoveryDropRatio = cs?.recoveryDropRatio ?? undefined;
  const completionMachinePhase = cs?.completionMachinePhase ?? undefined;
  const completionPassReason = cs?.completionPassReason ?? undefined;

  // ── 파생 플래그 ──
  const cycleProofPassed = currentSquatPhase === 'standing_recovered';
  const armingSatisfied = currentSquatPhase !== 'idle';
  const startPoseSatisfied = currentSquatPhase !== 'idle' && startBeforeBottom;
  const descendDetected = descentCount > 0 || currentSquatPhase !== 'idle';
  const bottomDetected = bottomCount > 0;
  const ascendDetected =
    ascentCount > 0 ||
    currentSquatPhase === 'ascending' ||
    currentSquatPhase === 'standing_recovered';
  const recoveryDetected = standingRecoveredAtMs != null;
  const bottomTurningPointDetected = bottomDetected || committedAtMs != null;
  const depthBandLabel: 'shallow' | 'moderate' | 'deep' =
    depthBand === 2 ? 'deep' : depthBand === 1 ? 'moderate' : 'shallow';

  // ── 타이밍 (squatCompletionState 에서 직접) ──
  const descendStartAtMs = cs?.descendStartAtMs ?? undefined;
  const peakAtMs = cs?.peakAtMs ?? undefined;
  const reversalAtMs = cs?.reversalAtMs ?? undefined;
  const ascendStartAtMs = cs?.ascendStartAtMs ?? undefined;
  const recoveryAtMs = standingRecoveredAtMs;

  // ── PR-CAM-09: evidence 매핑은 squat-evidence.ts 헬퍼로 위임 ──
  const squatEvidenceLevel = evidenceLabelToSquatEvidenceLevel(
    evidenceLabel ?? 'insufficient_signal',
    cycleProofPassed
  );
  const squatEvidenceReasons = squatEvidenceLevelToReasons(squatEvidenceLevel, completionBlockedReason);
  const confidenceDowngradeReason = squatEvidenceLevelToConfidenceDowngradeReason(squatEvidenceLevel);
  const insufficientSignalReason: string | null =
    squatEvidenceLevel === 'insufficient_signal'
      ? (completionBlockedReason ?? 'cycle_proof_insufficient')
      : null;

  const squatCycleDebug: SquatCycleDebug = {
    armingSatisfied,
    currentSquatPhase,
    attemptStarted,
    startPoseSatisfied,
    startBeforeBottom,
    descendDetected,
    bottomDetected,
    bottomTurningPointDetected,
    ascendDetected,
    recoveryDetected,
    cycleComplete,
    completionStatus: guardrail.completionStatus,
    depthBand: depthBandLabel,
    passBlockedReason: null,
    qualityInterpretationReason: null,
    completionBlockedReason,
    evidenceLabel,
    descendStartAtMs,
    downwardCommitmentAtMs: peakAtMs,
    committedAtMs,
    reversalAtMs,
    ascendStartAtMs,
    recoveryAtMs,
    standingRecoveredAtMs,
    standingRecoveryHoldMs,
    cycleDurationMs,
    downwardCommitmentDelta,
    standingStillRejected: evidenceLabel === 'insufficient_signal',
    falsePositiveBlockReason: null,
    descendConfirmed,
    ascendConfirmed,
    reversalConfirmedAfterDescend: committedAtMs != null && reversalAtMs != null,
    recoveryConfirmedAfterReversal: standingRecoveredAtMs != null && reversalAtMs != null,
    minimumCycleDurationSatisfied: cycleDurationMs >= SQUAT_ARMING_MS,
    ultraLowRomPathDisabledOrGuarded: false,
    squatEvidenceLevel,
    squatEvidenceReasons,
    cycleProofPassed,
    romBand: depthBandLabel,
    confidenceDowngradeReason,
    insufficientSignalReason,
    lowRomRejectionReason:
      evidenceLabel === 'low_rom' && !cycleProofPassed ? lowRomRecoveryReason : null,
    ultraLowRomRejectionReason:
      evidenceLabel === 'ultra_low_rom' && !cycleProofPassed ? ultraLowRomRecoveryReason : null,
    recoveryReturnContinuityFrames,
    recoveryTrailingDepthCount,
    recoveryDropRatio,
    completionMachinePhase,
    completionPassReason,
    squatInternalQuality: result.debug?.squatInternalQuality,
  };

  if (guardrail.completionStatus !== 'complete') {
    squatCycleDebug.passBlockedReason = 'guardrail_not_complete';
    squatCycleDebug.completionRejectedReason = 'guardrail_not_complete';
    squatCycleDebug.falsePositiveBlockReason = 'guardrail_not_complete';
    squatCycleDebug.insufficientSignalReason = 'guardrail_not_complete';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['guardrail_not_complete'];
    squatCycleDebug.guardrailPartialReason = guardrail.debug?.guardrailPartialReason;
    return { satisfied: false, squatCycleDebug };
  }
  if (currentSquatPhase !== 'standing_recovered' || completionBlockedReason != null) {
    squatCycleDebug.passBlockedReason = completionBlockedReason ?? 'not_standing_recovered';
    squatCycleDebug.completionRejectedReason =
      completionBlockedReason ?? 'not_standing_recovered';
    squatCycleDebug.falsePositiveBlockReason =
      completionBlockedReason ?? 'not_standing_recovered';
    squatCycleDebug.insufficientSignalReason =
      completionBlockedReason ?? 'not_standing_recovered';
    squatCycleDebug.squatEvidenceLevel =
      evidenceLabel === 'insufficient_signal' ? 'insufficient_signal' : squatEvidenceLevel;
    squatCycleDebug.squatEvidenceReasons = [
      completionBlockedReason ?? 'not_standing_recovered',
    ];
    return { satisfied: false, squatCycleDebug };
  }

  squatCycleDebug.completionPathUsed = evidenceLabel;
  squatCycleDebug.successPhaseAtOpen = 'standing_recovered';
  squatCycleDebug.passTriggeredAtPhase = 'standing_recovered';

  // PR-CAM-09: quality cap 로직은 applySquatQualityCap 헬퍼로 위임
  const quality = getSquatQualitySignals(result, guardrail.confidence);
  const capResult = applySquatQualityCap(
    squatEvidenceLevel,
    squatEvidenceReasons,
    evidenceLabel ?? 'insufficient_signal',
    quality
  );

  squatCycleDebug.squatEvidenceLevel = capResult.level;
  squatCycleDebug.squatEvidenceReasons = capResult.reasons;
  squatCycleDebug.qualityInterpretationReason = capResult.qualityInterpretationReason;
  squatCycleDebug.confidenceDowngradeReason = capResult.confidenceDowngradeReason;
  squatCycleDebug.guardrailCompletePath = guardrail.debug?.guardrailCompletePath;
  return { satisfied: true, squatCycleDebug };
}

function getPassConfirmation(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[],
  /** PR-CAM-11B: overhead easy 진행 시 2프레임으로 완화 가능 */
  minStableFrames: number = REQUIRED_STABLE_FRAMES
): {
  satisfied: boolean;
  stableFrameCount: number;
  windowFrameCount: number;
} {
  const recentLandmarks = landmarks.slice(-8);
  if (recentLandmarks.length === 0) {
    return {
      satisfied: false,
      stableFrameCount: 0,
      windowFrameCount: 0,
    };
  }

  const recentFrames = buildPoseFeaturesFrames(stepId, recentLandmarks);
  const stableFrames = recentFrames.filter((frame) => {
    return (
      frame.isValid &&
      frame.visibilitySummary.visibleLandmarkRatio >= 0.45 &&
      frame.visibilitySummary.criticalJointsAvailability >= 0.5 &&
      frame.bodyBox.area >= 0.05 &&
      frame.bodyBox.area <= 0.95 &&
      !frame.qualityHints.includes('timestamp_gap')
    );
  });
  const stableFrameCount = stableFrames.length;
  const recentVisibility =
    stableFrames.length > 0
      ? mean(stableFrames.map((frame) => frame.visibilitySummary.visibleLandmarkRatio))
      : 0;
  const satisfied = stableFrameCount >= minStableFrames && recentVisibility >= 0.52;

  return {
    satisfied,
    stableFrameCount,
    windowFrameCount: recentFrames.length,
  };
}

function getSquatFailureReasons(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  confidence: number
): string[] {
  const failureReasons = new Set<string>();
  // PR-CAM-09: squatCompletionState 에서 typed 로 읽기
  const completionBlockedReason =
    result.debug?.squatCompletionState?.completionBlockedReason ?? null;

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
  // PR-CAM-09: blocked reason → failure tag 매핑은 squat-retry-reason.ts 헬퍼로 위임
  for (const tag of completionBlockedReasonToFailureTags(completionBlockedReason)) {
    failureReasons.add(tag);
  }
  if (guardrail.flags.includes('left_side_missing')) {
    failureReasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    failureReasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('hard_partial')) {
    failureReasons.add('hard_partial');
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
  if (guardrail.flags.includes('rep_incomplete')) {
    reasons.add('rep_incomplete');
  }
  if (guardrail.flags.includes('hold_too_short')) {
    reasons.add('hold_too_short');
  }
  if (guardrail.captureQuality !== 'ok') {
    reasons.add(guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid');
  }
  const ohm = stepId === 'overhead-reach' ? result.debug?.highlightedMetrics : undefined;
  const overheadEasyOnly =
    stepId === 'overhead-reach' &&
    (ohm?.easyCompletionSatisfied === true || ohm?.easyCompletionSatisfied === 1) &&
    !(ohm?.strictMotionCompletionSatisfied === true || ohm?.strictMotionCompletionSatisfied === 1);
  const confFloor = overheadEasyOnly
    ? OVERHEAD_EASY_PASS_CONFIDENCE
    : BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  if (confidence < confFloor) {
    reasons.add('confidence_too_low');
  }
  if (guardrail.flags.includes('left_side_missing')) {
    reasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    reasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('hard_partial')) {
    reasons.add('hard_partial');
  }
  return Array.from(reasons);
}

/**
 * PR-CAM-10: 장시간 invalid( severeFail ) 직전에도 “의미 있는” 하강+상승/복귀 신호가 있으면
 * 설문 유도 fail 대신 retry 로 한 번 더 기회를 준다. (임계값·completion 로직 변경 없음)
 */
function squatMeaningfulAttemptAllowsRetryInsteadOfSevereFail(
  d: SquatCycleDebug | undefined
): boolean {
  if (!d) return false;
  if (d.evidenceLabel === 'insufficient_signal') return false;
  if (!d.descendDetected) return false;
  if (!d.ascendDetected && !d.recoveryDetected) return false;
  return true;
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
  const overheadEasyOnly =
    stepId === 'overhead-reach' &&
    (() => {
      const hm = evaluatorResult.debug?.highlightedMetrics;
      const strict =
        hm?.strictMotionCompletionSatisfied === true || hm?.strictMotionCompletionSatisfied === 1;
      const easy = hm?.easyCompletionSatisfied === true || hm?.easyCompletionSatisfied === 1;
      // PR-CAM-15: low-ROM path도 easy-only 완화 적용 (동일 confidence·latch 임계)
      const lowRom =
        hm?.lowRomProgressionSatisfied === true || hm?.lowRomProgressionSatisfied === 1;
      return Boolean((easy || lowRom) && !strict);
    })();
  const passThresholdEffective = overheadEasyOnly ? OVERHEAD_EASY_PASS_CONFIDENCE : passThreshold;
  const passConfirmation = getPassConfirmation(
    stepId,
    landmarks,
    overheadEasyOnly ? OVERHEAD_EASY_LATCH_STABLE_FRAMES : REQUIRED_STABLE_FRAMES
  );
  let completionSatisfied: boolean;
  let squatCycleDebug: SquatCycleDebug | undefined;
  if (stepId === 'squat') {
    const squatResult = getSquatProgressionCompletionSatisfied(evaluatorResult, guardrail, stats);
    completionSatisfied = squatResult.satisfied;
    squatCycleDebug = squatResult.squatCycleDebug;
  } else {
    completionSatisfied = getCompletionSatisfied(stepId, evaluatorResult, guardrail, stats);
  }
  /** PR G10: overhead — passConfirmation is provisional; never true without completion. */
  const effectivePassConfirmation =
    stepId === 'overhead-reach'
      ? passConfirmation.satisfied && completionSatisfied
      : passConfirmation.satisfied;
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
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
    };
  }

  /** PR-CAM-11B/15: easy/low-ROM 진행 통과 시 reasons에 남은 hold_too_short/rep_incomplete 로 pass를 막지 않음 */
  const hasHoldOrRepReason = hasAnyReason(reasons, ['rep_incomplete', 'hold_too_short']);
  const overheadEasySat =
    stepId === 'overhead-reach' &&
    (evaluatorResult.debug?.highlightedMetrics?.easyCompletionSatisfied === true ||
      evaluatorResult.debug?.highlightedMetrics?.easyCompletionSatisfied === 1 ||
      // PR-CAM-15: low-ROM 통과 시도 동일하게 hold/rep 차단 해제
      evaluatorResult.debug?.highlightedMetrics?.lowRomProgressionSatisfied === true ||
      evaluatorResult.debug?.highlightedMetrics?.lowRomProgressionSatisfied === 1);
  const overheadRepHoldBlocks = overheadEasySat ? false : hasHoldOrRepReason;

  const progressionPassed =
    completionSatisfied &&
    guardrail.captureQuality !== 'invalid' &&
    confidence >= passThresholdEffective &&
    effectivePassConfirmation &&
    !hasAnyReason(reasons, hardBlockerReasons) &&
    !overheadRepHoldBlocks;

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
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
    };
  }

  if (severeFail) {
    const squatSoftRetry =
      stepId === 'squat' &&
      squatCycleDebug &&
      squatMeaningfulAttemptAllowsRetryInsteadOfSevereFail(squatCycleDebug);
    if (squatSoftRetry) {
      const enrichedSquatDebug: SquatCycleDebug = {
        ...squatCycleDebug,
        squatRetryContractObservation: {
          severeFailSoftenedToRetry: true,
          fallbackUsed: 'weak_cycle_retry_instead_of_survey_fail',
        },
      };
      return {
        status: 'retry',
        progressionState: 'retry_required',
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
        uiMessage: getRetryMessage(guardrail),
        autoAdvanceDelayMs,
        passConfirmationSatisfied: passConfirmation.satisfied,
        passConfirmationFrameCount: passConfirmation.stableFrameCount,
        passConfirmationWindowCount: passConfirmation.windowFrameCount,
        squatCycleDebug: enrichedSquatDebug,
      };
    }
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
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
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
      'hard_partial',
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
      passConfirmationSatisfied: passConfirmation.satisfied,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
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
    passConfirmationSatisfied: effectivePassConfirmation,
    passConfirmationFrameCount: passConfirmation.stableFrameCount,
    passConfirmationWindowCount: passConfirmation.windowFrameCount,
    ...(squatCycleDebug && { squatCycleDebug }),
  };
}
