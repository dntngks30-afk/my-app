import type {
  AttemptSnapshot,
  OverheadAttemptObservation,
  SquatAttemptObservation,
} from '../camera-trace';

export const TRACE_STORAGE_KEY = 'moveReCameraTrace:v1';
export const OBSERVATION_STORAGE_KEY = 'moveReCameraSquatObservation:v1';
export const OVERHEAD_OBSERVATION_STORAGE_KEY = 'moveReCameraOverheadObservation:v1';

const MAX_ATTEMPTS = 50;
const MAX_SQUAT_OBSERVATIONS = 80;
const MAX_OVERHEAD_OBSERVATIONS = 80;
const TRACE_BUNDLE_STORAGE_KEY = 'moveReCameraTraceBundle:v1';

/** PR-CAM-OBS-FLUSH-HARDEN-01: LS 실패/레이스 시에도 terminal bundle이 비지 않도록 보조(LS가 정본) */
let lastKnownSquatObservationsCache: SquatAttemptObservation[] = [];
let lastKnownOverheadObservationsCache: OverheadAttemptObservation[] = [];

/** 브라우저·Node 스모크 공통 — `window` 없이 globalThis.localStorage만 있는 환경 지원 */
export function getObservationStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') return ls;
  } catch {
    /* ignore */
  }
  return null;
}

export function pushStoredAttemptSnapshot(snapshot: AttemptSnapshot): void {
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

export function getStoredRecentAttempts(): AttemptSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttemptSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function pushStoredSquatObservation(
  obs: SquatAttemptObservation,
  observationDedupSkip: (list: SquatAttemptObservation[], next: SquatAttemptObservation) => boolean
): void {
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    const list: SquatAttemptObservation[] = raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
    if (observationDedupSkip(list, obs)) return;
    list.push(obs);
    const trimmed = list.slice(-MAX_SQUAT_OBSERVATIONS);
    lastKnownSquatObservationsCache = trimmed.slice();
    try {
      ls.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* LS 쓰기 실패 — 캐시는 이미 최신 목록 */
    }
  } catch {
    try {
      const list = [...lastKnownSquatObservationsCache];
      if (observationDedupSkip(list, obs)) return;
      list.push(obs);
      lastKnownSquatObservationsCache = list.slice(-MAX_SQUAT_OBSERVATIONS);
    } catch {
      // ignore
    }
  }
}

export function getStoredRecentSquatObservations(): SquatAttemptObservation[] {
  const ls = getObservationStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
  } catch {
    return [];
  }
}

export function getStoredRecentSquatObservationsSnapshot(): SquatAttemptObservation[] {
  let fromLs: SquatAttemptObservation[] = [];
  let readOk = false;
  try {
    const ls = getObservationStorage();
    if (!ls) {
      return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
    }
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    fromLs = raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
    readOk = true;
  } catch {
    fromLs = [];
  }
  if (!readOk) {
    return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
  }
  if (lastKnownSquatObservationsCache.length > fromLs.length) {
    return lastKnownSquatObservationsCache.slice();
  }
  if (fromLs.length > 0) return fromLs;
  return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
}

export function clearStoredSquatObservations(): void {
  lastKnownSquatObservationsCache = [];
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    ls.removeItem(OBSERVATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function pushStoredOverheadObservation(
  obs: OverheadAttemptObservation,
  overheadObservationDedupSkip: (
    list: OverheadAttemptObservation[],
    next: OverheadAttemptObservation
  ) => boolean
): void {
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(OVERHEAD_OBSERVATION_STORAGE_KEY);
    const list: OverheadAttemptObservation[] = raw ? (JSON.parse(raw) as OverheadAttemptObservation[]) : [];
    if (overheadObservationDedupSkip(list, obs)) return;
    list.push(obs);
    const trimmed = list.slice(-MAX_OVERHEAD_OBSERVATIONS);
    lastKnownOverheadObservationsCache = trimmed.slice();
    try {
      ls.setItem(OVERHEAD_OBSERVATION_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* LS 쓰기 실패 */
    }
  } catch {
    try {
      const list = [...lastKnownOverheadObservationsCache];
      if (overheadObservationDedupSkip(list, obs)) return;
      list.push(obs);
      lastKnownOverheadObservationsCache = list.slice(-MAX_OVERHEAD_OBSERVATIONS);
    } catch {
      // ignore
    }
  }
}

export function getStoredRecentOverheadObservations(): OverheadAttemptObservation[] {
  const ls = getObservationStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(OVERHEAD_OBSERVATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OverheadAttemptObservation[]) : [];
  } catch {
    return [];
  }
}

export function clearStoredOverheadObservations(): void {
  lastKnownOverheadObservationsCache = [];
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    ls.removeItem(OVERHEAD_OBSERVATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function clearStoredCameraTraceData(): void {
  lastKnownSquatObservationsCache = [];
  lastKnownOverheadObservationsCache = [];
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    ls.removeItem(TRACE_STORAGE_KEY);
    ls.removeItem(OBSERVATION_STORAGE_KEY);
    ls.removeItem(OVERHEAD_OBSERVATION_STORAGE_KEY);
    ls.removeItem(TRACE_BUNDLE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
