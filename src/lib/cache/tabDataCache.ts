/**
 * 탭 전환 시 즉시 렌더용 경량 인메모리 캐시
 * stale-while-revalidate: 캐시 있으면 즉시 표시, 백그라운드 재검증
 */

const TTL_MS = 60_000;

type CacheKey =
  | 'app.bootstrap'
  | 'home.activeLite'
  | 'home.bootstrap'
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

/** TTL 내 fresh 여부 (탭 재방문 시 revalidate 판단용) */
export function isFresh(key: CacheKey): boolean {
  const entry = store[key] as Entry<unknown> | undefined;
  return !!entry && entry.expiresAt > Date.now();
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

/** Tab prefetch key — stats/my share activeLite */
export type TabPrefetchKey = 'stats' | 'my';

let prefetchInflight: Promise<void> | null = null;
let lastPrefetchAt = 0;
const PREFETCH_DEBOUNCE_MS = 2000;

/**
 * Prefetch tab data (stats/my share activeLite). Deduped by time + inflight.
 * Fire-and-forget. Call from BottomNav on pointer/touch/focus.
 */
export function prefetchTabData(_key: TabPrefetchKey): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastPrefetchAt < PREFETCH_DEBOUNCE_MS) return;
  if (getCache('home.activeLite')) return; // already warm
  if (prefetchInflight) return; // already in flight

  prefetchInflight = (async () => {
    try {
      const { getSessionSafe } = await import('@/lib/supabase');
      const { getCachedActiveSessionLite } = await import('@/lib/session/active-cache');
      const { session } = await getSessionSafe();
      if (session?.access_token) {
        await getCachedActiveSessionLite(session.access_token);
      }
    } finally {
      prefetchInflight = null;
      lastPrefetchAt = Date.now();
    }
  })();
}
