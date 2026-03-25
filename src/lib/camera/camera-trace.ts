/**
 * PR-4: 카메라 시도 관측용 경량 trace
 * - pass/funnel/result 계약 변경 없음
 * - 요약 전용 snapshot, raw frame/landmark 저장 없음
 */
import type { ExerciseGateResult } from './auto-progression';
import type { CaptureQuality } from './guardrails';
import type { CameraStepId } from '@/lib/public/camera-test';
import { CAMERA_DIAG_VERSION, hasSquatAttemptEvidence } from './camera-success-diagnostic';
import { isFinalPassLatched } from './auto-progression';
import { getCorrectiveCueObservability } from './voice-guidance';
import { getLastPlaybackObservability } from './korean-audio-pack';
import type { SquatInternalQuality } from './squat/squat-internal-quality';
import type { OverheadInternalQuality } from './overhead/overhead-internal-quality';

/** PR-4: movement type (squat, overhead_reach만 지원) */
export type TraceMovementType = 'squat' | 'overhead_reach';

/** PR-4: 최종 결과 카테고리 */
export type TraceOutcome =
  | 'ok'
  | 'low'
  | 'invalid'
  | 'retry_required'
  | 'retry_optional'
  | 'failed';

/** PR-4: 경량 attempt snapshot */
export interface AttemptSnapshot {
  id: string;
  ts: string;
  movementType: TraceMovementType;
  outcome: TraceOutcome;
  captureQuality: CaptureQuality;
  confidence: number;
  motionCompleteness: string;
  progressionPassed: boolean;
  finalPassLatched: boolean;
  fallbackType: string | null;
  flags: string[];
  topReasons: string[];
  perStepSummary?: Record<string, unknown>;
  readinessSummary?: {
    state: 'not_ready' | 'ready' | 'success';
    rawState?: 'not_ready' | 'ready' | 'success';
    blocker: string | null;
    framingHint: string | null;
    smoothingApplied: boolean;
    validFrameCount?: number;
    visibleJointsRatio?: number;
    criticalJointsAvailability?: number;
  };
  stabilitySummary?: {
    warmupExcludedFrameCount?: number;
    qualityFrameCount?: number;
    selectedWindowStartMs?: number | null;
    selectedWindowEndMs?: number | null;
    selectedWindowScore?: number | null;
  };
  /** dev-only: real-device diagnosis — pass/cue/latch 직결 런타임 값 */
  diagnosisSummary?: {
    stepId: string;
    readinessState?: string;
    captureQuality: CaptureQuality;
    completionSatisfied: boolean;
    passConfirmed: boolean;
    passLatched: boolean;
    autoNextObservation?: string;
    sampledFrameCount?: number;
    /** squat — PR-A4 cycle trace */
    squatCycle?: {
      peakDepth?: number;
      depthBand?: string;
      currentSquatPhase?: string;
      descendDetected: boolean;
      bottomDetected: boolean;
      recoveryDetected: boolean;
      startBeforeBottom: boolean;
      cycleComplete: boolean;
      passBlockedReason: string | null;
      completionPathUsed?: string;
      completionRejectedReason?: string | null;
      descendStartAtMs?: number;
      downwardCommitmentAtMs?: number;
      committedAtMs?: number;
      reversalAtMs?: number;
      ascendStartAtMs?: number;
      recoveryAtMs?: number;
      standingRecoveredAtMs?: number;
      standingRecoveryHoldMs?: number;
      successPhaseAtOpen?: string;
      cycleDurationMs?: number;
      downwardCommitmentDelta?: number;
      ultraLowRomCandidate?: boolean;
      ultraLowRomGuardPassed?: boolean;
      ultraLowRomRejectReason?: string | null;
      standingStillRejected?: boolean;
      falsePositiveBlockReason?: string | null;
      descendConfirmed?: boolean;
      ascendConfirmed?: boolean;
      reversalConfirmedAfterDescend?: boolean;
      recoveryConfirmedAfterReversal?: boolean;
      minimumCycleDurationSatisfied?: boolean;
      standardPathBlockedReason?: string | null;
      baselineStandingDepth?: number;
      rawDepthPeak?: number;
      relativeDepthPeak?: number;
      ultraLowRomPathDisabledOrGuarded?: boolean;
      /** PR evidence: completion과 분리된 evidence layer */
      squatEvidenceLevel?: string;
      squatEvidenceReasons?: string[];
      cycleProofPassed?: boolean;
      romBand?: string;
      confidenceDowngradeReason?: string | null;
      insufficientSignalReason?: string | null;
      /** PR failure-freeze: overlay arming — attempt evidence 기반 */
      failureOverlayArmed?: boolean;
      failureOverlayBlockedReason?: string | null;
      attemptStarted?: boolean;
      downwardCommitmentReached?: boolean;
      evidenceLabel?: string;
      completionBlockedReason?: string | null;
      /** PR shallow: guardrail partial 시 이유 */
      guardrailPartialReason?: string;
      /** PR shallow: guardrail complete 시 경로 */
      guardrailCompletePath?: string;
      /** PR shallow: low-ROM recovery 미확인 이유 */
      lowRomRejectionReason?: string | null;
      /** PR shallow: ultra-low-ROM recovery 미확인 이유 */
      ultraLowRomRejectionReason?: string | null;
      /** PR-COMP-01 */
      completionMachinePhase?: string;
      completionPassReason?: string;
      /** PR-COMP-03 */
      squatInternalQuality?: SquatInternalQuality;
    };
    /** overhead — PR-C4 trace, PR overhead-dwell */
    overhead?: {
      peakElevation?: number;
      peakCount?: number;
      holdDurationMs?: number;
      holdAccumulationMs?: number;
      holdTooShort: boolean;
      topReachDetected: boolean;
      upwardMotionDetected: boolean;
      topDetectedAtMs?: number;
      topEntryAtMs?: number;
      stableTopEntryAtMs?: number;
      holdArmedAtMs?: number;
      holdAccumulationStartedAtMs?: number;
      holdSatisfiedAtMs?: number;
      holdArmingBlockedReason?: string | null;
      holdRemainingMsAtCue?: number;
      holdCuePlayed?: boolean;
      holdCueSuppressedReason?: string | null;
      successEligibleAtMs?: number;
      successTriggeredAtMs?: number;
      successBlockedReason?: string;
      /** PR overhead-dwell: dwell vs legacy span 비교용 */
      holdDurationMsLegacySpan?: number;
      dwellHoldDurationMs?: number;
      legacyHoldDurationMs?: number;
      stableTopEnteredAtMs?: number;
      stableTopExitedAtMs?: number;
      stableTopDwellMs?: number;
      stableTopSegmentCount?: number;
      holdComputationMode?: string;
      /** PR-COMP-04 */
      completionMachinePhase?: string;
      completionBlockedReason?: string | null;
      overheadInternalQuality?: OverheadInternalQuality;
    };
    /** cue */
    cue?: {
      chosenCueKey: string | null;
      chosenClipKey: string | null;
      suppressedReason: string | null;
      liveCueingEnabled: boolean;
    };
  };
  debugVersion: string;
}

