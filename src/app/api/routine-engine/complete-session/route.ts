/**
 * 루틴 세션 완료 API
 *
 * POST /api/routine-engine/complete-session
 *
 * - 클라이언트 플레이어가 마지막 세그먼트 종료 시 1회 호출
 * - 멱등: 동일 user_id + dayNumber + startedAtUtc 반복 요청 시 200 OK
 * - 이번 PR: DB 미변경, 상태 조회만 반환 (24/48h 엔진 정책 유지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAndUpdateRoutineStatus } from '@/lib/routine-engine';

export const dynamic = 'force-dynamic';

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dayNumber = typeof body.dayNumber === 'number' ? body.dayNumber : 1;
    const startedAtUtc =
      typeof body.startedAtUtc === 'string' ? body.startedAtUtc : null;

    const result = await checkAndUpdateRoutineStatus(userId);
    const server_now_utc = new Date().toISOString();

    const res = NextResponse.json({
      success: true,
      state: result.state,
      server_now_utc,
    });

    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.error('[routine-engine/complete-session] error:', err);
    return NextResponse.json(
      {
        error: '세션 완료 처리에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
