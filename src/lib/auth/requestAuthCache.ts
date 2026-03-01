/**
 * 요청 단위(Request-scoped) Bearer 토큰 → userId 캐시
 * 동일 요청 내에서 supabase.auth.getUser(token) 중복 호출 방지
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type CacheEntry = {
  bearerToken: string | null;
  userIdPromise: Promise<string | null> | null;
};

const cache = new WeakMap<NextRequest, CacheEntry>();

/**
 * Authorization: Bearer ... 에서 토큰 추출 (캐시됨)
 */
export function getBearerToken(req: NextRequest): string | null {
  let entry = cache.get(req);
  if (!entry) {
    const authHeader = req.headers.get('authorization');
    const token =
      authHeader?.startsWith('Bearer ') && authHeader.slice(7).trim()
        ? authHeader.slice(7).trim()
        : null;
    entry = { bearerToken: token, userIdPromise: null };
    cache.set(req, entry);
  }
  return entry.bearerToken;
}

/**
 * 요청 1회당 1번만 getUser 호출. 캐시된 Promise 반환.
 */
export async function getCachedUserId(
  req: NextRequest,
  supabase: SupabaseClient
): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  let entry = cache.get(req)!;
  if (!entry.userIdPromise) {
    entry.userIdPromise = supabase.auth
      .getUser(token)
      .then(({ data: { user }, error }) => (error || !user ? null : user.id));
  }
  return entry.userIdPromise;
}
