/**
 * 운동 루틴 조회 API
 * 
 * GET /api/workout-routine/get?routineId=xxx
 * 또는
 * GET /api/workout-routine/get (현재 활성 루틴 조회)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

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

    // 4. 진행률 계산
    const completedDays = routineDays?.filter((day) => day.completed_at !== null).length || 0;
    const totalDays = routineDays?.length || 0;
    const progress = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    // 5. 응답 반환
    return NextResponse.json({
      success: true,
      routine: {
        ...routine,
        progress,
        completedDays,
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
