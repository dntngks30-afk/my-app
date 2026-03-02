/**
 * 유료 접근 통일 헬퍼 — SSOT: plan_status === 'active'
 *
 * Bearer 인증 + plan_status 확인. 401/403 반환 또는 { userId } 반환.
 *
 * [병렬화 전략]
 * JWT payload의 sub 클레임으로 userId를 로컬 디코드하여 즉시 선취득.
 * 그 후 getUser(token)(서버 검증) 와 users.plan_status(DB 조회)를 Promise.all로 동시 실행.
 * 최종적으로 getUser의 verified userId가 sub와 일치하는지 교차 검증.
 * → auth 2순차 hop → 1병렬 hop. 약 ~40% 시간 절감.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getBearerToken, decodeJwtSub } from './requestAuthCache';
import { getCachedUserId } from './requestAuthCache';

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
  const supabase = getServerSupabaseAdmin();

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // JWT sub 클레임으로 userId 선취득 (로컬 디코드, 서명 검증 없음)
  const subFromToken = decodeJwtSub(token);

  // getUser(서버 검증) + plan_status 조회를 병렬 실행
  // sub가 없으면 plan_status 조회는 건너뜀 (어차피 getUser 실패로 401 처리)
  const [verifiedUserId, planRow] = await Promise.all([
    getCachedUserId(req, supabase),
    subFromToken
      ? supabase.from('users').select('id, plan_status').eq('id', subFromToken).single()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const tAuthUser = Math.round(performance.now() - t0);

  if (!verifiedUserId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // sub 불일치: 토큰 위변조 가능성 → plan_status를 다시 안전하게 조회
  let dbUser = planRow && planRow.id === verifiedUserId ? planRow : null;

  const tPlanStart = performance.now();
  if (!dbUser) {
    const { data } = await supabase
      .from('users')
      .select('id, plan_status')
      .eq('id', verifiedUserId)
      .single();
    dbUser = data;
  }
  const tAuthPlan = Math.round(performance.now() - tPlanStart);

  if (!dbUser) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  if ((dbUser as { plan_status?: string }).plan_status !== 'active') {
    return NextResponse.json(
      { error: '유료 플랜 사용자만 이용할 수 있습니다.' },
      { status: 403 }
    );
  }

  const result: ActivePlanContext = { userId: verifiedUserId };
  if (opts?.recordTimings) {
    result.timings = { t_auth_user: tAuthUser, t_auth_plan: tAuthPlan };
  }
  return result;
}