const TRACE_STORAGE_KEY = 'moveReCameraTrace:v1';
const MAX_ATTEMPTS = 50;
const DEBUG_VERSION = 'pr4-2';

function stepIdToMovementType(stepId: CameraStepId): TraceMovementType | null {
  if (stepId === 'squat') return 'squat';
  if (stepId === 'overhead-reach') return 'overhead_reach';
  return null;
}

function gateToOutcome(gate: ExerciseGateResult): TraceOutcome {
  if (gate.status === 'pass' && gate.progressionState === 'passed') return 'ok';
  if (gate.progressionState === 'failed') return 'failed';
  if (gate.progressionState === 'insufficient_signal') return 'invalid';
  if (gate.progressionState === 'retry_required') return 'retry_required';
  if (gate.status === 'retry' && gate.retryRecommended) return 'retry_optional';
  if (gate.guardrail.captureQuality === 'invalid') return 'invalid';
  if (gate.guardrail.captureQuality === 'low') return 'low';
  return 'retry_optional';
}

function buildTopReasons(gate: ExerciseGateResult): string[] {
  const reasons: string[] = [];
  const fr = gate.failureReasons ?? [];
  const flags = gate.guardrail.flags ?? [];

  for (const r of fr) {
    if (r && !reasons.includes(r)) reasons.push(r);
  }
  for (const f of flags) {
    if (f && !reasons.includes(f)) reasons.push(f);
  }
  if (gate.evaluatorResult?.completionHints?.length) {
    for (const h of gate.evaluatorResult.completionHints) {
      const s = `completion:${h}`;
      if (!reasons.includes(s)) reasons.push(s);
    }
  }
  if (gate.evaluatorResult?.qualityHints?.length) {
    for (const h of gate.evaluatorResult.qualityHints) {
      const s = `quality:${h}`;
      if (!reasons.includes(s)) reasons.push(s);
    }
  }

  return reasons.slice(0, 8);
}

