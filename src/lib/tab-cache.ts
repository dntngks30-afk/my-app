/**
 * 탭 전환 시 즉시 렌더용 경량 인메모리 캐시
 * stale-while-revalidate: 캐시 있으면 즉시 표시, 백그라운드 재검증
 */

import type { ActiveSessionLiteResponse } from './session/client';

const TTL_MS = 30_000; // 30초 — 탭 왕복 시 즉시 표시용

interface CacheEntry {
  data: ActiveSessionLiteResponse;
  expiresAt: number;
}

let tabCache: CacheEntry | null = null;

export function getTabCache(): ActiveSessionLiteResponse | null {
  if (!tabCache || tabCache.expiresAt < Date.now()) return null;
  return tabCache.data;
}

export function setTabCache(data: ActiveSessionLiteResponse): void {
  tabCache = {
    data,
    expiresAt: Date.now() + TTL_MS,
  };
}

export function invalidateTabCache(): void {
  tabCache = null;
}
