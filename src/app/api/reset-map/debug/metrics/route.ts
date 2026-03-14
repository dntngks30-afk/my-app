/**
 * GET /api/reset-map/debug/metrics
 *
 * PR-RESET-10: Reset-map metrics for current user. Auth required.
 * Query params: since (ISO timestamp, optional).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { getResetMapMetrics } from '@/lib/reset-map/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const since = req.nextUrl.searchParams.get('since')?.trim() || undefined;
    const supabase = getServerSupabaseAdmin();

    const metrics = await getResetMapMetrics({
      supabase,
      userId,
      since,
    });

    return ok(metrics);
  } catch (err) {
    console.error('[reset-map/debug/metrics]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
