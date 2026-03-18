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
  topEntryAtMs: number | undefined;
  stableTopEntryAtMs: number | undefined;
  holdSatisfiedAtMs: number | undefined;
  successTriggeredAtMs: number;
}

export interface SquatSuccessSnapshot extends SuccessSnapshotBase {
  motionType: 'squat';
  evaluatorDepthPeak: number | null;
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
  descendStartAtMs: number | undefined;
  reversalAtMs: number | undefined;
  recoveryAtMs: number | undefined;
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
      topEntryAtMs: typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined,
      stableTopEntryAtMs: typeof hm?.stableTopEntryAtMs === 'number' ? hm.stableTopEntryAtMs : undefined,
      holdSatisfiedAtMs: typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined,
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
      descendStartAtMs: squatDebug?.descendStartAtMs,
      reversalAtMs: squatDebug?.reversalAtMs,
      recoveryAtMs: squatDebug?.recoveryAtMs,
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
