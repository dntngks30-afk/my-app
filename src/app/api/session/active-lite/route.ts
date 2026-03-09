/**
 * GET /api/session/active-lite
 *
 * Home 초기 로드용 경량 엔드포인트. Read-only (insert/update/event log 없음).
 * plan_json, condition 등 제외. progress + today_completed + next_unlock_at + active만 반환.
 * 상세 plan은 패널/플레이어 오픈 시 /api/session/plan으로 별도 조회.
 *
 * Auth: Bearer token (getCurrentUserId → getClaims 우선)
 * Perf: ?debug=1 → Server-Timing + data.timings for latency breakdown (write_ms=0).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type { ActiveLiteSummary } from '@/lib/session/active-lite-data';

function addTimingHeaders(res: NextResponse, timings: Record<string, number>, isDebug: boolean): Response {
  if (!isDebug || Object.keys(timings).length === 0) return res;
  const parts = Object.entries(timings).map(([k, v]) => `${k};dur=${v}`);
  const next = res.clone();
  next.headers.set('Server-Timing', parts.join(', '));
  return next;
}

function logTimingBreakdown(timings: Record<string, number>, path: string): void {
  const lines = [
    '[session/active-lite] perf',
    `  auth_ms: ${timings.auth_ms ?? '-'}`,
    `  progress_read_ms: ${timings.progress_read_ms ?? '-'}`,
    `  session_lookup_ms: ${timings.session_lookup_ms ?? '-'}`,
    `  write_ms: ${timings.write_ms ?? 0}`,
    `  total_ms: ${timings.total_ms ?? '-'}`,
    `  path: ${path}`,
  ];
  console.info(lines.join('\n'));
}

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const isDebug = new URL(req.url).searchParams.get('debug') === '1';
  const timings: Record<string, number> = {};

  try {
    const userId = await getCurrentUserId(req);
    timings.auth_ms = Math.round(performance.now() - t0);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const result = await fetchActiveLiteData(supabase, userId, isDebug ? { timings } : undefined);
    timings.total_ms = Math.round(performance.now() - t0);

    if (!result.ok) {
      if (isDebug) logTimingBreakdown(timings, 'error');
      return fail(
        result.status,
        (result.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        result.message
      );
    }

    const path = result.data.active ? 'with_active' : 'no_active';
    if (isDebug) logTimingBreakdown(timings, path);
    return addTimingHeaders(ok(result.data, isDebug ? { timings } : undefined), timings, isDebug);
  } catch (err) {
    console.error('[session/active-lite]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