function extractStabilitySummary(gate: ExerciseGateResult): AttemptSnapshot['stabilitySummary'] {
  const d = gate.guardrail.debug;
  if (!d) return undefined;
  return {
    warmupExcludedFrameCount: d.warmupExcludedFrameCount,
    qualityFrameCount: d.qualityFrameCount,
    selectedWindowStartMs: d.selectedWindowStartMs ?? undefined,
    selectedWindowEndMs: d.selectedWindowEndMs ?? undefined,
    selectedWindowScore: d.selectedWindowScore ?? undefined,
  };
}

function extractPerStepSummary(gate: ExerciseGateResult): Record<string, unknown> | undefined {
  const diag = gate.evaluatorResult?.debug?.perStepDiagnostics;
  const guardrailDiag = gate.guardrail.debug?.perStepDiagnostics;
  if (!diag && !guardrailDiag) return undefined;
  return {
    ...(diag ?? {}),
    ...(guardrailDiag ?? {}),
  } as Record<string, unknown>;
}

export interface RecordAttemptOptions {
  liveCueingEnabled?: boolean;
  autoNextObservation?: string;
  /** PR-C4: overhead hold cue 재생 여부 */
  holdCuePlayed?: boolean;
  /** PR-C4: success latch 시점 (ms) */
  successTriggeredAtMs?: number;
}

