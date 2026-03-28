/**
 * PR-CAM-SNAPSHOT-BUNDLE-01: 한 번의 촬영 시도를 단일 JSON 번들로 묶어 localStorage에 보관.
 * raw frame/landmark/video 없음 — 기존 AttemptSnapshot·SquatAttemptObservation 만 사용.
 */
import type { CameraStepId } from '@/lib/public/camera-test';
import type { ExerciseGateResult } from './auto-progression';
import {
  buildAttemptSnapshot,
  type AttemptSnapshot,
  type SquatAttemptObservation,
  getRecentSquatObservations,
} from './camera-trace';
import { CAMERA_DIAG_VERSION } from './camera-success-diagnostic';

export const BUNDLE_STORAGE_KEY = 'moveReCameraTraceBundle:v1';
export const MAX_CAPTURE_SESSION_BUNDLES = 20;

const BUNDLE_DEBUG_PREFIX = 'cam-snapshot-bundle-01';

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

/** diagnosisSummary.squatCycle + 스냅샷 상단 필드에서 summary 추출 */
export function extractCaptureSessionSummaryFromAttempt(
  attempt: AttemptSnapshot | undefined
): CaptureSessionBundleSummary {
  if (!attempt?.diagnosisSummary) {
    return {};
  }
  const d = attempt.diagnosisSummary;
  const sq = d.squatCycle;
  return {
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
}

const OBSERVATION_WINDOW_MS = 90_000;

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
  return {
    id: newBundleId(),
    createdAt,
    endedAt: input.endedAt ?? createdAt,
    route: input.route,
    motionType: input.motionType,
    terminalKind: input.terminalKind,
    latestAttempt: input.latestAttempt,
    observations: filtered,
    summary: extractCaptureSessionSummaryFromAttempt(input.latestAttempt),
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
      input.stepId === 'squat' ? getRecentSquatObservations() : ([] as SquatAttemptObservation[]);
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
