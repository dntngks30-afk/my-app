/**
 * PR success-diagnostic: runtime success-owner 추적
 * 실기기에서 success를 실제로 연 최종 owner를 기록한다.
 * threshold/contract 변경 없음, 진단 전용.
 */
import type { ExerciseGateResult } from './auto-progression';
import type { CameraStepId } from '@/lib/public/camera-test';

/** build/runtime diagnostic version — 실기기 bundle 확인용 */
export const CAMERA_DIAG_VERSION = 'success-diagnostic-2025-03-18';

/** source file marker — 해당 파일이 런타임에 포함됐는지 확인 */
export const SUCCESS_DIAG_SOURCE_MARKER = 'camera-success-diagnostic-v1';

const DIAG_FREEZE_LOCALSTORAGE_KEY = 'moveReCameraDiagFreezeSuccess';

/**
 * diagnostic freeze mode: success 직후 자동 전환 대신 overlay로 freeze.
 * ?diag=1&freeze_success=1 또는 localStorage flag.
 */
export function isDiagnosticFreezeMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('diag') === '1' && params.get('freeze_success') === '1') return true;
    return localStorage.getItem(DIAG_FREEZE_LOCALSTORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDiagnosticFreezeMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      localStorage.setItem(DIAG_FREEZE_LOCALSTORAGE_KEY, '1');
    } else {
      localStorage.removeItem(DIAG_FREEZE_LOCALSTORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

const SUCCESS_SNAPSHOT_KEY = 'moveReCameraSuccessSnapshots:v1';
const MAX_SUCCESS_SNAPSHOTS = 20;

export type SuccessOpenedBy =
  | 'effectivePassLatched'
  | 'passReady'
  | 'finalPassLatched'
  | 'unknown';

export interface SuccessSnapshotBase {
  id: string;
  ts: string;
  successOpenedAtMs: number;
  passLatchedAtMs: number;
  motionType: 'squat' | 'overhead_reach';
  currentRoute: string;
  successOpenedBy: SuccessOpenedBy;
  competingSuccessPathsDetected: string[];
  diagVersion: string;
  sourceFileMarkers: string[];
}

export interface OverheadSuccessSnapshot extends SuccessSnapshotBase {
  motionType: 'overhead_reach';
  evaluatorTopEntry: number | null;
  evaluatorHoldDurationMs: number;
  guardrailCompletionStatus: string;
  autoProgressionCompletionSatisfied: boolean;
  passConfirmationSatisfied: boolean;
  pagePassReady: boolean;
  effectivePassLatched: boolean;
  successOpenedByOverhead: SuccessOpenedBy;
  topDetectedAtMs: number | undefined;
  topEntryAtMs: number | undefined;
  stableTopEntryAtMs: number | undefined;
  holdArmedAtMs: number | undefined;
  holdAccumulationStartedAtMs: number | undefined;
  holdSatisfiedAtMs: number | undefined;
  holdArmingBlockedReason: string | null;
  successTriggeredAtMs: number;
}

export interface SquatSuccessSnapshot extends SuccessSnapshotBase {
  motionType: 'squat';
  evaluatorDepthPeak: number | null;
  baselineStandingDepth?: number | null;
  rawDepthPeak?: number | null;
  relativeDepthPeak?: number | null;
  evaluatorRecoverySignals: {
    recovered: boolean;
    lowRomRecovered: boolean;
    ultraLowRomRecovered: boolean;
  };
  guardrailCompletionStatus: string;
  autoProgressionCompletionSatisfied: boolean;
  completionPathUsed: string | undefined;
  passConfirmationSatisfied: boolean;
  effectivePassLatched: boolean;
  successOpenedBySquat: SuccessOpenedBy;
  attemptStarted?: boolean;
  currentSquatPhase?: string | null;
  descendConfirmed?: boolean;
  committedAtMs?: number;
  descendStartAtMs: number | undefined;
  reversalAtMs: number | undefined;
  ascendConfirmed?: boolean;
  recoveryAtMs: number | undefined;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs?: number;
  successPhaseAtOpen?: string | null;
  evidenceLabel?: string | null;
  completionBlockedReason?: string | null;
  cycleDurationMs: number | undefined;
}

export type SuccessSnapshot = OverheadSuccessSnapshot | SquatSuccessSnapshot;

export interface RecordOverheadSuccessOptions {
  gate: ExerciseGateResult;
  successOpenedBy: SuccessOpenedBy;
  currentRoute: string;
  passLatchedAtMs: number;
  pagePassReady: boolean;
  effectivePassLatched: boolean;
  competingPaths?: string[];
}

export interface RecordSquatSuccessOptions {
  gate: ExerciseGateResult;
  successOpenedBy: SuccessOpenedBy;
  currentRoute: string;
  passLatchedAtMs: number;
  effectivePassLatched: boolean;
  competingPaths?: string[];
}

function pushSuccessSnapshot(snapshot: SuccessSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SUCCESS_SNAPSHOT_KEY);
    const list: SuccessSnapshot[] = raw ? (JSON.parse(raw) as SuccessSnapshot[]) : [];
    list.push(snapshot);
    const trimmed = list.slice(-MAX_SUCCESS_SNAPSHOTS);
    localStorage.setItem(SUCCESS_SNAPSHOT_KEY, JSON.stringify(trimmed));
  } catch {
    // 진단 실패 시 플로우는 정상 동작
  }
}

