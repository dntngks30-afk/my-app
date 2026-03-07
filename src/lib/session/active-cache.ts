/**
 * session/active 응답 캐시 — 탭 왕복 시 재요청 폭주 방지
 * TTL 5초, module-level. inflight dedupe로 동시 중복 호출 방지.
 */

import {
  getActiveSession,
  getActiveSessionLite,
  type ActiveSessionResponse,
  type ActiveSessionLiteResponse,
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

function tokenKey(t: string): string {
  return t && t.length >= 16 ? t.slice(-16) : t || '';
}

/** Home 초기 로드용 — active-lite 캐시 (plan_json 제외, 경량) */
export async function getCachedActiveSessionLite(
  token: string
): Promise<{ ok: true; data: ActiveSessionLiteResponse } | { ok: false; status: number; error: unknown }> {
  const key = tokenKey(token);
  const now = Date.now();
  if (liteCache && liteCache.tokenKey === key && liteCache.entry.expiresAt > now) {
    return { ok: true, data: liteCache.entry.data };
  }
  if (liteInflight) {
    return liteInflight;
  }
  const promise = getActiveSessionLite(token).then((result) => {
    liteInflight = null;
    if (result.ok) {
      liteCache = {
        tokenKey: key,
        entry: { data: result.data, expiresAt: Date.now() + TTL_MS },
      };
    } else {
      liteCache = null;
    }
    return result;
  });
  liteInflight = promise;
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
}
