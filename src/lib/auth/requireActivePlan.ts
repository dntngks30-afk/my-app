/**
 * 유료 접근 통일 헬퍼 — SSOT: plan_status === 'active'
 *
 * Bearer 인증 + plan_status 확인. 401/403 반환 또는 { userId } 반환.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from './getCurrentUserId';

export interface ActivePlanContext {
  userId: string;
}

/**
 * Bearer 인증 + plan_status='active' 확인.
 * 미인증: 401, 비활성: 403, 통과: { userId }
 */
export async function requireActivePlan(
  req: NextRequest
): Promise<NextResponse | ActivePlanContext> {
  const userId = await getCurrentUserId(req);
  if (!userId) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const supabase = getServerSupabaseAdmin();
  const { data: dbUser } = await supabase
    .from('users')
    .select('plan_status')
    .eq('id', userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (dbUser.plan_status !== 'active') {
    return NextResponse.json(
      { error: '유료 플랜 사용자만 이용할 수 있습니다.' },
      { status: 403 }
    );
  }

  return { userId };
}
