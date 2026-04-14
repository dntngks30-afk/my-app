/**
 * PR-CAM-SNAPSHOT-BUNDLE-01: 한 번의 촬영 시도를 단일 JSON 번들로 묶어 localStorage에 보관.
 * PR-CAM-OBS-NORMALIZE-01: owner/depth truth 계층을 normalized summary·힌트로 구분(산식·값 조작 없음).
 * raw frame/landmark/video 없음 — 기존 AttemptSnapshot·SquatAttemptObservation 만 사용.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import type { ExerciseGateResult } from './auto-progression';
import {
  buildAttemptSnapshot,
  type AttemptSnapshot,
  type ObservationTruthStage,
  type SquatAttemptObservation,
  computeObservationTruthFields,
  getRecentSquatObservationsSnapshot,
} from './camera-trace';
import { CAMERA_DIAG_VERSION } from './camera-success-diagnostic';
import {
  buildSquatResultSeveritySummary,
  type SquatResultSeveritySummary,
} from './squat-result-severity';

export const BUNDLE_STORAGE_KEY = 'moveReCameraTraceBundle:v1';
export const MAX_CAPTURE_SESSION_BUNDLES = 20;

const BUNDLE_DEBUG_PREFIX = 'cam-snapshot-bundle-01';

/** PR-CAM-OBS-NORMALIZE-01: 동일 스냅샷 내 서로 다른 truth 계층을 이름으로 분리(재계산 없음) */
export interface SquatNormalizedTruthSummary {
  ownerTruth: {
    completionPassReason: string | null;
    completionPathUsed: string | null;
    passOwner: string | null;
    finalSuccessOwner: string | null;
    standardOwnerEligible: boolean | null;
    shadowEventOwnerEligible: boolean | null;
  };
  completionDepthTruth: {
    relativeDepthPeak: number | null;
    rawDepthPeak: number | null;
    relativeDepthPeakSource: string | null;
    baselineFrozen: boolean | null;
    baselineFrozenDepth: number | null;
    eventCycleDetected: boolean | null;
    eventCyclePromoted: boolean | null;
    eventCycleBand: string | null;
    eventCycleSource: string | null;
  };
  evaluatorDepthTruth: {
    peakDepthMetric: number | null;
    depthBand: string | null;
    romBand: string | null;
    squatDepthPeakPrimary: number | null;
    squatDepthPeakBlended: number | null;
    rawDepthPeakPrimary: number | null;
    rawDepthPeakBlended: number | null;
  };
  cycleTruth: {
    currentSquatPhase: string | null;
    descendConfirmed: boolean | null;
    ascendConfirmed: boolean | null;
    reversalConfirmedAfterDescend: boolean | null;
    recoveryConfirmedAfterReversal: boolean | null;
    passBlockedReason: string | null;
    completionBlockedReason: string | null;
    standardPathBlockedReason: string | null;
  };
}

export type CaptureSessionTerminalKind =
  | 'success'
  | 'retry_required'
  | 'retry_optional'
  | 'invalid'
  | 'failed'
  | 'abandoned';

export interface CaptureSessionBundleSummary {
  completionPassReason?: string | null;
  completionPathUsed?: string | null;
  passOwner?: string | null;
  finalSuccessOwner?: string | null;
  captureQuality?: string | null;
  confidence?: number | null;
  relativeDepthPeak?: number | null;
  rawDepthPeak?: number | null;
  depthBand?: string | null;
  romBand?: string | null;
  passBlockedReason?: string | null;
  completionBlockedReason?: string | null;
  standardPathBlockedReason?: string | null;
  eventCycleDetected?: boolean;
  eventCyclePromoted?: boolean;
  eventCycleSource?: string | null;
  normalized?: SquatNormalizedTruthSummary | null;
  interpretationHints?: string[];
  /** PR-CAM-OBS-FLUSH-HARDEN-01: bundle.observations 길이 힌트(모바일에서 비어 있음 빠르게 확인) */
  observationCount?: number;
  /** PR-CAM-OBS-TRUTH-STAGE-01: 터미널 번들 요약에서도 blocked reason 해석 단계(관측과 동일 의미) */
  observationTruthStage?: ObservationTruthStage;
  completionBlockedReasonAuthoritative?: boolean;
  /** PR-CAM-SQUAT-RESULT-SEVERITY-01: 통과·품질 truth 기반 severity(엔진 변경 없음) */
  resultSeverity?: SquatResultSeveritySummary;
}

