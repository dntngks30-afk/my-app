/**
 * PR success-diagnostic: runtime success-owner 추적
 * 실기기에서 success를 실제로 연 최종 owner를 기록한다.
 * threshold/contract 변경 없음, 진단 전용.
 */
import type { ExerciseGateResult } from './auto-progression';
import {
  buildSquatCalibrationTraceCompact,
  type SquatCalibrationTraceCompact,
} from '@/lib/camera/squat/squat-calibration-trace';
import {
  buildSquatArmingAssistTraceCompact,
  type SquatArmingAssistTraceCompact,
} from '@/lib/camera/squat/squat-arming-assist';

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
  standingRecoveryFrameCount?: number;
  standingRecoveryMinFramesUsed?: number;
  standingRecoveryMinHoldMsUsed?: number;
  standingRecoveryBand?: string | null;
  standingRecoveryFinalizeReason?: string | null;
  successPhaseAtOpen?: string | null;
  evidenceLabel?: string | null;
  completionBlockedReason?: string | null;
  cycleDurationMs: number | undefined;
  /** CAM-OBS: 모바일 진단 패널용 게이트 요약(통과 시점 스냅샷) */
  gateStatus?: string;
  progressionState?: string;
  finalPassLatched?: boolean;
  confidence?: number;
  captureQuality?: string;
  failureReasonsSnapshot?: string[];
  flagsSnapshot?: string[];
  finalPassBlockedReason?: string | null;
  finalPassEligible?: boolean;
  depthBand?: string;
  romBand?: string;
  completionPassReason?: string | null;
  /** PR-04D1: squat pass vs quality-only 경고 분리 스냅샷 */
  completionTruthPassed?: boolean;
  lowQualityPassAllowed?: boolean;
  passOwner?: string;
  qualityOnlyWarnings?: string[];
  /** PR-04E1 */
  armingDepthSource?: string | null;
  armingDepthPeak?: number | null;
  squatDepthPeakPrimary?: number | null;
  squatDepthPeakBlended?: number | null;
  armingDepthBlendAssisted?: boolean;
  armingFallbackUsed?: boolean;
  /** PR-04E2 */
  reversalConfirmedBy?: string | null;
  reversalDepthDrop?: number | null;
  reversalFrameCount?: number | null;
  /** PR-04E3A */
  relativeDepthPeakSource?: string | null;
  rawDepthPeakPrimary?: number | null;
  rawDepthPeakBlended?: number | null;
  /** PR-04E3B */
  baselineFrozen?: boolean;
  baselineFrozenDepth?: number | null;
  peakLatched?: boolean;
  peakLatchedAtIndex?: number | null;
  eventCycleDetected?: boolean;
  eventCycleBand?: string | null;
  eventCyclePromoted?: boolean;
  eventCycleSource?: string | null;
  /** PR-04E3C: shallow low_rom_event_cycle 승격이 “cycle”인지 한눈에 */
  reversalLiteConfirmed?: boolean;
  recoveryLiteConfirmed?: boolean;
  reversalLiteDrop?: number | null;
  cycleProofPassed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  squatDescentToPeakMs?: number;
  squatReversalToStandingMs?: number;
  /** PR-HMM-03A: shallow 성공 캘리브레이션 스냅샷 (컴팩트) */
  squatCalibrationCompact?: SquatCalibrationTraceCompact;
  /** PR-HMM-04A: arming assist compact */
  armCompact?: SquatArmingAssistTraceCompact;
  /** PR-CAM-SUCCESS-UI-SETTLE-01: 페이지 레이어 shallow 성공 settle (additive) */
  successUiCandidateAt?: string | null;
  successUiSettledAt?: string | null;
  successUiSettleMsUsed?: number | null;
  successUiSettlePath?: string | null;
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
  /** PR-CAM-SUCCESS-UI-SETTLE-01 */
  successUiCandidateAt?: string | null;
  successUiSettledAt?: string | null;
  successUiSettleMsUsed?: number | null;
  successUiSettlePath?: string | null;
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
      holdArmingBlockedReason:
        hm?.holdArmingBlockedReason == null ? null : String(hm.holdArmingBlockedReason),
      successTriggeredAtMs: options.passLatchedAtMs,
    };
    pushSuccessSnapshot(snapshot);
  } catch {
    // ignore
  }
}

