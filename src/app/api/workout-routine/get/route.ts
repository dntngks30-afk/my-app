/**
 * 운동 루틴 조회 API
 *
 * GET /api/workout-routine/get?routineId=xxx
 * 또는
 * GET /api/workout-routine/get (현재 활성 루틴 조회)
 *
 * 응답에 todayDay, completedDays(routine_attendance), progress 포함
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { computeTodayDay } from '@/lib/workout-routine/day';

/**
 * 요청에서 사용자 ID 추출
 */
async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('User authentication error:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // 1. 사용자 인증 확인
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const routineId = searchParams.get('routineId');

    const supabase = getServerSupabaseAdmin();

    // 2. 루틴 조회
    let routineQuery = supabase
      .from('workout_routines')
      .select('*')
      .eq('user_id', userId);

    if (routineId) {
      routineQuery = routineQuery.eq('id', routineId);
    } else {
      const { data: active } = await supabase
        .from('workout_routines')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) {
        routineQuery = routineQuery.eq('id', active.id);
      } else {
        const { data: draft } = await supabase
          .from('workout_routines')
          .select('*')
          .eq('user_id', userId)
          .is('started_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (draft) {
          routineQuery = routineQuery.eq('id', draft.id);
        } else {
          return NextResponse.json(
            { error: '운동 루틴을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
      }
    }

    const { data: routine, error: routineError } = await routineQuery.single();

    if (routineError || !routine) {
      return NextResponse.json(
        { error: '운동 루틴을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 3. 일자별 운동 조회
    const { data: routineDays, error: daysError } = await supabase
      .from('workout_routine_days')
      .select('*')
      .eq('routine_id', routine.id)
      .order('day_number', { ascending: true });

    if (daysError) {
      console.error('Routine days fetch error:', daysError);
      return NextResponse.json(
        { error: '운동 일자를 조회하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 4. 출석 기록 조회 (routine_attendance)
    const { data: attendance } = await supabase
      .from('routine_attendance')
      .select('day_number')
      .eq('routine_id', routine.id)
      .order('day_number', { ascending: true });

    const completedDayNumbers = (attendance ?? []).map((a) => a.day_number);
    const totalDays = 7;
    const completedCount = completedDayNumbers.length;
    const progressPercent =
      totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

    const todayDay = routine.started_at
      ? computeTodayDay(routine.started_at)
      : null;

    // 5. 응답 반환 (progress + todayDay + attendance)
    return NextResponse.json({
      success: true,
      routine: {
        ...routine,
        started_at: routine.started_at,
        todayDay,
        completedDays: completedCount,
        attendanceDayNumbers: completedDayNumbers,
        progress: progressPercent,
        progressDetail: { completed: completedCount, total: totalDays },
        totalDays,
      },
      days: routineDays || [],
    });
  } catch (error) {
    console.error('Workout routine fetch error:', error);
    return NextResponse.json(
      {
        error: '운동 루틴 조회에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