export interface CaptureSessionBundle {
  id: string;
  createdAt: string;
  endedAt?: string;
  route: string | null;
  motionType: 'squat' | 'overhead_reach';
  terminalKind?: CaptureSessionTerminalKind;
  latestAttempt?: AttemptSnapshot;
  observations: SquatAttemptObservation[];
  summary: CaptureSessionBundleSummary;
  debugVersion: string;
}

function newBundleId(): string {
  return `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SquatCycleSnap = NonNullable<NonNullable<AttemptSnapshot['diagnosisSummary']>['squatCycle']>;

function buildSquatNormalizedTruthFromCycle(sq: SquatCycleSnap): SquatNormalizedTruthSummary {
  return {
    ownerTruth: {
      completionPassReason: sq.completionPassReason ?? null,
      completionPathUsed: sq.completionPathUsed ?? null,
      passOwner: sq.passOwner ?? null,
      finalSuccessOwner: sq.finalSuccessOwner ?? null,
      standardOwnerEligible: typeof sq.standardOwnerEligible === 'boolean' ? sq.standardOwnerEligible : null,
      shadowEventOwnerEligible:
        typeof sq.shadowEventOwnerEligible === 'boolean' ? sq.shadowEventOwnerEligible : null,
    },
    completionDepthTruth: {
      relativeDepthPeak: typeof sq.relativeDepthPeak === 'number' ? sq.relativeDepthPeak : null,
      rawDepthPeak: typeof sq.rawDepthPeak === 'number' ? sq.rawDepthPeak : null,
      relativeDepthPeakSource: sq.relativeDepthPeakSource ?? null,
      baselineFrozen: typeof sq.baselineFrozen === 'boolean' ? sq.baselineFrozen : null,
      baselineFrozenDepth: typeof sq.baselineFrozenDepth === 'number' ? sq.baselineFrozenDepth : null,
      eventCycleDetected: typeof sq.eventCycleDetected === 'boolean' ? sq.eventCycleDetected : null,
      eventCyclePromoted: typeof sq.eventCyclePromoted === 'boolean' ? sq.eventCyclePromoted : null,
      eventCycleBand: sq.eventCycleBand ?? null,
      eventCycleSource: sq.eventCycleSource ?? null,
    },
    evaluatorDepthTruth: {
      peakDepthMetric: typeof sq.peakDepth === 'number' ? sq.peakDepth : null,
      depthBand: sq.depthBand ?? null,
      romBand: sq.romBand ?? null,
      squatDepthPeakPrimary: typeof sq.squatDepthPeakPrimary === 'number' ? sq.squatDepthPeakPrimary : null,
      squatDepthPeakBlended: typeof sq.squatDepthPeakBlended === 'number' ? sq.squatDepthPeakBlended : null,
      rawDepthPeakPrimary: typeof sq.rawDepthPeakPrimary === 'number' ? sq.rawDepthPeakPrimary : null,
      rawDepthPeakBlended: typeof sq.rawDepthPeakBlended === 'number' ? sq.rawDepthPeakBlended : null,
    },
    cycleTruth: {
      currentSquatPhase: sq.currentSquatPhase ?? null,
      descendConfirmed: typeof sq.descendConfirmed === 'boolean' ? sq.descendConfirmed : null,
      ascendConfirmed: typeof sq.ascendConfirmed === 'boolean' ? sq.ascendConfirmed : null,
      reversalConfirmedAfterDescend:
        typeof sq.reversalConfirmedAfterDescend === 'boolean' ? sq.reversalConfirmedAfterDescend : null,
      recoveryConfirmedAfterReversal:
        typeof sq.recoveryConfirmedAfterReversal === 'boolean' ? sq.recoveryConfirmedAfterReversal : null,
      passBlockedReason: sq.passBlockedReason ?? null,
      completionBlockedReason: sq.completionBlockedReason ?? null,
      standardPathBlockedReason: sq.standardPathBlockedReason ?? null,
    },
  };
}

/**
 * flat·normalized 필드 조합만으로 짧은 해석 문장 생성(새 산식·덮어쓰기 없음).
 */
export function buildSquatInterpretationHints(summary: CaptureSessionBundleSummary): string[] {
  const hints: string[] = [];
  const n = summary.normalized;
  const o = n?.ownerTruth;
  const ed = n?.evaluatorDepthTruth;
  const cd = n?.completionDepthTruth;

  if (o?.completionPassReason) {
    const ownerLine =
      o.finalSuccessOwner != null
        ? `owner는 completion relative depth·event 계층 기준으로 completionPassReason="${o.completionPassReason}", finalSuccessOwner="${o.finalSuccessOwner}"로 기록됨`
        : `completionPassReason="${o.completionPassReason}"는 completion_state 계층의 통과 사유 필드임`;
    hints.push(ownerLine);
  }

  if (ed?.peakDepthMetric != null || ed?.depthBand) {
    hints.push(
      'peakDepth·depthBand·romBand(및 squatDepthPeak*)는 evaluator depth metric 계층이며, owner/통과 사유와 숫자가 어긋날 수 있음(서로 다른 truth 표면)'
    );
  }

  if (cd?.relativeDepthPeak != null || cd?.relativeDepthPeakSource) {
    hints.push(
      'relativeDepthPeak·relativeDepthPeakSource·rawDepthPeak(스냅샷 상단 completion 블록)는 completion relative depth truth 계층임'
    );
  }

  if (cd?.eventCyclePromoted === true && o?.finalSuccessOwner) {
    hints.push(
      `eventCyclePromoted=true이면 event owner 경로가 반영된 상태이며, finalSuccessOwner="${o.finalSuccessOwner}"와 함께 읽을 것`
    );
  }

  if (summary.completionPathUsed && o?.completionPassReason) {
    hints.push(
      `completionPathUsed="${summary.completionPathUsed}"는 경로 라벨이며, depthBand/romBand의 "deep" 등과 항상 같은 의미가 아님`
    );
  }

  return hints.slice(0, 5);
}

/** diagnosisSummary.squatCycle + 스냅샷 상단 필드에서 summary 추출(observation 불필요) */
export function extractCaptureSessionSummaryFromAttempt(
  attempt: AttemptSnapshot | undefined
): CaptureSessionBundleSummary {
  if (!attempt?.diagnosisSummary) {
    return {};
  }
  const d = attempt.diagnosisSummary;
  const sq = d.squatCycle;
  const flat: CaptureSessionBundleSummary = {
    completionPassReason: sq?.completionPassReason ?? null,
    completionPathUsed: sq?.completionPathUsed ?? null,
    passOwner: sq?.passOwner ?? null,
    finalSuccessOwner: sq?.finalSuccessOwner ?? null,
    captureQuality: d.captureQuality ?? null,
    confidence: typeof attempt.confidence === 'number' ? attempt.confidence : null,
    relativeDepthPeak: typeof sq?.relativeDepthPeak === 'number' ? sq.relativeDepthPeak : null,
    rawDepthPeak: typeof sq?.rawDepthPeak === 'number' ? sq.rawDepthPeak : null,
    depthBand: sq?.depthBand ?? null,
    romBand: sq?.romBand ?? null,
    passBlockedReason: sq?.passBlockedReason ?? null,
    completionBlockedReason: sq?.completionBlockedReason ?? null,
    standardPathBlockedReason: sq?.standardPathBlockedReason ?? null,
    eventCycleDetected: sq?.eventCycleDetected,
    eventCyclePromoted: sq?.eventCyclePromoted,
    eventCycleSource: sq?.eventCycleSource ?? null,
  };

  if (attempt.movementType !== 'squat' || !sq) {
    return { ...flat, normalized: null, interpretationHints: [] };
  }

  const normalized = buildSquatNormalizedTruthFromCycle(sq);
  // PR-C: read canonical `finalPassGranted` from diagnosis first; deprecated alias for older snapshots.
  const bundleFinalPassGranted =
    typeof sq.finalPassGranted === 'boolean'
      ? sq.finalPassGranted
      : typeof sq.finalPassGrantedForSemantics === 'boolean'
        ? sq.finalPassGrantedForSemantics
        : undefined;
  const resultSeverity = buildSquatResultSeveritySummary({
    finalPassGranted: bundleFinalPassGranted,
    completionTruthPassed: sq.completionTruthPassed === true,
    captureQuality: String(d.captureQuality ?? ''),
    qualityOnlyWarnings: sq.qualityOnlyWarnings,
    qualityTier: sq.squatInternalQuality?.qualityTier ?? null,
    limitations: sq.squatInternalQuality?.limitations,
  });
  const withNorm: CaptureSessionBundleSummary = { ...flat, normalized, resultSeverity };
  return {
    ...withNorm,
    interpretationHints: buildSquatInterpretationHints(withNorm),
  };
}

const OBSERVATION_WINDOW_MS = 90_000;

/**
 * PR-CAM-OBS-TRUTH-STAGE-01: 번들 summary용 truth 메타(판정·blocked 문자열 불변).
 * 터미널 관측 우선; 구버전 관측(필드 없음)은 동일 규칙으로 재계산.
 */
function pickBundleObservationTruthSummary(
  filtered: SquatAttemptObservation[],
  attempt: AttemptSnapshot | undefined,
  motionType: 'squat' | 'overhead_reach'
): Pick<CaptureSessionBundleSummary, 'observationTruthStage' | 'completionBlockedReasonAuthoritative'> {
  if (motionType !== 'squat') return {};

  const terminalObs = [...filtered].reverse().find((o) => o.eventType === 'capture_session_terminal');
  if (terminalObs) {
    if (
      terminalObs.observationTruthStage != null &&
      typeof terminalObs.completionBlockedReasonAuthoritative === 'boolean'
    ) {
      return {
        observationTruthStage: terminalObs.observationTruthStage,
        completionBlockedReasonAuthoritative: terminalObs.completionBlockedReasonAuthoritative,
      };
    }
    return computeObservationTruthFields({
      eventType: 'capture_session_terminal',
      attemptStarted: terminalObs.attemptStarted === true,
      baselineFrozen: terminalObs.baselineFrozen === true,
    });
  }

  const last = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
  if (last) {
    if (
      last.observationTruthStage != null &&
      typeof last.completionBlockedReasonAuthoritative === 'boolean'
    ) {
      return {
        observationTruthStage: last.observationTruthStage,
        completionBlockedReasonAuthoritative: last.completionBlockedReasonAuthoritative,
      };
    }
    return computeObservationTruthFields({
      eventType: last.eventType,
      attemptStarted: last.attemptStarted === true,
      baselineFrozen: last.baselineFrozen === true,
    });
  }

  const sq = attempt?.diagnosisSummary?.squatCycle;
  return computeObservationTruthFields({
    eventType: 'capture_session_terminal',
    attemptStarted: sq?.attemptStarted === true,
    baselineFrozen: sq?.baselineFrozen === true,
  });
}

/**
 * 터미널 스냅샷 시각 기준으로 같은 squat 관측만 보수적으로 포함.
 */
export function filterObservationsForBundle(
  terminalIso: string,
  observations: SquatAttemptObservation[]
): SquatAttemptObservation[] {
  const terminalMs = Date.parse(terminalIso);
  if (Number.isNaN(terminalMs)) return [];
  const minMs = terminalMs - OBSERVATION_WINDOW_MS;
  return observations.filter((o) => {
    if (o.movementType !== 'squat') return false;
    const t = Date.parse(o.ts);
    if (Number.isNaN(t)) return false;
    if (t > terminalMs) return false;
    if (t < minMs) return false;
    return true;
  });
}

export function buildCaptureSessionBundle(input: {
  latestAttempt: AttemptSnapshot | undefined;
  observations: SquatAttemptObservation[];
  route: string | null;
  motionType: 'squat' | 'overhead_reach';
  terminalKind: CaptureSessionTerminalKind;
  endedAt?: string;
}): CaptureSessionBundle {
  const createdAt = new Date().toISOString();
  const terminalTs = input.latestAttempt?.ts ?? createdAt;
  const filtered = filterObservationsForBundle(terminalTs, input.observations);
  const baseSummary = extractCaptureSessionSummaryFromAttempt(input.latestAttempt);
  const truthSummary = pickBundleObservationTruthSummary(filtered, input.latestAttempt, input.motionType);
  return {
    id: newBundleId(),
    createdAt,
    endedAt: input.endedAt ?? createdAt,
    route: input.route,
    motionType: input.motionType,
    terminalKind: input.terminalKind,
    latestAttempt: input.latestAttempt,
    observations: filtered,
    summary: { ...baseSummary, observationCount: filtered.length, ...truthSummary },
    debugVersion: `${BUNDLE_DEBUG_PREFIX}:${CAMERA_DIAG_VERSION}`,
  };
}

export function serializeCaptureSessionBundle(bundle: CaptureSessionBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function pushCaptureSessionBundle(bundle: CaptureSessionBundle): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BUNDLE_STORAGE_KEY);
    const list: CaptureSessionBundle[] = raw ? (JSON.parse(raw) as CaptureSessionBundle[]) : [];
    list.push(bundle);
    const trimmed = list.slice(-MAX_CAPTURE_SESSION_BUNDLES);
    localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function getRecentCaptureSessionBundles(): CaptureSessionBundle[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BUNDLE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CaptureSessionBundle[]) : [];
  } catch {
    return [];
  }
}

export function getLatestCaptureSessionBundle(): CaptureSessionBundle | null {
  const list = getRecentCaptureSessionBundles();
  return list.length > 0 ? list[list.length - 1]! : null;
}

export function clearCaptureSessionBundles(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BUNDLE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type CopyLatestBundleResult = { ok: true; json: string } | { ok: false; json: string; reason: string };

/**
 * 최신 번들 JSON을 클립보드에 복사(가능 시). 항상 json 문자열은 반환.
 */
export async function copyLatestCaptureSessionBundleJson(): Promise<CopyLatestBundleResult> {
  const latest = getLatestCaptureSessionBundle();
  const json = latest != null ? serializeCaptureSessionBundle(latest) : '';
  if (!latest) {
    return { ok: false, json: '', reason: 'no_bundle' };
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(json);
      return { ok: true, json };
    } catch {
      return { ok: false, json, reason: 'clipboard_denied' };
    }
  }
  return { ok: false, json, reason: 'no_clipboard_api' };
}

/** gate + 터미널 종류로 스냅샷 1건 생성 후 번들 푸시 */
export function recordCaptureSessionTerminalBundle(input: {
  stepId: CameraStepId;
  gate: ExerciseGateResult;
  context?: AttemptSnapshot['readinessSummary'];
  options?: Parameters<typeof buildAttemptSnapshot>[3];
  route: string | null;
  terminalKind: CaptureSessionTerminalKind;
}): void {
  try {
    const latestAttempt =
      buildAttemptSnapshot(input.stepId, input.gate, input.context, input.options) ?? undefined;
    const motionType = input.stepId === 'squat' ? 'squat' : 'overhead_reach';
    const observations =
      input.stepId === 'squat' ? getRecentSquatObservationsSnapshot() : ([] as SquatAttemptObservation[]);
    const bundle = buildCaptureSessionBundle({
      latestAttempt,
      observations,
      route: input.route,
      motionType,
      terminalKind: input.terminalKind,
    });
    pushCaptureSessionBundle(bundle);
  } catch {
    // non-blocking
  }
}

/** 터미널 gate 상태 → 번들 terminalKind (판정 로직 변경 없음·라벨만) */
export function squatTerminalKindFromGate(gate: ExerciseGateResult): CaptureSessionTerminalKind {
  if (gate.guardrail.captureQuality === 'invalid') return 'invalid';
  if (gate.progressionState === 'insufficient_signal') return 'invalid';
  if (gate.progressionState === 'failed') return 'failed';
  if (gate.progressionState === 'retry_required') return 'retry_required';
  if (gate.status === 'fail') return 'failed';
  if (gate.status === 'retry') return 'retry_optional';
  return 'retry_optional';
}