function extractSquatMobileObsFieldsFromGate(
  gate: ExerciseGateResult,
  effectivePassLatched: boolean
): Pick<
  SquatSuccessSnapshot,
  | 'gateStatus'
  | 'progressionState'
  | 'finalPassLatched'
  | 'confidence'
  | 'captureQuality'
  | 'failureReasonsSnapshot'
  | 'flagsSnapshot'
  | 'finalPassBlockedReason'
  | 'finalPassEligible'
  | 'depthBand'
  | 'romBand'
  | 'completionPassReason'
  | 'cycleProofPassed'
  | 'reversalConfirmedAfterDescend'
  | 'recoveryConfirmedAfterReversal'
  | 'squatDescentToPeakMs'
  | 'squatReversalToStandingMs'
  | 'completionTruthPassed'
  | 'lowQualityPassAllowed'
  | 'passOwner'
  | 'qualityOnlyWarnings'
  | 'armingDepthSource'
  | 'armingDepthPeak'
  | 'squatDepthPeakPrimary'
  | 'squatDepthPeakBlended'
  | 'armingDepthBlendAssisted'
  | 'armingFallbackUsed'
  | 'reversalConfirmedBy'
  | 'reversalDepthDrop'
  | 'reversalFrameCount'
  | 'relativeDepthPeakSource'
  | 'rawDepthPeakPrimary'
  | 'rawDepthPeakBlended'
  | 'baselineFrozen'
  | 'baselineFrozenDepth'
  | 'peakLatched'
  | 'peakLatchedAtIndex'
  | 'eventCycleDetected'
  | 'eventCycleBand'
  | 'eventCyclePromoted'
  | 'eventCycleSource'
  | 'reversalLiteConfirmed'
  | 'recoveryLiteConfirmed'
  | 'reversalLiteDrop'
> {
  const sc = gate.squatCycleDebug;
  const cs = gate.evaluatorResult?.debug?.squatCompletionState as
    | { squatDescentToPeakMs?: number; squatReversalToStandingMs?: number; completionPassReason?: string }
    | undefined;
  return {
    gateStatus: gate.status,
    progressionState: gate.progressionState,
    finalPassLatched: effectivePassLatched,
    confidence: gate.confidence,
    captureQuality: gate.guardrail.captureQuality,
    failureReasonsSnapshot: [...gate.failureReasons],
    flagsSnapshot: [...gate.flags],
    finalPassBlockedReason: gate.finalPassBlockedReason,
    finalPassEligible: gate.finalPassEligible,
    depthBand: sc?.depthBand,
    romBand: sc?.romBand,
    completionPassReason: sc?.completionPassReason ?? cs?.completionPassReason ?? null,
    completionTruthPassed: sc?.completionTruthPassed,
    lowQualityPassAllowed: sc?.lowQualityPassAllowed,
    passOwner: sc?.passOwner,
    qualityOnlyWarnings: sc?.qualityOnlyWarnings,
    armingDepthSource: sc?.armingDepthSource,
    armingDepthPeak: sc?.armingDepthPeak,
    squatDepthPeakPrimary: sc?.squatDepthPeakPrimary,
    squatDepthPeakBlended: sc?.squatDepthPeakBlended,
    armingDepthBlendAssisted: sc?.armingDepthBlendAssisted,
    armingFallbackUsed: sc?.armingFallbackUsed,
    reversalConfirmedBy: sc?.reversalConfirmedBy ?? null,
    reversalDepthDrop: sc?.reversalDepthDrop ?? null,
    reversalFrameCount: sc?.reversalFrameCount ?? null,
    relativeDepthPeakSource: sc?.relativeDepthPeakSource ?? null,
    rawDepthPeakPrimary: sc?.rawDepthPeakPrimary ?? null,
    rawDepthPeakBlended: sc?.rawDepthPeakBlended ?? null,
    baselineFrozen: sc?.baselineFrozen,
    baselineFrozenDepth: sc?.baselineFrozenDepth ?? null,
    peakLatched: sc?.peakLatched,
    peakLatchedAtIndex: sc?.peakLatchedAtIndex ?? null,
    eventCycleDetected: sc?.eventCycleDetected,
    eventCycleBand: sc?.eventCycleBand ?? null,
    eventCyclePromoted: sc?.eventCyclePromoted,
    eventCycleSource: sc?.eventCycleSource ?? null,
    reversalLiteConfirmed: sc?.reversalLiteConfirmed,
    recoveryLiteConfirmed: sc?.recoveryLiteConfirmed,
    reversalLiteDrop:
      typeof sc?.reversalLiteDrop === 'number' && Number.isFinite(sc.reversalLiteDrop)
        ? sc.reversalLiteDrop
        : null,
    cycleProofPassed: sc?.cycleProofPassed,
    reversalConfirmedAfterDescend: sc?.reversalConfirmedAfterDescend,
    recoveryConfirmedAfterReversal: sc?.recoveryConfirmedAfterReversal,
    squatDescentToPeakMs: cs?.squatDescentToPeakMs,
    squatReversalToStandingMs: cs?.squatReversalToStandingMs,
  };
}

