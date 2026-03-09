/**
 * GET /api/session/plan-detail?session_number=N
 *
 * Full plan_json for player (media, cues, metadata).
 * Lazy-loaded when player opens; not on panel critical path.
 *
 * Auth: Bearer token.
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

    const { searchParams } = new URL(req.url);
    const sessionNumberParam = searchParams.get('session_number');
    const sessionNumber = sessionNumberParam != null
      ? Math.floor(parseInt(sessionNumberParam, 10) || 0)
      : null;

    if (sessionNumber == null || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다 (1 이상의 정수)');
    }

    const supabase = getServerSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('session_plans')
      .select('plan_json')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (error) {
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 조회에 실패했습니다');
    }
    if (!row) {
      return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '해당 세션 플랜을 찾을 수 없습니다');
    }

    return ok(row.plan_json ?? {});
  } catch (err) {
    console.error('[session/plan-detail]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