function buildDiagnosisSummary(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context: AttemptSnapshot['readinessSummary'] | undefined,
  options?: RecordAttemptOptions
): AttemptSnapshot['diagnosisSummary'] {
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics;
  const passLatched = isFinalPassLatched(stepId, gate);

  let cueObs: ReturnType<typeof getCorrectiveCueObservability> = null;
  let playbackObs: ReturnType<typeof getLastPlaybackObservability> = null;
  if (typeof window !== 'undefined') {
    cueObs = getCorrectiveCueObservability();
    playbackObs = getLastPlaybackObservability();
  }

  const base: NonNullable<AttemptSnapshot['diagnosisSummary']> = {
    stepId,
    readinessState: context?.state,
    captureQuality: gate.guardrail.captureQuality,
    completionSatisfied: gate.completionSatisfied,
    passConfirmed: gate.passConfirmationSatisfied,
    passLatched,
    autoNextObservation: options?.autoNextObservation,
    sampledFrameCount: gate.guardrail.debug?.sampledFrameCount,
    cue: {
      chosenCueKey: cueObs?.cueCandidate ?? null,
      chosenClipKey: playbackObs?.clipKey ?? null,
      suppressedReason: cueObs?.suppressedReason ?? null,
      liveCueingEnabled: options?.liveCueingEnabled ?? false,
    },
  };

  if (stepId === 'squat' && gate.squatCycleDebug) {
    const sc = gate.squatCycleDebug;
    const peakDepth =
      typeof hm?.depthPeak === 'number'
        ? hm.depthPeak
        : gate.evaluatorResult?.metrics?.find((m) => m.name === 'depth')?.value;
    base.squatCycle = {
      peakDepth,
      depthBand: sc.depthBand,
      currentSquatPhase: sc.currentSquatPhase,
      descendDetected: sc.descendDetected,
      bottomDetected: sc.bottomDetected,
      recoveryDetected: sc.recoveryDetected,
      startBeforeBottom: sc.startBeforeBottom,
      cycleComplete: sc.cycleComplete,
      passBlockedReason: sc.passBlockedReason,
      completionPathUsed: sc.completionPathUsed,
      completionRejectedReason: sc.completionRejectedReason,
      descendStartAtMs: sc.descendStartAtMs,
      downwardCommitmentAtMs: sc.downwardCommitmentAtMs,
      committedAtMs: sc.committedAtMs,
      reversalAtMs: sc.reversalAtMs,
      ascendStartAtMs: sc.ascendStartAtMs,
      recoveryAtMs: sc.recoveryAtMs,
      standingRecoveredAtMs: sc.standingRecoveredAtMs,
      standingRecoveryHoldMs: sc.standingRecoveryHoldMs,
      successPhaseAtOpen: sc.successPhaseAtOpen,
      cycleDurationMs: sc.cycleDurationMs,
      downwardCommitmentDelta: sc.downwardCommitmentDelta,
      ultraLowRomCandidate: sc.ultraLowRomCandidate,
      ultraLowRomGuardPassed: sc.ultraLowRomGuardPassed,
      ultraLowRomRejectReason: sc.ultraLowRomRejectReason,
      standingStillRejected: sc.standingStillRejected,
      falsePositiveBlockReason: sc.falsePositiveBlockReason,
      descendConfirmed: sc.descendConfirmed,
      ascendConfirmed: sc.ascendConfirmed,
      reversalConfirmedAfterDescend: sc.reversalConfirmedAfterDescend,
      recoveryConfirmedAfterReversal: sc.recoveryConfirmedAfterReversal,
      minimumCycleDurationSatisfied: sc.minimumCycleDurationSatisfied,
      standardPathBlockedReason: sc.standardPathBlockedReason,
      baselineStandingDepth: typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : undefined,
      rawDepthPeak: typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : undefined,
      relativeDepthPeak: typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined,
      failureOverlayArmed: hasSquatAttemptEvidence(gate),
      failureOverlayBlockedReason: hasSquatAttemptEvidence(gate) ? null : 'no_attempt_evidence',
      attemptStarted: sc.attemptStarted ?? ((sc.descendConfirmed ?? false) || (hm?.descentCount as number) > 0),
      downwardCommitmentReached:
        (sc.reversalConfirmedAfterDescend ?? false) ||
        ((hm?.downwardCommitmentDelta as number) ?? 0) >= 0.02,
      evidenceLabel: sc.evidenceLabel,
      completionBlockedReason: sc.completionBlockedReason,
      ultraLowRomPathDisabledOrGuarded: sc.ultraLowRomPathDisabledOrGuarded,
      squatEvidenceLevel: sc.squatEvidenceLevel,
      squatEvidenceReasons: sc.squatEvidenceReasons,
      cycleProofPassed: sc.cycleProofPassed,
      romBand: sc.romBand,
      confidenceDowngradeReason: sc.confidenceDowngradeReason,
      insufficientSignalReason: sc.insufficientSignalReason,
      guardrailPartialReason: sc.guardrailPartialReason,
      guardrailCompletePath: sc.guardrailCompletePath,
      lowRomRejectionReason: sc.lowRomRejectionReason,
      ultraLowRomRejectionReason: sc.ultraLowRomRejectionReason,
      completionMachinePhase: sc.completionMachinePhase,
      completionPassReason: sc.completionPassReason,
      squatInternalQuality: gate.evaluatorResult.debug?.squatInternalQuality,
    };
  }

  if (stepId === 'overhead-reach') {
    const REQUIRED_HOLD_MS = 1200;
    const raiseCount = typeof hm?.raiseCount === 'number' ? hm.raiseCount : 0;
    const peakCount = typeof hm?.peakCount === 'number' ? hm.peakCount : 0;
    const holdDurationMs = typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0;
    const topDetectedAtMs = typeof hm?.topDetectedAtMs === 'number' ? hm.topDetectedAtMs : undefined;
    const topEntryAtMs = typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined;
    const stableTopEntryAtMs =
      typeof hm?.stableTopEntryAtMs === 'number' ? hm.stableTopEntryAtMs : undefined;
    const holdArmedAtMs = typeof hm?.holdArmedAtMs === 'number' ? hm.holdArmedAtMs : undefined;
    const holdAccumulationStartedAtMs =
      typeof hm?.holdAccumulationStartedAtMs === 'number' ? hm.holdAccumulationStartedAtMs : undefined;
    const holdArmingBlockedReason = hm?.holdArmingBlockedReason ?? undefined;
    const holdAccumulationMs = typeof hm?.holdAccumulationMs === 'number' ? hm.holdAccumulationMs : holdDurationMs;
    const holdSatisfiedAtMs = typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined;
    const peakElevation =
      typeof hm?.peakArmElevation === 'number'
        ? hm.peakArmElevation
        : gate.evaluatorResult?.metrics?.find((m) => m.name === 'arm_range')?.value;
    const holdSatisfied = holdDurationMs >= REQUIRED_HOLD_MS;
    const isHoldCue = cueObs?.cueCandidate === 'correction:hold:overhead-reach';
    const successBlockedReason = passLatched
      ? undefined
      : !gate.completionSatisfied
        ? gate.guardrail.flags?.includes('hold_too_short')
          ? 'hold_too_short'
          : gate.guardrail.flags?.includes('rep_incomplete')
            ? 'rep_incomplete'
            : 'completion_not_satisfied'
        : gate.guardrail.captureQuality === 'invalid'
          ? 'capture_quality_invalid'
          : gate.confidence < 0.72
            ? 'confidence_too_low'
            : !gate.passConfirmationSatisfied
              ? 'pass_confirmation_pending'
              : undefined;
    const holdDurationMsLegacySpan = typeof hm?.holdDurationMsLegacySpan === 'number' ? hm.holdDurationMsLegacySpan : undefined;
    const dwellHoldDurationMs = typeof hm?.dwellHoldDurationMs === 'number' ? hm.dwellHoldDurationMs : holdDurationMs;
    const legacyHoldDurationMs = typeof hm?.legacyHoldDurationMs === 'number' ? hm.legacyHoldDurationMs : holdDurationMsLegacySpan;
    const stableTopEnteredAtMs = typeof hm?.stableTopEnteredAtMs === 'number' ? hm.stableTopEnteredAtMs : undefined;
    const stableTopExitedAtMs = typeof hm?.stableTopExitedAtMs === 'number' ? hm.stableTopExitedAtMs : undefined;
    const stableTopDwellMs = typeof hm?.stableTopDwellMs === 'number' ? hm.stableTopDwellMs : undefined;
    const stableTopSegmentCount = typeof hm?.stableTopSegmentCount === 'number' ? hm.stableTopSegmentCount : undefined;
    const holdComputationMode = typeof hm?.holdComputationMode === 'string' ? hm.holdComputationMode : undefined;

    base.overhead = {
      peakElevation,
      peakCount,
      holdDurationMs,
      holdAccumulationMs,
      holdTooShort: gate.failureReasons?.includes('hold_too_short') ?? false,
      topReachDetected: peakCount > 0,
      upwardMotionDetected: raiseCount > 0,
      topDetectedAtMs,
      topEntryAtMs,
      stableTopEntryAtMs,
      holdArmedAtMs,
      holdAccumulationStartedAtMs,
      holdSatisfiedAtMs:
        holdSatisfiedAtMs ??
        (holdSatisfied && holdArmedAtMs != null ? holdArmedAtMs + REQUIRED_HOLD_MS : undefined),
      holdArmingBlockedReason: holdArmingBlockedReason ?? undefined,
      holdRemainingMsAtCue: REQUIRED_HOLD_MS - holdDurationMs,
      holdCuePlayed: options?.holdCuePlayed,
      holdCueSuppressedReason: isHoldCue ? (cueObs?.suppressedReason ?? null) : undefined,
      successEligibleAtMs: passLatched ? (options?.successTriggeredAtMs ?? Date.now()) : undefined,
      successTriggeredAtMs: options?.successTriggeredAtMs,
      successBlockedReason: successBlockedReason ?? undefined,
      holdDurationMsLegacySpan,
      dwellHoldDurationMs,
      legacyHoldDurationMs,
      stableTopEnteredAtMs,
      holdArmedAtMs,
      stableTopExitedAtMs,
      stableTopDwellMs,
      stableTopSegmentCount,
      holdComputationMode,
      completionMachinePhase:
        typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : undefined,
      completionBlockedReason:
        typeof hm?.completionBlockedReason === 'string' ? hm.completionBlockedReason : undefined,
      overheadInternalQuality: gate.evaluatorResult.debug?.overheadInternalQuality,
    };
  }

  return base;
}