export function recordSquatSuccessSnapshot(options: RecordSquatSuccessOptions): void {
  try {
    const hm = options.gate.evaluatorResult?.debug?.highlightedMetrics;
    const squatDebug = options.gate.squatCycleDebug;
    const mobileObs = extractSquatMobileObsFieldsFromGate(options.gate, options.effectivePassLatched);
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
      standingRecoveryFrameCount: squatDebug?.standingRecoveryFrameCount,
      standingRecoveryMinFramesUsed: squatDebug?.standingRecoveryMinFramesUsed,
      standingRecoveryMinHoldMsUsed: squatDebug?.standingRecoveryMinHoldMsUsed,
      standingRecoveryBand: squatDebug?.standingRecoveryBand ?? null,
      standingRecoveryFinalizeReason: squatDebug?.standingRecoveryFinalizeReason ?? null,
      successPhaseAtOpen: squatDebug?.successPhaseAtOpen ?? null,
      evidenceLabel: squatDebug?.evidenceLabel ?? null,
      completionBlockedReason: squatDebug?.completionBlockedReason ?? null,
      cycleDurationMs: squatDebug?.cycleDurationMs,
      squatCalibrationCompact: buildSquatCalibrationTraceCompact(
        options.gate.evaluatorResult?.debug?.squatCompletionState,
        options.gate.evaluatorResult?.debug?.squatHmm
      ),
      armCompact: buildSquatArmingAssistTraceCompact(options.gate.evaluatorResult?.debug?.squatCompletionArming),
      successUiCandidateAt: options.successUiCandidateAt ?? null,
      successUiSettledAt: options.successUiSettledAt ?? null,
      successUiSettleMsUsed:
        typeof options.successUiSettleMsUsed === 'number' ? options.successUiSettleMsUsed : null,
      successUiSettlePath: options.successUiSettlePath ?? null,
      ...mobileObs,
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
/** CAM-OBS: 모바일 링 버퍼 상한(과도한 localStorage 증가 방지) */
const MAX_FAILED_SHALLOW_SNAPSHOTS = 5;

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

/**
 * 얕은 스쿼트 관측 전용 — `hasSquatAttemptEvidence`보다 약함 (통과·freeze arming과 무관).
 * 실제 얕은 동작(descend/recovery 플래그, 다중 하강 프레임 등)이 있었는지 로컬 trace 저장 판단에만 사용.
 */
export function hasShallowSquatObservation(gate: ExerciseGateResult): boolean {
  if (gate.evaluatorResult?.stepId !== 'squat') return false;
  const sc = gate.squatCycleDebug;
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics as Record<string, unknown> | undefined;
  if (!sc && !hm) return false;

  const phase = (sc?.currentSquatPhase ?? hm?.currentSquatPhase) as string | undefined;
  const descendDetected = !!sc?.descendDetected;
  const recoveryDetected = !!sc?.recoveryDetected;
  const bottomDetected = !!sc?.bottomDetected;
  const descentCount = typeof hm?.descentCount === 'number' ? hm.descentCount : 0;
  const firstDescentIdx = typeof hm?.firstDescentIdx === 'number' ? hm.firstDescentIdx : -1;
  const relPeak = typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : 0;
  const rawPeak = typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : 0;
  const ascRec = typeof hm?.ascentRecovered === 'number' ? hm.ascentRecovered > 0 : false;
  const cmp = typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : '';

  if (descendDetected && recoveryDetected) return true;
  if (descendDetected && (ascRec || recoveryDetected)) return true;
  if (bottomDetected && (recoveryDetected || ascRec)) return true;
  if (descentCount >= 2) return true;
  if (firstDescentIdx >= 0 && (recoveryDetected || ascRec)) return true;

  if (
    cmp &&
    /descend|bottom|ascend|recovery/i.test(cmp) &&
    (descentCount >= 1 || firstDescentIdx >= 0 || descendDetected)
  ) {
    return true;
  }

  if ((relPeak >= 0.015 || rawPeak >= 0.02) && (descentCount >= 1 || descendDetected || firstDescentIdx >= 0)) {
    return true;
  }

  if (
    phase &&
    phase !== 'idle' &&
    phase !== 'armed' &&
    (descendDetected || descentCount >= 1)
  ) {
    return true;
  }

  return false;
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
  standingRecoveryFrameCount?: number;
  standingRecoveryMinFramesUsed?: number;
  standingRecoveryMinHoldMsUsed?: number;
  standingRecoveryBand?: string | null;
  standingRecoveryFinalizeReason?: string | null;
  successPhaseAtOpen?: string | null;
  evidenceLabel?: string | null;
  completionBlockedReason?: string | null;
  cycleDurationMs: number | undefined;
  guardrailPartialReason?: string | null;
  lowRomRecoveredReason?: string | null;
  ultraLowRomRecoveredReason?: string | null;
  diagVersion: string;
  /** CAM-OBS: 일반 retry/fail 경로에서 게이트 종료 유형 */
  attemptOutcome?: 'retry' | 'fail';
  gateStatus?: string;
  progressionState?: string;
  finalPassLatched?: boolean;
  confidence?: number;
  captureQuality?: string;
  failureReasons?: string[];
  flags?: string[];
  finalPassBlockedReason?: string | null;
  finalPassEligible?: boolean;
  depthBand?: string;
  romBand?: string;
  completionPassReason?: string | null;
  cycleProofPassed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  squatDescentToPeakMs?: number;
  squatReversalToStandingMs?: number;
  /** PR-HMM-03A: shallow 실패 캘리브레이션 스냅샷 (컴팩트) */
  squatCalibrationCompact?: SquatCalibrationTraceCompact;
  /** PR-HMM-04A */
  armCompact?: SquatArmingAssistTraceCompact;
  /** PR-04E2 */
  reversalConfirmedBy?: string | null;
  reversalDepthDrop?: number | null;
  reversalFrameCount?: number | null;
  /** PR-04E3A */
  relativeDepthPeakSource?: string | null;
  rawDepthPeakPrimary?: number | null;
  rawDepthPeakBlended?: number | null;
  /** PR-04E3B */
  baselineFrozen?: boolean;
  baselineFrozenDepth?: number | null;
  peakLatched?: boolean;
  peakLatchedAtIndex?: number | null;
  eventCycleDetected?: boolean;
  eventCycleBand?: string | null;
  eventCyclePromoted?: boolean;
  eventCycleSource?: string | null;
  /** PR-04E3C */
  reversalLiteConfirmed?: boolean;
  recoveryLiteConfirmed?: boolean;
  reversalLiteDrop?: number | null;
}

/** CAM-OBS: 실패 스냅샷 기록 옵션(진단 전용, pass 로직 무관) */
export interface RecordSquatFailedShallowOptions {
  failureOverlayArmed?: boolean;
  failureOverlayBlockedReason?: string | null;
  attemptOutcome?: 'retry' | 'fail';
  /** 페이지에서 isFinalPassLatched 결과를 넘겨 최종 래치 여부를 스냅샷에 남김 */
  finalPassLatched?: boolean;
}

export function recordSquatFailedShallowSnapshot(
  gate: ExerciseGateResult,
  options?: RecordSquatFailedShallowOptions
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

    const cs = gate.evaluatorResult?.debug?.squatCompletionState as
      | { squatDescentToPeakMs?: number; squatReversalToStandingMs?: number; completionPassReason?: string }
      | undefined;

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
      standingRecoveryFrameCount: sc?.standingRecoveryFrameCount,
      standingRecoveryMinFramesUsed: sc?.standingRecoveryMinFramesUsed,
      standingRecoveryMinHoldMsUsed: sc?.standingRecoveryMinHoldMsUsed,
      standingRecoveryBand: sc?.standingRecoveryBand ?? null,
      standingRecoveryFinalizeReason: sc?.standingRecoveryFinalizeReason ?? null,
      successPhaseAtOpen: sc?.successPhaseAtOpen ?? null,
      evidenceLabel: sc?.evidenceLabel ?? null,
      completionBlockedReason: sc?.completionBlockedReason ?? null,
      cycleDurationMs: sc?.cycleDurationMs,
      guardrailPartialReason: gate.guardrail.debug?.guardrailPartialReason ?? null,
      lowRomRecoveredReason: sc?.lowRomRejectionReason ?? (hm?.lowRomRecoveryReason as string) ?? null,
      ultraLowRomRecoveredReason: sc?.ultraLowRomRejectionReason ?? (hm?.ultraLowRomRecoveryReason as string) ?? null,
      diagVersion: CAMERA_DIAG_VERSION,
      attemptOutcome: options?.attemptOutcome ?? 'fail',
      gateStatus: gate.status,
      progressionState: gate.progressionState,
      finalPassLatched: options?.finalPassLatched,
      confidence: gate.confidence,
      captureQuality: gate.guardrail.captureQuality,
      failureReasons: [...gate.failureReasons],
      flags: [...gate.flags],
      finalPassBlockedReason: gate.finalPassBlockedReason,
      finalPassEligible: gate.finalPassEligible,
      depthBand: sc?.depthBand,
      romBand: sc?.romBand,
      completionPassReason: sc?.completionPassReason ?? cs?.completionPassReason ?? null,
      cycleProofPassed: sc?.cycleProofPassed,
      reversalConfirmedAfterDescend: sc?.reversalConfirmedAfterDescend,
      recoveryConfirmedAfterReversal: sc?.recoveryConfirmedAfterReversal,
      squatDescentToPeakMs: cs?.squatDescentToPeakMs,
      squatReversalToStandingMs: cs?.squatReversalToStandingMs,
      squatCalibrationCompact: buildSquatCalibrationTraceCompact(
        gate.evaluatorResult?.debug?.squatCompletionState,
        gate.evaluatorResult?.debug?.squatHmm
      ),
      armCompact: buildSquatArmingAssistTraceCompact(gate.evaluatorResult?.debug?.squatCompletionArming),
      reversalConfirmedBy: sc?.reversalConfirmedBy ?? null,
      reversalDepthDrop: sc?.reversalDepthDrop ?? null,
      reversalFrameCount: sc?.reversalFrameCount ?? null,
      relativeDepthPeakSource: sc?.relativeDepthPeakSource ?? null,
      rawDepthPeakPrimary: sc?.rawDepthPeakPrimary ?? null,
      rawDepthPeakBlended: sc?.rawDepthPeakBlended ?? null,
      baselineFrozen: sc?.baselineFrozen,
      baselineFrozenDepth: sc?.baselineFrozenDepth ?? null,
      peakLatched: sc?.peakLatched,
      peakLatchedAtIndex: sc?.peakLatchedAtIndex ?? null,
      eventCycleDetected: sc?.eventCycleDetected,
      eventCycleBand: sc?.eventCycleBand ?? null,
      eventCyclePromoted: sc?.eventCyclePromoted,
      eventCycleSource: sc?.eventCycleSource ?? null,
      reversalLiteConfirmed: sc?.reversalLiteConfirmed,
      recoveryLiteConfirmed: sc?.recoveryLiteConfirmed,
      reversalLiteDrop:
        typeof sc?.reversalLiteDrop === 'number' && Number.isFinite(sc.reversalLiteDrop)
          ? sc.reversalLiteDrop
          : null,
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

/** CAM-OBS: 성공·실패 스냅샷을 시간순으로 합쳐 모바일 진단 패널에 표시 */
export type SquatMobileDiagEntry =
  | { attemptType: 'success'; ts: string; payload: SquatSuccessSnapshot }
  | { attemptType: 'retry' | 'fail'; ts: string; payload: SquatFailedShallowSnapshot };

export function getSquatMobileDiagAttempts(maxEntries = 8): SquatMobileDiagEntry[] {
  const failures = getRecentFailedShallowSnapshots();
  const successes = getRecentSuccessSnapshots().filter(
    (s): s is SquatSuccessSnapshot => s.motionType === 'squat'
  );
  const entries: SquatMobileDiagEntry[] = [
    ...failures.map((p) => ({
      attemptType: (p.attemptOutcome === 'retry' ? 'retry' : 'fail') as 'retry' | 'fail',
      ts: p.ts,
      payload: p,
    })),
    ...successes.map((p) => ({ attemptType: 'success' as const, ts: p.ts, payload: p })),
  ];
  entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return entries.slice(-maxEntries);
}

export function getLatestSquatMobileDiagAttempt(): SquatMobileDiagEntry | null {
  const list = getSquatMobileDiagAttempts(64);
  return list.length > 0 ? list[list.length - 1]! : null;
}
