/**
 * 유료 접근 통일 헬퍼 — SSOT: plan_status === 'active'
 *
 * Bearer 인증 + plan_status 확인. 401/403 반환 또는 { userId } 반환.
 * getCurrentUserId(캐시) 재사용으로 동일 요청 내 getUser 중복 호출 방지.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from './getCurrentUserId';

export interface ActivePlanContext {
  userId: string;
  timings?: { t_auth_user: number; t_auth_plan: number };
}

export interface RequireActivePlanOptions {
  recordTimings?: boolean;
}

/**
 * Bearer 인증 + plan_status='active' 확인.
 * 미인증: 401, 비활성: 403, 통과: { userId }
 * recordTimings: true 시 timings 반환 (debug 전용)
 */
export async function requireActivePlan(
  req: NextRequest,
  opts?: RequireActivePlanOptions
): Promise<NextResponse | ActivePlanContext> {
  const t0 = performance.now();
  const userId = await getCurrentUserId(req);
  const tAuthUser = Math.round(performance.now() - t0);

  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const supabase = getServerSupabaseAdmin();
  const { data: dbUser } = await supabase
    .from('users')
    .select('plan_status')
    .eq('id', userId)
    .single();

  const tAuthPlan = Math.round(performance.now() - t0 - tAuthUser);

  if (!dbUser) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (dbUser.plan_status !== 'active') {
    return NextResponse.json(
      { error: '유료 플랜 사용자만 이용할 수 있습니다.' },
      { status: 403 }
    );
  }

  const result: ActivePlanContext = { userId };
  if (opts?.recordTimings) {
    result.timings = { t_auth_user: tAuthUser, t_auth_plan: tAuthPlan };
  }
  return result;
}
