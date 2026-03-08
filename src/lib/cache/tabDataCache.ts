/**
 * 탭 전환 시 즉시 렌더용 경량 인메모리 캐시
 * stale-while-revalidate: 캐시 있으면 즉시 표시, 백그라운드 재검증
 */

const TTL_MS = 60_000;

type CacheKey =
  | 'home.activeLite'
  | 'home.progressReport'
  | 'stats.weekly'
  | 'stats.history';

interface Entry<T> {
  data: T;
  expiresAt: number;
}

const store: Partial<Record<CacheKey, Entry<unknown>>> = {};

export function getCache<T>(key: CacheKey): T | null {
  const entry = store[key] as Entry<T> | undefined;
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.data;
}

/** Stale-while-revalidate: 만료된 캐시도 반환 (탭 재방문 시 즉시 표시용) */
export function getCacheStale<T>(key: CacheKey): T | null {
  const entry = store[key] as Entry<T> | undefined;
  if (!entry) return null;
  return entry.data;
}

export function setCache<T>(key: CacheKey, data: T): void {
  store[key] = {
    data,
    expiresAt: Date.now() + TTL_MS,
  };
}

export function invalidateCache(key?: CacheKey): void {
  if (key) {
    delete store[key];
  } else {
    (Object.keys(store) as CacheKey[]).forEach((k) => delete store[k]);
  }
}
