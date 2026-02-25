/**
 * Deep Test API 인증/권한 헬퍼
 * Bearer 필수, plan_status='active' 확인
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export interface AuthContext {
  userId: string;
}

/** 401/403 응답 또는 AuthContext 반환 */
export async function requireDeepAuth(
  req: NextRequest
): Promise<NextResponse | AuthContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('id, plan_tier, plan_status')
    .eq('id', user.id)
    .single();

  if (!dbUser) {
    return NextResponse.json(
      { error: '사용자를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (dbUser.plan_tier === 'free' || dbUser.plan_status !== 'active') {
    return NextResponse.json(
      { error: '유료 플랜 사용자만 이용할 수 있습니다.' },
      { status: 403 }
    );
  }

  return { userId: user.id };
}
