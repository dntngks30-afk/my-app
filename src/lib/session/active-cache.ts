/**
 * session/active 응답 캐시 — 탭 왕복 시 재요청 폭주 방지
 * TTL 5초, module-level. inflight dedupe로 동시 중복 호출 방지.
 * bootstrap: 홈 초기 진입 시 activeLite만 조회 (bootstrap-lite).
 */

import { setCache, invalidateCache, getCacheStale } from '@/lib/cache/tabDataCache';
import {
  getActiveSession,
  getHomeActiveLite,
  type ActiveSessionResponse,
  type ActiveSessionLiteResponse,
  type HomeActiveLiteResponse,
  type BootstrapResponse,
} from './client';

const TTL_MS = 5000;

interface CacheEntry {
  data: ActiveSessionResponse;
  expiresAt: number;
}

interface LiteCacheEntry {
  data: ActiveSessionLiteResponse;
  expiresAt: number;
}

let cache: { entry: CacheEntry; tokenKey: string } | null = null;
let inflight: Promise<{ ok: true; data: ActiveSessionResponse } | { ok: false; status: number; error: unknown }> | null = null;

let liteCache: { entry: LiteCacheEntry; tokenKey: string } | null = null;

let bootstrapCache: { entry: { data: BootstrapResponse; expiresAt: number }; tokenKey: string } | null = null;
let bootstrapInflight: Promise<{ ok: true; data: BootstrapResponse } | { ok: false; status: number; error: unknown }> | null = null;

function tokenKey(t: string): string {
  return t && t.length >= 16 ? t.slice(-16) : t || '';
}

/** Home/Stats/My 탭용 — home-lite owner 재사용. active-lite 대신 canonical bundle 단일 호출.
 * stale-while-revalidate: tabDataCache에 stale이 있으면 즉시 반환, 백그라운드 재검증 */
export async function getCachedActiveSessionLite(
  token: string,
  _opts?: { debug?: boolean }
): Promise<{ ok: true; data: ActiveSessionLiteResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (liteCache && liteCache.tokenKey === key && liteCache.entry.expiresAt > now) {
    return { ok: true, data: liteCache.entry.data };
  }
  const stale =
    getCacheStale<ActiveSessionLiteResponse>('home.activeLite') ??
    getCacheStale<{ activeLite: ActiveSessionLiteResponse }>('home.bootstrap')?.activeLite;
  if (stale) {
    void getCachedBootstrap(token).then(() => {
      /* background revalidate; bootstrap updates liteCache + tabDataCache */
    });
    return { ok: true as const, data: stale };
  }
  const result = await getCachedBootstrap(token);
  if (result.ok) return { ok: true, data: result.data.activeLite };
  return { ok: false, status: result.status, error: result.error };
}

/** 홈 초기 진입용 — canonical home-lite bundle 1회 조회, 캐시 공유.
 * stale-while-revalidate: tabDataCache에 stale이 있으면 즉시 반환, 백그라운드 재검증.
 * debug=true 시 캐시 우회하여 timing 정보 반환 (AT1). */
export async function getCachedHomeActiveLiteBundle(
  token: string,
  opts?: { debug?: boolean }
): Promise<{ ok: true; data: HomeActiveLiteResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (!opts?.debug && bootstrapCache && bootstrapCache.tokenKey === key && bootstrapCache.entry.expiresAt > now) {
    return { ok: true, data: bootstrapCache.entry.data };
  }
  if (!opts?.debug && bootstrapInflight) {
    return bootstrapInflight;
  }
  const stale = !opts?.debug ? getCacheStale<BootstrapResponse>('home.bootstrap') : null;
  if (stale) {
    const revalidate = getHomeActiveLite(token).then((result) => {
      bootstrapInflight = null;
      if (result.ok) {
        bootstrapCache = {
          tokenKey: key,
          entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
        };
        setCache('home.activeLite', result.data.activeLite);
        setCache('home.bootstrap', result.data);
        liteCache = { tokenKey: key, entry: { data: result.data.activeLite, expiresAt: Date.now() + TTL_MS } };
      }
      return result;
    });
    bootstrapInflight = revalidate;
    void revalidate;
    return { ok: true as const, data: stale };
  }
  const promise = getHomeActiveLite(token, opts).then((result) => {
    bootstrapInflight = null;
    if (result.ok) {
      bootstrapCache = {
        tokenKey: key,
        entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
      };
      setCache('home.activeLite', result.data.activeLite);
      setCache('home.bootstrap', result.data);
      liteCache = {
        tokenKey: key,
        entry: { data: result.data.activeLite, expiresAt: Date.now() + TTL_MS },
      };
    } else {
      bootstrapCache = null;
    }
    return result;
  });
  bootstrapInflight = promise;
  return promise;
}

export async function getCachedBootstrap(
  token: string,
  opts?: { debug?: boolean }
): Promise<{ ok: true; data: BootstrapResponse } | { ok: false; status: number; error: unknown }> {
  return getCachedHomeActiveLiteBundle(token, opts);
}

export async function getCachedActiveSession(
  token: string
): Promise<{ ok: true; data: ActiveSessionResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (cache && cache.tokenKey === key && cache.entry.expiresAt > now) {
    return { ok: true, data: cache.entry.data };
  }
  if (inflight) {
    return inflight;
  }
  const promise = getActiveSession(token).then((result) => {
    inflight = null;
    if (result.ok) {
      cache = {
        tokenKey: key,
        entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
      };
    } else {
      cache = null;
    }
    return result;
  });
  inflight = promise;
  return promise;
}

export function invalidateActiveCache(): void {
  cache = null;
  liteCache = null;
  bootstrapCache = null;
  bootstrapInflight = null;
  invalidateCache('home.activeLite');
  invalidateCache('home.bootstrap');
  invalidateCache('home.progressReport');
}
