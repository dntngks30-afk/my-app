/**
 * Request de-dupe — create/complete 폭주 방어.
 * 짧은 윈도우(10초)에서 동일 요청 억제.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_TTL_SECONDS = 10;
const MAX_KEY_LEN = 64;

export type BuildDedupeKeyParams = {
  route: string;
  userId: string;
  kstDay?: string | null;
  sessionNumber?: number | null;
  headerKey?: string | null;
};

/**
 * dedupe_key 생성. headerKey 우선, 없으면 기본 키.
 * 길면 sha256 해시로 64자 이하.
 */
export function buildDedupeKey(params: BuildDedupeKeyParams): string {
  const { route, userId, kstDay, sessionNumber, headerKey } = params;
  const raw = headerKey
    ? `${userId}:${route}:${headerKey}`
    : `${userId}:${route}:${kstDay ?? ''}:${sessionNumber ?? ''}`;
  if (raw.length <= MAX_KEY_LEN) return raw;
  return createHash('sha256').update(raw).digest('hex').slice(0, MAX_KEY_LEN);
}

export type TryAcquireDedupeParams = {
  route: string;
  userId: string;
  dedupeKey: string;
  kstDay?: string | null;
  sessionNumber?: number | null;
  ttlSeconds?: number;
};

/**
 * de-dupe 획득 시도. true=획득 성공(진행), false=중복(409 반환).
 * 만료된 키는 재획득 가능.
 */
export async function tryAcquireDedupe(
  admin: SupabaseClient,
  params: TryAcquireDedupeParams
): Promise<boolean> {
  const { route, userId, dedupeKey, kstDay, sessionNumber, ttlSeconds = DEFAULT_TTL_SECONDS } = params;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const row = {
    user_id: userId,
    route,
    dedupe_key: dedupeKey,
    kst_day: kstDay ?? null,
    session_number: sessionNumber ?? null,
    expires_at: expiresAt,
    status: 'inflight',
  };

  const { error } = await admin.from('request_dedupe_keys').insert(row);

  if (!error) return true;

  if (error.code === '23505') {
    const { data: existing } = await admin
      .from('request_dedupe_keys')
      .select('expires_at')
      .eq('route', route)
      .eq('user_id', userId)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();

    if (existing && new Date(existing.expires_at) < now) {
      await admin
        .from('request_dedupe_keys')
        .delete()
        .eq('route', route)
        .eq('user_id', userId)
        .eq('dedupe_key', dedupeKey);
      const { error: insertErr } = await admin.from('request_dedupe_keys').insert(row);
      return !insertErr;
    }
    return false;
  }

  console.error('[request-dedupe] tryAcquire failed', error);
  return true;
}

export type MarkDoneParams = {
  route: string;
  userId: string;
  dedupeKey: string;
  ok: boolean;
};

/**
 * 처리 완료 표시 (운영용, 선택).
 */
export async function markDone(
  admin: SupabaseClient,
  params: MarkDoneParams
): Promise<void> {
  try {
    await admin
      .from('request_dedupe_keys')
      .update({ status: params.ok ? 'done' : 'failed' })
      .eq('route', params.route)
      .eq('user_id', params.userId)
      .eq('dedupe_key', params.dedupeKey);
  } catch (err) {
    console.error('[request-dedupe] markDone failed', err);
  }
}
