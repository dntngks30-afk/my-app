/**
 * GET /api/routine/list
 * 내 루틴 목록 조회 (허브용)
 * Bearer only, no-store, user별 데이터 격리
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const supabase = getServerSupabaseAdmin();

    const { data: routines, error: routineError } = await supabase
      .from('workout_routines')
      .select('id, created_at, status, started_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (routineError) {
      console.error('[routine/list]', routineError);
      return NextResponse.json(
        { error: '루틴 목록 조회 실패', details: routineError.message },
        { status: 500 }
      );
    }

    if (!routines?.length) {
      const res = NextResponse.json({
        success: true,
        routines: [],
      });
      res.headers.set('Cache-Control', 'no-store, max-age=0');
      return res;
    }

    const ids = routines.map((r) => r.id);

    const { data: daysRows, error: daysError } = await supabase
      .from('workout_routine_days')
      .select('routine_id, day_number, completed_at')
      .in('routine_id', ids);

    if (daysError) {
      console.error('[routine/list] days', daysError);
    }

    const daysByRoutine = new Map<string, { completed: number; lastCompletedDay: number }>();
    for (const r of routines) {
      daysByRoutine.set(r.id, { completed: 0, lastCompletedDay: 0 });
    }
    for (const d of daysRows ?? []) {
      const cur = daysByRoutine.get(d.routine_id);
      if (!cur) continue;
      if (d.completed_at) {
        cur.completed += 1;
        if (d.day_number > cur.lastCompletedDay) {
          cur.lastCompletedDay = d.day_number;
        }
      }
    }

    const { data: statusData } = await supabase
      .from('user_routines')
      .select('current_day')
      .eq('user_id', userId)
      .maybeSingle();

    const currentDay = statusData?.current_day ?? 1;

    const routinesOut = routines.map((r) => {
      const progress = daysByRoutine.get(r.id) ?? { completed: 0, lastCompletedDay: 0 };
      const nextDay =
        progress.lastCompletedDay > 0
          ? Math.min(7, progress.lastCompletedDay + 1)
          : currentDay;
      return {
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        started_at: r.started_at,
        completedDays: progress.completed,
        lastCompletedDay: progress.lastCompletedDay,
        nextDay,
      };
    });

    const res = NextResponse.json({
      success: true,
      routines: routinesOut,
      currentDay,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('[routine/list]', error);
    return NextResponse.json(
      {
        error: '루틴 목록 조회 실패',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
