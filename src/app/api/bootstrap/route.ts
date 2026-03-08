/**
 * GET /api/bootstrap
 *
 * Minimal summary bundle for app initialization across 지도 / 통계 / 마이 tabs.
 * Read-only. No writes, no side effects.
 *
 * Auth: Bearer token (getCurrentUserId)
 * ?debug=1 → response includes debug timings (auth_ms, user_ms, home_ms, stats_ms, my_ms, total_ms)
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getBootstrapData } from '@/lib/bootstrap/getBootstrapData';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const isDebug = new URL(req.url).searchParams.get('debug') === '1';

  try {
    const userId = await getCurrentUserId(req);
    const authMs = Math.round(performance.now() - t0);

    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const result = await getBootstrapData(supabase, userId, { debug: isDebug });

    if (!result.ok) {
      return fail(
        result.status,
        ApiErrorCode.INTERNAL_ERROR,
        result.message
      );
    }

    const extras = isDebug && result.timings
      ? { debug: { ...result.timings, auth_ms: authMs } }
      : undefined;

    return ok(result.data, extras);
  } catch (err) {
    console.error('[api/bootstrap]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