/**
 * gate 결과로부터 compact attempt snapshot 생성
 */
export function buildAttemptSnapshot(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context?: AttemptSnapshot['readinessSummary'],
  options?: RecordAttemptOptions
): AttemptSnapshot | null {
  const movementType = stepIdToMovementType(stepId);
  if (!movementType) return null;

  const outcome = gateToOutcome(gate);
  const finalPassLatched = isFinalPassLatched(stepId, gate);
  const progressionPassed =
    gate.status === 'pass' &&
    gate.completionSatisfied &&
    gate.guardrail.captureQuality !== 'invalid';

  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    movementType,
    outcome,
    captureQuality: gate.guardrail.captureQuality,
    confidence: gate.confidence,
    motionCompleteness: gate.guardrail.completionStatus ?? 'unknown',
    progressionPassed,
    finalPassLatched,
    fallbackType: gate.guardrail.fallbackMode,
    flags: [...(gate.flags ?? []), ...(gate.guardrail.flags ?? [])].filter(
      (f, i, arr) => arr.indexOf(f) === i
    ),
    topReasons: buildTopReasons(gate),
    perStepSummary: extractPerStepSummary(gate),
    readinessSummary: context,
    stabilitySummary: extractStabilitySummary(gate),
    diagnosisSummary: buildDiagnosisSummary(stepId, gate, context, options),
    debugVersion: `${DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

/**
 * snapshot을 bounded localStorage에 추가 (non-blocking)
 */
export function pushAttemptSnapshot(snapshot: AttemptSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    const list: AttemptSnapshot[] = raw ? (JSON.parse(raw) as AttemptSnapshot[]) : [];
    list.push(snapshot);
    const trimmed = list.slice(-MAX_ATTEMPTS);
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // trace 실패 시 카메라 플로우는 정상 동작해야 함
  }
}

/**
 * 최근 attempt 목록 조회
 */
export function getRecentAttempts(): AttemptSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttemptSnapshot[]) : [];
  } catch {
    return [];
  }
}

/**
 * trace 저장소 초기화
 */
export function clearAttempts(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRACE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** dogfooding용 quick stats */
export interface TraceQuickStats {
  byMovement: Record<TraceMovementType, number>;
  byOutcome: Record<TraceOutcome, number>;
  topRetryReasons: { reason: string; count: number }[];
  topFlags: { flag: string; count: number }[];
  okLowInvalidByMovement: Record<
    TraceMovementType,
    { ok: number; low: number; invalid: number }
  >;
}

export function getQuickStats(snapshots: AttemptSnapshot[]): TraceQuickStats {
  const byMovement: Record<TraceMovementType, number> = {
    squat: 0,
    overhead_reach: 0,
  };
  const byOutcome: Record<TraceOutcome, number> = {
    ok: 0,
    low: 0,
    invalid: 0,
    retry_required: 0,
    retry_optional: 0,
    failed: 0,
  };
  const reasonCounts: Record<string, number> = {};
  const flagCounts: Record<string, number> = {};
  const okLowInvalidByMovement: Record<
    TraceMovementType,
    { ok: number; low: number; invalid: number }
  > = {
    squat: { ok: 0, low: 0, invalid: 0 },
    overhead_reach: { ok: 0, low: 0, invalid: 0 },
  };

  for (const s of snapshots) {
    byMovement[s.movementType] = (byMovement[s.movementType] ?? 0) + 1;
    byOutcome[s.outcome] = (byOutcome[s.outcome] ?? 0) + 1;

    const dist = okLowInvalidByMovement[s.movementType];
    if (dist) {
      if (s.outcome === 'ok') dist.ok += 1;
      else if (
        s.outcome === 'low' ||
        s.outcome === 'retry_optional' ||
        s.outcome === 'retry_required'
      )
        dist.low += 1;
      else dist.invalid += 1;
    }

    for (const r of s.topReasons ?? []) {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
    for (const f of s.flags ?? []) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }

  const topRetryReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  return {
    byMovement,
    byOutcome,
    topRetryReasons,
    topFlags,
    okLowInvalidByMovement,
  };
}

/**
 * gate가 있을 때 snapshot을 생성하고 저장 (non-blocking)
 * 실패해도 예외를 던지지 않음
 */
export function recordAttemptSnapshot(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context?: AttemptSnapshot['readinessSummary'],
  options?: RecordAttemptOptions
): void {
  try {
    const snapshot = buildAttemptSnapshot(stepId, gate, context, options);
    if (snapshot) pushAttemptSnapshot(snapshot);
  } catch {
    // trace 실패 시 카메라 플로우는 정상 동작해야 함
  }
}