export function recordOverheadSuccessSnapshot(options: RecordOverheadSuccessOptions): void {
  try {
    const hm = options.gate.evaluatorResult?.debug?.highlightedMetrics;
    const snapshot: OverheadSuccessSnapshot = {
      id: `oh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      successOpenedAtMs: options.passLatchedAtMs,
      passLatchedAtMs: options.passLatchedAtMs,
      motionType: 'overhead_reach',
      currentRoute: options.currentRoute,
      successOpenedBy: options.successOpenedBy,
      competingSuccessPathsDetected: options.competingPaths ?? [],
      diagVersion: CAMERA_DIAG_VERSION,
      sourceFileMarkers: [SUCCESS_DIAG_SOURCE_MARKER, 'overhead-reach-page'],
      evaluatorTopEntry: typeof hm?.peakArmElevation === 'number' ? hm.peakArmElevation : null,
      evaluatorHoldDurationMs: typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0,
      guardrailCompletionStatus: options.gate.guardrail.completionStatus ?? 'unknown',
      autoProgressionCompletionSatisfied: options.gate.completionSatisfied,
      passConfirmationSatisfied: options.gate.passConfirmationSatisfied ?? false,
      pagePassReady: options.pagePassReady,
      effectivePassLatched: options.effectivePassLatched,
      successOpenedByOverhead: options.successOpenedBy,
      topDetectedAtMs: typeof hm?.topDetectedAtMs === 'number' ? hm.topDetectedAtMs : undefined,
      topEntryAtMs: typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined,
      stableTopEntryAtMs: typeof hm?.stableTopEntryAtMs === 'number' ? hm.stableTopEntryAtMs : undefined,
      holdArmedAtMs: typeof hm?.holdArmedAtMs === 'number' ? hm.holdArmedAtMs : undefined,
      holdAccumulationStartedAtMs:
        typeof hm?.holdAccumulationStartedAtMs === 'number' ? hm.holdAccumulationStartedAtMs : undefined,
      holdSatisfiedAtMs: typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined,
      holdArmingBlockedReason: hm?.holdArmingBlockedReason ?? null,
      successTriggeredAtMs: options.passLatchedAtMs,
    };
    pushSuccessSnapshot(snapshot);
  } catch {
    // ignore
  }
}

export function recordSquatSuccessSnapshot(options: RecordSquatSuccessOptions): void {
  try {
    const hm = options.gate.evaluatorResult?.debug?.highlightedMetrics;
    const squatDebug = options.gate.squatCycleDebug;
    const snapshot: SquatSuccessSnapshot = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      successOpenedAtMs: options.passLatchedAtMs,
      passLatchedAtMs: options.passLatchedAtMs,
      motionType: 'squat',
      currentRoute: options.currentRoute,
      successOpenedBy: options.successOpenedBy,
      competingSuccessPathsDetected: options.competingPaths ?? [],
      diagVersion: CAMERA_DIAG_VERSION,
      sourceFileMarkers: [SUCCESS_DIAG_SOURCE_MARKER, 'squat-page'],
      evaluatorDepthPeak: typeof hm?.depthPeak === 'number' ? hm.depthPeak : null,
      baselineStandingDepth:
        typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : null,
      rawDepthPeak: typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : null,
      relativeDepthPeak:
        typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : null,
      evaluatorRecoverySignals: {
        recovered: (hm?.ascentRecovered as number) > 0,
        lowRomRecovered: (hm?.ascentRecoveredLowRom as number) > 0,
        ultraLowRomRecovered: (hm?.ascentRecoveredUltraLowRom as number) > 0,
      },
      guardrailCompletionStatus: options.gate.guardrail.completionStatus ?? 'unknown',
      autoProgressionCompletionSatisfied: options.gate.completionSatisfied,
      completionPathUsed: squatDebug?.completionPathUsed,
      passConfirmationSatisfied: options.gate.passConfirmationSatisfied ?? false,
      effectivePassLatched: options.effectivePassLatched,
      successOpenedBySquat: options.successOpenedBy,
      attemptStarted: squatDebug?.attemptStarted,
      currentSquatPhase: squatDebug?.currentSquatPhase ?? null,
      descendConfirmed: squatDebug?.descendConfirmed,
      committedAtMs: squatDebug?.committedAtMs,
      descendStartAtMs: squatDebug?.descendStartAtMs,
      reversalAtMs: squatDebug?.reversalAtMs,
      ascendConfirmed: squatDebug?.ascendConfirmed,
      recoveryAtMs: squatDebug?.recoveryAtMs,
      standingRecoveredAtMs: squatDebug?.standingRecoveredAtMs,
      standingRecoveryHoldMs: squatDebug?.standingRecoveryHoldMs,
      successPhaseAtOpen: squatDebug?.successPhaseAtOpen ?? null,
      evidenceLabel: squatDebug?.evidenceLabel ?? null,
      completionBlockedReason: squatDebug?.completionBlockedReason ?? null,
      cycleDurationMs: squatDebug?.cycleDurationMs,
    };
    pushSuccessSnapshot(snapshot);
  } catch {
    // ignore
  }
}

export function getRecentSuccessSnapshots(): SuccessSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUCCESS_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as SuccessSnapshot[]) : [];
  } catch {
    return [];
  }
}

/* --- Squat failed shallow attempt snapshot (diagnostic only) --- */
const FAILED_SHALLOW_SNAPSHOT_KEY = 'moveReCameraFailedShallowSnapshots:v1';
const MAX_FAILED_SHALLOW_SNAPSHOTS = 10;

/** relativeDepthPeak noise floor (0–1) — below this = standing/tiny sway, no real attempt */
const SQUAT_ATTEMPT_RELATIVE_DEPTH_NOISE_FLOOR = 0.02;

/**
 * Attempt evidence: 실제 squat 시도가 있었는지.
 * idle standing / tiny sway에서는 false.
 */
export function hasSquatAttemptEvidence(gate: ExerciseGateResult): boolean {
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics;
  const attemptStarted =
    hm?.attemptStarted === true ||
    hm?.attemptStarted === 1 ||
    gate.squatCycleDebug?.attemptStarted === true;
  const currentSquatPhase =
    (hm?.currentSquatPhase as string | undefined) ?? gate.squatCycleDebug?.currentSquatPhase;
  const firstDescentIdx = (hm?.firstDescentIdx as number) ?? -1;
  const firstBottomIdx = (hm?.firstBottomIdx as number) ?? -1;
  const relativeDepthPeak = (hm?.relativeDepthPeak as number) ?? 0;
  const downwardCommitmentDelta = (hm?.downwardCommitmentDelta as number) ?? 0;

  const descendConfirmed = firstDescentIdx >= 0;
  const downwardCommitmentReached =
    firstBottomIdx >= 0 || downwardCommitmentDelta >= SQUAT_ATTEMPT_RELATIVE_DEPTH_NOISE_FLOOR;
  const relativeDepthAboveNoise = relativeDepthPeak >= SQUAT_ATTEMPT_RELATIVE_DEPTH_NOISE_FLOOR;

  return (
    currentSquatPhase !== 'idle' &&
    attemptStarted &&
    descendConfirmed &&
    (downwardCommitmentReached || relativeDepthAboveNoise)
  );
}

export interface SquatFailedShallowSnapshot {
  id: string;
  ts: string;
  motionType: 'squat';
  currentRoute: string;
  /** @deprecated use rawDepthPeak / baselineStandingDepth / relativeDepthPeak */
  depthPeak: number | null;
  rawDepthPeak?: number | null;
  baselineStandingDepth?: number | null;
  relativeDepthPeak?: number | null;
  attemptStarted?: boolean;
  currentSquatPhase?: string | null;
  descendConfirmed?: boolean;
  downwardCommitmentReached?: boolean;
  committedAtMs?: number;
  ascendConfirmed?: boolean;
  failureOverlayArmed?: boolean;
  failureOverlayBlockedReason?: string | null;
  guardrailCompletionStatus: string;
  autoProgressionCompletionSatisfied: boolean;
  completionPathUsed: string | undefined;
  completionRejectedReason: string | null | undefined;
  lowRomRecoveryConfirmed: boolean;
  ultraLowRomRecoveryConfirmed: boolean;
  passConfirmationSatisfied: boolean;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs?: number;
  successPhaseAtOpen?: string | null;
  evidenceLabel?: string | null;
  completionBlockedReason?: string | null;
  cycleDurationMs: number | undefined;
  guardrailPartialReason?: string | null;
  lowRomRecoveredReason?: string | null;
  ultraLowRomRecoveredReason?: string | null;
  diagVersion: string;
}

export function recordSquatFailedShallowSnapshot(
  gate: ExerciseGateResult,
  options?: { failureOverlayArmed: boolean; failureOverlayBlockedReason: string | null }
): void {
  try {
    const hm = gate.evaluatorResult?.debug?.highlightedMetrics;
    const sc = gate.squatCycleDebug;
    const depthPeak = typeof hm?.depthPeak === 'number' ? hm.depthPeak : null;
    const rawDepthPeak = typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : null;
    const baselineStandingDepth =
      typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : null;
    const relativeDepthPeak =
      typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : null;
    const firstDescentIdx = (hm?.firstDescentIdx as number) ?? -1;
    const firstBottomIdx = (hm?.firstBottomIdx as number) ?? -1;
    const descentCount = (hm?.descentCount as number) ?? 0;
    const downwardCommitmentDelta = (hm?.downwardCommitmentDelta as number) ?? 0;

    const descendConfirmed = firstDescentIdx >= 0;
    const downwardCommitmentReached =
      firstBottomIdx >= 0 || downwardCommitmentDelta >= SQUAT_ATTEMPT_RELATIVE_DEPTH_NOISE_FLOOR;
    const attemptStarted = descentCount > 0 || descendConfirmed;

    const ascentRecoveredLowRom = (hm?.ascentRecoveredLowRom as number) ?? 0;
    const ascentRecoveredUltraLowRom = (hm?.ascentRecoveredUltraLowRom as number) ?? 0;
    const recoveryLowRomDetected = ascentRecoveredLowRom > 0;
    const recoveryUltraLowRomDetected = ascentRecoveredUltraLowRom > 0;
    const lowRomRecoveryConfirmed =
      depthPeak != null && depthPeak >= 7 && depthPeak < 10 && recoveryLowRomDetected;
    const ultraLowRomRecoveryConfirmed =
      depthPeak != null && depthPeak >= 2 && depthPeak < 7 && recoveryUltraLowRomDetected;

    const failureOverlayArmed = options?.failureOverlayArmed ?? hasSquatAttemptEvidence(gate);
    const failureOverlayBlockedReason = options?.failureOverlayBlockedReason ?? null;

    const snapshot: SquatFailedShallowSnapshot = {
      id: `sq-fail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      motionType: 'squat',
      currentRoute: typeof window !== 'undefined' ? window.location.pathname : '',
      depthPeak,
      rawDepthPeak,
      baselineStandingDepth,
      relativeDepthPeak,
      attemptStarted,
      currentSquatPhase: sc?.currentSquatPhase ?? null,
      descendConfirmed,
      downwardCommitmentReached,
      committedAtMs: sc?.committedAtMs,
      ascendConfirmed: sc?.ascendConfirmed,
      failureOverlayArmed,
      failureOverlayBlockedReason,
      guardrailCompletionStatus: gate.guardrail.completionStatus ?? 'unknown',
      autoProgressionCompletionSatisfied: gate.completionSatisfied,
      completionPathUsed: sc?.completionPathUsed,
      completionRejectedReason: sc?.completionRejectedReason,
      lowRomRecoveryConfirmed,
      ultraLowRomRecoveryConfirmed,
      passConfirmationSatisfied: gate.passConfirmationSatisfied ?? false,
      standingRecoveredAtMs: sc?.standingRecoveredAtMs,
      standingRecoveryHoldMs: sc?.standingRecoveryHoldMs,
      successPhaseAtOpen: sc?.successPhaseAtOpen ?? null,
      evidenceLabel: sc?.evidenceLabel ?? null,
      completionBlockedReason: sc?.completionBlockedReason ?? null,
      cycleDurationMs: sc?.cycleDurationMs,
      guardrailPartialReason: gate.guardrail.debug?.guardrailPartialReason ?? null,
      lowRomRecoveredReason: sc?.lowRomRejectionReason ?? (hm?.lowRomRecoveryReason as string) ?? null,
      ultraLowRomRecoveredReason: sc?.ultraLowRomRejectionReason ?? (hm?.ultraLowRomRecoveryReason as string) ?? null,
      diagVersion: CAMERA_DIAG_VERSION,
    };

    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(FAILED_SHALLOW_SNAPSHOT_KEY);
    const list: SquatFailedShallowSnapshot[] = raw
      ? (JSON.parse(raw) as SquatFailedShallowSnapshot[])
      : [];
    list.push(snapshot);
    const trimmed = list.slice(-MAX_FAILED_SHALLOW_SNAPSHOTS);
    localStorage.setItem(FAILED_SHALLOW_SNAPSHOT_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function getRecentFailedShallowSnapshots(): SquatFailedShallowSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAILED_SHALLOW_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as SquatFailedShallowSnapshot[]) : [];
  } catch {
    return [];
  }
}
