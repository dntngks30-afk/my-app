/**
 * 요청 단위(Request-scoped) Bearer 토큰 → userId 캐시
 * 동일 요청 내에서 supabase.auth.getUser(token) 중복 호출 방지
 */

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * JWT payload의 sub(userId) 클레임을 로컬 base64 디코드로 추출.
 * 서버 검증 없이 userId만 선취득하기 위한 용도. 실제 인증은 getUser()가 담당.
 * 디코드 실패 시 null 반환 (신뢰 없는 토큰 차단은 getUser()에서 수행).
 */
export function decodeJwtSub(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>;
    const sub = decoded.sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch {
    return null;
  }
}

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
