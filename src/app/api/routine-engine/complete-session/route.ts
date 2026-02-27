/**
 * 루틴 세션 완료 API
 *
 * POST /api/routine-engine/complete-session
 *
 * - 클라이언트 플레이어가 마지막 세그먼트 종료 시 1회 호출
 * - 멱등: (user_id, day_number, started_at_utc) UNIQUE → 동일 요청 시 didInsert=false
 * - 정책 B: user_routines 변경 없음(로그만 저장)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

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
    const routineId =
      typeof body.routineId === 'string' && body.routineId ? body.routineId : null;
    const dayNumber = typeof body.dayNumber === 'number' ? body.dayNumber : null;
    const startedAtUtc =
      typeof body.startedAtUtc === 'string' ? body.startedAtUtc : null;

    if (dayNumber === null || dayNumber < 1 || dayNumber > 7) {
      return NextResponse.json(
        { error: 'dayNumber는 1~7 사이여야 합니다.' },
        { status: 400 }
      );
    }
    if (!startedAtUtc) {
      return NextResponse.json(
        { error: 'startedAtUtc(ISO 문자열)가 필요합니다.' },
        { status: 400 }
      );
    }

    const startedAt = new Date(startedAtUtc);
    if (Number.isNaN(startedAt.getTime())) {
      return NextResponse.json(
        { error: 'startedAtUtc 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    console.log('[complete-session] request', { dayNumber });

    const supabase = getServerSupabaseAdmin();
    const { data: didInsert, error } = await supabase.rpc(
      'insert_routine_completion_if_new',
      {
        p_user_id: userId,
        p_day_number: dayNumber,
        p_started_at_utc: startedAt.toISOString(),
      }
    );

    if (error) {
      console.warn('[complete-session] error', { message: error.message });
      return NextResponse.json(
        {
          error: '세션 완료 처리에 실패했습니다.',
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (didInsert === false) {
      console.log('[complete-session] idempotent_hit', { dayNumber });
    } else {
      console.log('[complete-session] ok', { dayNumber });
    }

    if (routineId) {
      const { data: routine } = await supabase
        .from('workout_routines')
        .select('id')
        .eq('id', routineId)
        .eq('user_id', userId)
        .maybeSingle();
      if (routine?.id) {
        const nowIso = new Date().toISOString();
        await supabase
          .from('workout_routine_days')
          .update({ completed_at: nowIso, updated_at: nowIso })
          .eq('routine_id', routineId)
          .eq('day_number', dayNumber);
      }
    }

    const server_now_utc = new Date().toISOString();

    const res = NextResponse.json({
      success: true,
      server_now_utc,
      dayNumber,
      didInsert: didInsert === true,
    });

    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    console.warn('[complete-session] error', {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: '세션 완료 처리에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
