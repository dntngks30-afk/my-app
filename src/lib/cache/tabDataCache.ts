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
  | 'reset.recommendations'
  | 'journey.summary'
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

let activeLitePrefetchInflight: Promise<void> | null = null;
let lastActiveLitePrefetchAt = 0;
const PREFETCH_DEBOUNCE_MS = 2000;

/**
 * Prefetch shared active-lite data. Deduped by time + inflight.
 * Kept separate so a warm activeLite cache never suppresses Reset/Journey prefetch.
 */
function prefetchActiveLiteIfNeeded(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastActiveLitePrefetchAt < PREFETCH_DEBOUNCE_MS) return;
  if (getCache('home.activeLite')) return; // already warm
  if (activeLitePrefetchInflight) return; // already in flight

  activeLitePrefetchInflight = (async () => {
    try {
      const { getSessionSafe } = await import('@/lib/supabase');
      const { getCachedActiveSessionLite } = await import('@/lib/session/active-cache');
      const { session } = await getSessionSafe();
      if (session?.access_token) {
        await getCachedActiveSessionLite(session.access_token);
      }
    } catch {
      /* prefetch is best-effort */
    } finally {
      activeLitePrefetchInflight = null;
      lastActiveLitePrefetchAt = Date.now();
    }
  })();
}

/**
 * Prefetch tab data from BottomNav intent events.
 * Fire-and-forget; never blocks navigation.
 */
export function prefetchTabData(key: TabPrefetchKey): void {
  if (typeof window === 'undefined') return;

  prefetchActiveLiteIfNeeded();

  if (key === 'stats') {
    void import('@/lib/reset/recommendation-cache')
      .then((m) => m.prefetchResetRecommendations())
      .catch(() => {});
    return;
  }

  if (key === 'my') {
    void import('@/lib/journey/client')
      .then((m) => m.prefetchJourneySummary())
      .catch(() => {});
  }
}
