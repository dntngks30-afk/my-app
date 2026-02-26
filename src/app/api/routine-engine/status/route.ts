/**
 * 7일 루틴 상태 조회 API
 *
 * GET /api/routine-engine/status
 *
 * 서버에서 24h/48h 듀얼 타이머를 평가하여 현재 상태를 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAndUpdateRoutineStatus } from '@/lib/routine-engine';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const result = await checkAndUpdateRoutineStatus(userId);

    return NextResponse.json({
      success: true,
      state: result.state,
      changed: result.changed,
    });
  } catch (err) {
    console.error('[routine-engine/status] error:', err);
    return NextResponse.json(
      {
        error: '루틴 상태 조회에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
