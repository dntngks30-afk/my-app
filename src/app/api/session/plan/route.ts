/**
 * GET /api/session/plan?session_number=N
 *
 * 특정 세션의 plan_json 조회 (read-only). 지도에서 과거 세션 클릭 시 운동 목록 표시용.
 * userId는 Bearer 인증으로 확보. session_plans에서 1 row만 select (O(1)).
 *
 * Auth: Bearer token
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
    const sessionNumber = sessionNumberParam ? Math.floor(parseInt(sessionNumberParam, 10)) : NaN;

    if (!Number.isFinite(sessionNumber) || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다 (1 이상의 정수)');
    }

    const { data: plan, error } = await getServerSupabaseAdmin()
      .from('session_plans')
      .select('session_number, status, plan_json, completed_at, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (error) {
      console.error('[session/plan] fetch error', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 조회에 실패했습니다');
    }

    if (!plan) {
      return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '해당 세션을 찾을 수 없습니다');
    }

    const exerciseLogs = Array.isArray((plan as { exercise_logs?: unknown }).exercise_logs)
      ? (plan as { exercise_logs: unknown[] }).exercise_logs
      : [];

    return ok({
      session_number: plan.session_number,
      status: plan.status ?? 'draft',
      plan_json: plan.plan_json ?? null,
      completed_at: plan.completed_at ?? null,
      exercise_logs: exerciseLogs,
    });
  } catch (err) {
    console.error('[session/plan]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
