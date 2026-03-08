/**
 * session/active 응답 캐시 — 탭 왕복 시 재요청 폭주 방지
 * TTL 5초, module-level. inflight dedupe로 동시 중복 호출 방지.
 * bootstrap: 홈 초기 진입 시 activeLite + progressReport 1회 조회.
 */

import { setCache, invalidateCache, getCacheStale } from '@/lib/cache/tabDataCache';
import {
  getActiveSession,
  getActiveSessionLite,
  getBootstrap,
  type ActiveSessionResponse,
  type ActiveSessionLiteResponse,
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
let liteInflight: Promise<{ ok: true; data: ActiveSessionLiteResponse } | { ok: false; status: number; error: unknown }> | null = null;

let bootstrapCache: { entry: { data: BootstrapResponse; expiresAt: number }; tokenKey: string } | null = null;
let bootstrapInflight: Promise<{ ok: true; data: BootstrapResponse } | { ok: false; status: number; error: unknown }> | null = null;

function tokenKey(t: string): string {
  return t && t.length >= 16 ? t.slice(-16) : t || '';
}

/** Home 초기 로드용 — active-lite 캐시 (plan_json 제외, 경량)
 * stale-while-revalidate: tabDataCache에 stale이 있으면 즉시 반환, 백그라운드 재검증 */
export async function getCachedActiveSessionLite(
  token: string,
  opts?: { debug?: boolean }
): Promise<{ ok: true; data: ActiveSessionLiteResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (!opts?.debug && liteCache && liteCache.tokenKey === key && liteCache.entry.expiresAt > now) {
    return { ok: true, data: liteCache.entry.data };
  }
  if (liteInflight) {
    return liteInflight;
  }
  const stale = getCacheStale<ActiveSessionLiteResponse>('home.activeLite');
  if (stale) {
    liteInflight = Promise.resolve({ ok: true as const, data: stale });
    void getActiveSessionLite(token, opts).then((result) => {
      liteInflight = null;
      if (result.ok) {
        liteCache = { tokenKey: key, entry: { data: result.data, expiresAt: Date.now() + TTL_MS } };
        setCache('home.activeLite', result.data);
      }
    });
    return liteInflight;
  }
  const promise = getActiveSessionLite(token, opts).then((result) => {
    liteInflight = null;
    if (result.ok) {
      liteCache = {
        tokenKey: key,
        entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
      };
      setCache('home.activeLite', result.data);
    } else {
      liteCache = null;
    }
    return result;
  });
  liteInflight = promise;
  return promise;
}

/** 홈 초기 진입용 — bootstrap (activeLite + progressReport) 1회 조회, 캐시 공유 */
export async function getCachedBootstrap(
  token: string
): Promise<{ ok: true; data: BootstrapResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (bootstrapCache && bootstrapCache.tokenKey === key && bootstrapCache.entry.expiresAt > now) {
    return { ok: true, data: bootstrapCache.entry.data };
  }
  if (bootstrapInflight) {
    return bootstrapInflight;
  }
  const promise = getBootstrap(token).then((result) => {
    bootstrapInflight = null;
    if (result.ok) {
      bootstrapCache = {
        tokenKey: key,
        entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
      };
      setCache('home.activeLite', result.data.activeLite);
      setCache('home.bootstrap', result.data);
      if (result.data.progressReport) setCache('home.progressReport', result.data.progressReport);
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
  invalidateCache('home.activeLite');
  invalidateCache('home.bootstrap');
  invalidateCache('home.progressReport');
}
