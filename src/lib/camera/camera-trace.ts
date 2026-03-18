/**
 * PR-4: 카메라 시도 관측용 경량 trace
 * - pass/funnel/result 계약 변경 없음
 * - 요약 전용 snapshot, raw frame/landmark 저장 없음
 */
import type { ExerciseGateResult } from './auto-progression';
import type { CaptureQuality } from './guardrails';
import type { CameraStepId } from '@/lib/public/camera-test';
import { isFinalPassLatched } from './auto-progression';
import { getCorrectiveCueObservability } from './voice-guidance';
import { getLastPlaybackObservability } from './korean-audio-pack';

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
    /** squat */
    squatCycle?: {
      peakDepth?: number;
      depthBand?: string;
      descendDetected: boolean;
      bottomDetected: boolean;
      recoveryDetected: boolean;
      startBeforeBottom: boolean;
      cycleComplete: boolean;
      passBlockedReason: string | null;
    };
    /** overhead — PR-C4 trace */
    overhead?: {
      peakElevation?: number;
      peakCount?: number;
      holdDurationMs?: number;
      holdTooShort: boolean;
      topReachDetected: boolean;
      upwardMotionDetected: boolean;
      topEntryAtMs?: number;
      holdSatisfiedAtMs?: number;
      holdRemainingMsAtCue?: number;
      holdCuePlayed?: boolean;
      holdCueSuppressedReason?: string | null;
      successEligibleAtMs?: number;
      successTriggeredAtMs?: number;
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
      descendDetected: sc.descendDetected,
      bottomDetected: sc.bottomDetected,
      recoveryDetected: sc.recoveryDetected,
      startBeforeBottom: sc.startBeforeBottom,
      cycleComplete: sc.cycleComplete,
      passBlockedReason: sc.passBlockedReason,
    };
  }

  if (stepId === 'overhead-reach') {
    const REQUIRED_HOLD_MS = 1200;
    const raiseCount = typeof hm?.raiseCount === 'number' ? hm.raiseCount : 0;
    const peakCount = typeof hm?.peakCount === 'number' ? hm.peakCount : 0;
    const holdDurationMs = typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0;
    const topEntryAtMs = typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined;
    const peakElevation =
      typeof hm?.peakArmElevation === 'number'
        ? hm.peakArmElevation
        : gate.evaluatorResult?.metrics?.find((m) => m.name === 'arm_range')?.value;
    const holdSatisfied = holdDurationMs >= REQUIRED_HOLD_MS;
    const isHoldCue = cueObs?.cueCandidate === 'correction:hold:overhead-reach';
    base.overhead = {
      peakElevation,
      peakCount,
      holdDurationMs,
      holdTooShort: gate.failureReasons?.includes('hold_too_short') ?? false,
      topReachDetected: peakCount > 0,
      upwardMotionDetected: raiseCount > 0,
      topEntryAtMs,
      holdSatisfiedAtMs: holdSatisfied && topEntryAtMs != null ? topEntryAtMs + REQUIRED_HOLD_MS : undefined,
      holdRemainingMsAtCue: REQUIRED_HOLD_MS - holdDurationMs,
      holdCuePlayed: options?.holdCuePlayed,
      holdCueSuppressedReason: isHoldCue ? (cueObs?.suppressedReason ?? null) : undefined,
      successEligibleAtMs: passLatched ? (options?.successTriggeredAtMs ?? Date.now()) : undefined,
      successTriggeredAtMs: options?.successTriggeredAtMs,
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
    debugVersion: DEBUG_VERSION,
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
