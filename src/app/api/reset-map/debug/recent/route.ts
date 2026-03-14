/**
 * GET /api/reset-map/debug/recent
 *
 * PR-RESET-10: Recent flows for current user. Auth required. Own flows only.
 * Query params: limit (default 20), since (ISO timestamp).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20)
    );
    const since = searchParams.get('since')?.trim() || undefined;

    const supabase = getServerSupabaseAdmin();
    let query = supabase
      .from('reset_map_flow')
      .select('id, user_id, state, result, flow_version, started_at, applied_at, aborted_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      const d = new Date(since);
      if (!isNaN(d.getTime())) query = query.gte('created_at', d.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[reset-map/debug/recent] fetch failed', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 조회에 실패했습니다');
    }

    return ok({ flows: data ?? [] });
  } catch (err) {
    console.error('[reset-map/debug/recent]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
