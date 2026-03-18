import type { EvaluatorMetric, EvaluatorResult } from './evaluators/types';
import type { StepGuardrailResult } from './guardrails';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseCaptureStats } from './use-pose-capture';
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildPoseFeaturesFrames } from './pose-features';
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

/** PR G3: squat full-cycle observability (dev/debug only) */
/** PR-A4: completionPathUsed, completionRejectedReason, cycle timing */
/** PR evidence: completion과 evidence strength 분리 — result layer가 입력 품질 읽기 */
export type SquatEvidenceLevel = 'strong_evidence' | 'shallow_evidence' | 'weak_evidence' | 'insufficient_signal';

export interface SquatCycleDebug {
  armingSatisfied: boolean;
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
  completionPathUsed?: 'standard' | 'low_rom_reversal' | 'ultra_low_rom_reversal' | 'ultra_low_rom_guarded';
  completionRejectedReason?: string | null;
  ultraLowRomCandidate?: boolean;
  ultraLowRomGuardPassed?: boolean;
  ultraLowRomRejectReason?: string | null;
  /** PR-A6: standing false positive trace */
  standingStillRejected?: boolean;
  falsePositiveBlockReason?: string | null;
  descendConfirmed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  minimumCycleDurationSatisfied?: boolean;
  standardPathBlockedReason?: string | null;
  ultraLowRomPathDisabledOrGuarded?: boolean;
  descendStartAtMs?: number;
  downwardCommitmentAtMs?: number;
  reversalAtMs?: number;
  ascendStartAtMs?: number;
  recoveryAtMs?: number;
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
  >
): boolean {
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

  if (stepId === 'overhead-reach') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const holdDurationMs = getHighlightedMetric(result, 'holdDurationMs');
    return raiseCount > 0 && peakCount >= OVERHEAD_MIN_PEAK_FRAMES && holdDurationMs >= OVERHEAD_HOLD_COMPLETION_MS ? 0.04 : 0;
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

/** PR G7: depth = quality only. Completion = full cycle + recovery. */
function evaluateSquatCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const ascentRecovered = getHighlightedMetric(result, 'ascentRecovered');

  return (
    guardrail.completionStatus === 'complete' &&
    descentCount > 0 &&
    bottomCount > 0 &&
    (ascentCount > 0 || ascentRecovered > 0) &&
    ascentRecovered > 0
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

/** PR G8/G9: overhead reach — real attempt + explicit top-hold window before success.
 * PR G11: absolute top floor — effectiveArm must reach true overhead level.
 * Product: user must hold at top ~1–2s before final success. */
const REQUIRED_TOP_HOLD_MS = 1200;
const OVERHEAD_HOLD_COMPLETION_MS = REQUIRED_TOP_HOLD_MS;
const OVERHEAD_MIN_PEAK_FRAMES = 3;
const OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG = 132;

function evaluateOverheadReachCompletion(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
) {
  const peakArm = getHighlightedMetric(result, 'peakArmElevation');
  const armRange = getMetricValue(result.metrics, 'arm_range') ?? 0;
  const effectiveArm = peakArm > 0 ? peakArm : armRange;
  const holdDuration = getMetricValue(result.rawMetrics, 'hold_duration') ?? 0;
  const raiseCount = getHighlightedMetric(result, 'raiseCount');
  const peakCount = getHighlightedMetric(result, 'peakCount');

  return (
    guardrail.completionStatus === 'complete' &&
    effectiveArm >= OVERHEAD_ABSOLUTE_TOP_FLOOR_DEG &&
    holdDuration >= OVERHEAD_HOLD_COMPLETION_MS &&
    raiseCount > 0 &&
    peakCount >= OVERHEAD_MIN_PEAK_FRAMES
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
  const startCount = getHighlightedMetric(result, 'startCount');
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const ascentRecovered = getHighlightedMetric(result, 'ascentRecovered');
  const ascentRecoveredLowRom = getHighlightedMetric(result, 'ascentRecoveredLowRom');
  const ascentRecoveredUltraLowRom = getHighlightedMetric(result, 'ascentRecoveredUltraLowRom');
  const ascentRecoveredUltraLowRomGuarded = getHighlightedMetric(
    result,
    'ascentRecoveredUltraLowRomGuarded'
  ) > 0;
  const cycleComplete = getHighlightedMetric(result, 'cycleComplete') > 0;
  const depthPeak = getHighlightedMetric(result, 'depthPeak');
  const depthBand = getHighlightedMetric(result, 'depthBand'); /* 0=shallow, 1=moderate, 2=deep */
  const lowRomRecoveryReason = (result.debug?.highlightedMetrics?.lowRomRecoveryReason as string) ?? null;
  const ultraLowRomRecoveryReason = (result.debug?.highlightedMetrics?.ultraLowRomRecoveryReason as string) ?? null;
  const recoveryReturnContinuityFrames = (result.debug?.highlightedMetrics?.recoveryReturnContinuityFrames as number) ?? undefined;
  const recoveryTrailingDepthCount = (result.debug?.highlightedMetrics?.recoveryTrailingDepthCount as number) ?? undefined;
  const recoveryDropRatio = (result.debug?.highlightedMetrics?.recoveryDropRatio as number) ?? undefined;
  const downwardCommitmentDelta =
    (getHighlightedMetric(result, 'downwardCommitmentDelta') ?? 0) / 100;
  const firstDescentIdx = (result.debug?.highlightedMetrics?.firstDescentIdx as number) ?? -1;
  const firstBottomIdx = (result.debug?.highlightedMetrics?.firstBottomIdx as number) ?? -1;
  const firstAscentIdx = (result.debug?.highlightedMetrics?.firstAscentIdx as number) ?? -1;
  const cycleDurationMs = getHighlightedMetric(result, 'cycleDurationMs') ?? 0;
  const relativeDepthPeak = (result.debug?.highlightedMetrics?.relativeDepthPeak as number) ?? 0;
  const baselineStandingDepth = (result.debug?.highlightedMetrics?.baselineStandingDepth as number) ?? 0;
  const rawDepthPeak = (result.debug?.highlightedMetrics?.rawDepthPeak as number) ?? 0;

  const armingSatisfied = stats.captureDurationMs >= SQUAT_ARMING_MS;
  const startBeforeBottom = getHighlightedMetric(result, 'startBeforeBottom') > 0;
  const startPoseSatisfied = startCount > 0 && startBeforeBottom;
  const descendDetected = descentCount > 0;
  const bottomDetected = bottomCount > 0;
  const ascendDetected = ascentCount > 0;
  const recoveryDetected = ascentRecovered > 0;
  const recoveryLowRomDetected = ascentRecoveredLowRom > 0;
  const recoveryUltraLowRomDetected = ascentRecoveredUltraLowRom > 0;
  /** PR G11: low-ROM path — peak 7–10%, stricter recovery. */
  const lowRomRecoveryConfirmed =
    depthPeak >= 7 && depthPeak < 10 && recoveryLowRomDetected;
  /** Ultra-low-ROM path — peak 2–7%, very strict recovery. Real cycle proof. */
  const ultraLowRomRecoveryConfirmed =
    depthPeak >= 2 && depthPeak < 7 && recoveryUltraLowRomDetected;
  /** PR-A5: guarded ultra-low-ROM — peak 1–2%. PR-A6: emergency disabled (standing false positive). */
  const ULTRA_LOW_ROM_GUARDED_DISABLED = true;
  const ultraLowRomGuardedCandidate =
    !ULTRA_LOW_ROM_GUARDED_DISABLED &&
    depthPeak >= 1 &&
    depthPeak < 2 &&
    ascentRecoveredUltraLowRomGuarded;
  const ultraLowRomGuardPassed = false; /* PR-A6: path disabled */
  /** PR G10: recovery proves meaningful excursion (peak>=10%, came back). Allow completion without bottom phase. */
  const excursionOrBottomConfirmed =
    bottomDetected ||
    recoveryDetected ||
    lowRomRecoveryConfirmed ||
    ultraLowRomRecoveryConfirmed;
  const recoveryOrLowRom =
    recoveryDetected ||
    lowRomRecoveryConfirmed ||
    ultraLowRomRecoveryConfirmed;

  const bottomTurningPointDetected = bottomDetected;
  const depthBandLabel: 'shallow' | 'moderate' | 'deep' =
    depthBand === 2 ? 'deep' : depthBand === 1 ? 'moderate' : 'shallow';

  /** PR evidence: cycle proof와 ROM band로 evidence level 분리. completion gate와 독립. */
  const cycleProofPassed = excursionOrBottomConfirmed && recoveryOrLowRom;
  const squatEvidenceLevel: SquatEvidenceLevel =
    !cycleProofPassed || depthPeak < 2
      ? 'insufficient_signal'
      : depthPeak >= 10
        ? 'strong_evidence'
        : depthPeak >= 7
          ? 'shallow_evidence'
          : 'weak_evidence';
  const squatEvidenceReasons: string[] =
    squatEvidenceLevel === 'insufficient_signal'
      ? cycleProofPassed ? ['standing_or_tiny_dip_rejected'] : ['cycle_proof_insufficient']
      : squatEvidenceLevel === 'strong_evidence'
        ? ['sufficient_depth', 'cycle_complete']
        : squatEvidenceLevel === 'shallow_evidence'
          ? ['low_rom', 'cycle_complete']
          : ['ultra_low_rom', 'cycle_complete'];
  const confidenceDowngradeReason: string | null =
    squatEvidenceLevel === 'shallow_evidence'
      ? 'shallow_depth'
      : squatEvidenceLevel === 'weak_evidence'
        ? 'ultra_low_rom_cycle'
        : null;
  const insufficientSignalReason: string | null =
    squatEvidenceLevel === 'insufficient_signal'
      ? (cycleProofPassed ? 'standing_tiny_dip' : 'cycle_proof_insufficient')
      : null;

  const descendStartAtMs = getHighlightedMetric(result, 'descendStartAtMs') || undefined;
  const peakAtMs = getHighlightedMetric(result, 'peakAtMs') || undefined;
  const reversalAtMs = getHighlightedMetric(result, 'reversalAtMs') || undefined;
  const ascendStartAtMs = getHighlightedMetric(result, 'ascendStartAtMs') || undefined;
  const recoveryAtMs = getHighlightedMetric(result, 'recoveryAtMs') || undefined;

  const squatCycleDebug: SquatCycleDebug = {
    armingSatisfied,
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
    descendStartAtMs,
    downwardCommitmentAtMs: peakAtMs,
    reversalAtMs,
    ascendStartAtMs,
    recoveryAtMs,
    cycleDurationMs,
    downwardCommitmentDelta,
    ultraLowRomCandidate: ultraLowRomGuardedCandidate,
    ultraLowRomGuardPassed: ultraLowRomGuardPassed,
    ultraLowRomRejectReason: ultraLowRomGuardedCandidate && !ultraLowRomGuardPassed
      ? (stats.captureDurationMs < 1000
          ? 'cycle_duration_short'
          : downwardCommitmentDelta < 0.01
            ? 'commitment_too_low'
            : descentCount < 3
              ? 'descend_frames_insufficient'
              : 'guard_not_passed')
      : undefined,
    standingStillRejected: depthPeak < 2,
    falsePositiveBlockReason: null,
    /** PR standing-fp: explicit sequence — descend before reversal before recovery */
    descendConfirmed: firstDescentIdx >= 0,
    reversalConfirmedAfterDescend:
      firstBottomIdx >= 0 && firstBottomIdx > firstDescentIdx,
    recoveryConfirmedAfterReversal:
      (recoveryDetected || recoveryLowRomDetected || recoveryUltraLowRomDetected) &&
      firstAscentIdx > firstBottomIdx,
    minimumCycleDurationSatisfied: (cycleDurationMs ?? 0) >= 1200,
    ultraLowRomPathDisabledOrGuarded: ULTRA_LOW_ROM_GUARDED_DISABLED,
    squatEvidenceLevel,
    squatEvidenceReasons,
    cycleProofPassed,
    romBand: depthBandLabel,
    confidenceDowngradeReason,
    insufficientSignalReason,
    lowRomRejectionReason:
      depthPeak >= 7 && depthPeak < 10 && !recoveryLowRomDetected ? lowRomRecoveryReason : null,
    ultraLowRomRejectionReason:
      depthPeak >= 2 && depthPeak < 7 && !recoveryUltraLowRomDetected ? ultraLowRomRecoveryReason : null,
    recoveryReturnContinuityFrames,
    recoveryTrailingDepthCount,
    recoveryDropRatio,
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
  if (!armingSatisfied) {
    squatCycleDebug.passBlockedReason = 'arming_window';
    squatCycleDebug.completionRejectedReason = 'arming_window';
    squatCycleDebug.falsePositiveBlockReason = 'arming_window';
    squatCycleDebug.insufficientSignalReason = 'arming_window';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['arming_window'];
    return { satisfied: false, squatCycleDebug };
  }
  if (!startPoseSatisfied) {
    squatCycleDebug.passBlockedReason =
      startCount > 0 && !startBeforeBottom ? 'bottom_from_start' : 'start_pose_missing';
    squatCycleDebug.completionRejectedReason = squatCycleDebug.passBlockedReason;
    squatCycleDebug.falsePositiveBlockReason = squatCycleDebug.passBlockedReason;
    squatCycleDebug.insufficientSignalReason = squatCycleDebug.passBlockedReason;
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = [squatCycleDebug.passBlockedReason ?? 'start_pose'];
    return { satisfied: false, squatCycleDebug };
  }
  if (!descendDetected) {
    squatCycleDebug.passBlockedReason = 'descend_not_detected';
    squatCycleDebug.completionRejectedReason = 'descend_not_detected';
    squatCycleDebug.falsePositiveBlockReason = 'descend_not_detected';
    squatCycleDebug.insufficientSignalReason = 'descend_not_detected';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['descend_not_detected'];
    return { satisfied: false, squatCycleDebug };
  }
  if (!excursionOrBottomConfirmed) {
    squatCycleDebug.passBlockedReason = 'excursion_not_confirmed';
    squatCycleDebug.completionRejectedReason =
      depthPeak >= 7 && depthPeak < 10 && !recoveryLowRomDetected
        ? `excursion_low_rom:${lowRomRecoveryReason ?? 'unknown'}`
        : depthPeak >= 2 && depthPeak < 7 && !recoveryUltraLowRomDetected
          ? `excursion_ultra_low_rom:${ultraLowRomRecoveryReason ?? 'unknown'}`
          : 'excursion_not_confirmed';
    squatCycleDebug.falsePositiveBlockReason = 'excursion_not_confirmed';
    squatCycleDebug.insufficientSignalReason = 'excursion_not_confirmed';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['excursion_not_confirmed'];
    return { satisfied: false, squatCycleDebug };
  }
  if (!ascendDetected && !recoveryOrLowRom) {
    squatCycleDebug.passBlockedReason = 'ascent_recovery_missing';
    squatCycleDebug.completionRejectedReason = 'ascent_recovery_missing';
    squatCycleDebug.falsePositiveBlockReason = 'ascent_recovery_missing';
    squatCycleDebug.insufficientSignalReason = 'ascent_recovery_missing';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['ascent_recovery_missing'];
    return { satisfied: false, squatCycleDebug };
  }
  if (!recoveryOrLowRom) {
    squatCycleDebug.passBlockedReason = 'recovery_not_confirmed';
    squatCycleDebug.completionRejectedReason =
      depthPeak >= 7 && depthPeak < 10
        ? `recovery_low_rom:${lowRomRecoveryReason ?? 'unknown'}`
        : depthPeak >= 2 && depthPeak < 7
          ? `recovery_ultra_low_rom:${ultraLowRomRecoveryReason ?? 'unknown'}`
          : 'recovery_not_confirmed';
    squatCycleDebug.falsePositiveBlockReason = 'recovery_not_confirmed';
    squatCycleDebug.insufficientSignalReason = 'recovery_not_confirmed';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['recovery_not_confirmed'];
    return { satisfied: false, squatCycleDebug };
  }
  /* PR G6: depth는 completion gate에서 제거. quality band로만 해석. */
  /* PR-A4/A5: completionPathUsed for trace */
  const wouldBeStandard =
    !ultraLowRomRecoveryConfirmed && !lowRomRecoveryConfirmed;
  squatCycleDebug.completionPathUsed = ultraLowRomRecoveryConfirmed
    ? 'ultra_low_rom_reversal'
    : lowRomRecoveryConfirmed
      ? 'low_rom_reversal'
      : 'standard';

  /** PR standing-fp: standard path hard gate — explicit sequence + relative depth + min cycle */
  const MIN_STANDARD_RELATIVE_DEPTH = 0.10;
  const MIN_STANDARD_CYCLE_DURATION_MS = 1200;
  const standardDescendOk = squatCycleDebug.descendConfirmed === true;
  const standardReversalOk = squatCycleDebug.reversalConfirmedAfterDescend === true;
  const standardRecoveryOk = squatCycleDebug.recoveryConfirmedAfterReversal === true;
  const standardDurationOk = squatCycleDebug.minimumCycleDurationSatisfied === true;
  const standardRelativeDepthOk = relativeDepthPeak >= MIN_STANDARD_RELATIVE_DEPTH;

  if (wouldBeStandard && squatCycleDebug.completionPathUsed === 'standard') {
    if (!standardDescendOk) {
      squatCycleDebug.standardPathBlockedReason = 'descend_not_confirmed';
      squatCycleDebug.completionRejectedReason = 'standard_path:descend_not_confirmed';
      squatCycleDebug.passBlockedReason = 'standard_path:descend_not_confirmed';
      return { satisfied: false, squatCycleDebug };
    }
    if (!standardReversalOk) {
      squatCycleDebug.standardPathBlockedReason = 'reversal_not_after_descend';
      squatCycleDebug.completionRejectedReason = 'standard_path:reversal_not_after_descend';
      squatCycleDebug.passBlockedReason = 'standard_path:reversal_not_after_descend';
      return { satisfied: false, squatCycleDebug };
    }
    if (!standardRecoveryOk) {
      squatCycleDebug.standardPathBlockedReason = 'recovery_not_after_reversal';
      squatCycleDebug.completionRejectedReason = 'standard_path:recovery_not_after_reversal';
      squatCycleDebug.passBlockedReason = 'standard_path:recovery_not_after_reversal';
      return { satisfied: false, squatCycleDebug };
    }
    if (!standardDurationOk) {
      squatCycleDebug.standardPathBlockedReason = 'cycle_duration_short';
      squatCycleDebug.completionRejectedReason = 'standard_path:cycle_duration_short';
      squatCycleDebug.passBlockedReason = 'standard_path:cycle_duration_short';
      return { satisfied: false, squatCycleDebug };
    }
    if (!standardRelativeDepthOk) {
      squatCycleDebug.standardPathBlockedReason = 'relative_depth_insufficient';
      squatCycleDebug.completionRejectedReason = 'standard_path:relative_depth_insufficient';
      squatCycleDebug.passBlockedReason = 'standard_path:relative_depth_insufficient';
      return { satisfied: false, squatCycleDebug };
    }
  }

  squatCycleDebug.passTriggeredAtPhase = 'recovery';
  squatCycleDebug.qualityInterpretationReason =
    depthBand === 0 ? 'valid_limited_shallow' : 'valid_strong';
  squatCycleDebug.guardrailCompletePath = guardrail.debug?.guardrailCompletePath;
  return { satisfied: true, squatCycleDebug };
}

function getPassConfirmation(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[]
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
  const satisfied = stableFrameCount >= 3 && recentVisibility >= 0.52;

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
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const ascentRecovered = getHighlightedMetric(result, 'ascentRecovered');

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
  /* PR G6: depth는 completion 실패 사유가 아님. quality band로만 해석. */
  if (
    ascentCount === 0 &&
    ascentRecovered === 0 &&
    (descentCount === 0 || bottomCount === 0 || ascentCount === 0)
  ) {
    failureReasons.add('ascent_not_detected');
  }
  if (
    (descentCount > 0 && bottomCount > 0) &&
    ascentRecovered === 0 &&
    result.completionHints?.includes('recovery_not_confirmed')
  ) {
    failureReasons.add('ascent_not_detected');
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
  if (confidence < BASIC_PASS_CONFIDENCE_THRESHOLD[stepId]) {
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
  const passConfirmation = getPassConfirmation(stepId, landmarks);
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

  const progressionPassed =
    completionSatisfied &&
    guardrail.captureQuality !== 'invalid' &&
    confidence >= passThreshold &&
    effectivePassConfirmation &&
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
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
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
