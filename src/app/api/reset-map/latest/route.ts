/**
 * GET /api/reset-map/latest
 *
 * PR-RESET-05: Most recent non-terminal flow for current user.
 * Terminal: applied, aborted. Used for resume.
 * Auth: Bearer token.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIVE_STATES = ['started', 'preview_ready'];

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const { data, error } = await supabase
      .from('reset_map_flow')
      .select('*')
      .eq('user_id', userId)
      .in('state', ACTIVE_STATES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[reset-map/latest] fetch failed', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 조회에 실패했습니다');
    }

    return ok({ flow: data });
  } catch (err) {
    console.error('[reset-map/latest]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
