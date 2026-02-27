/**
 * 운동 일자 완료 처리 API
 * 
 * POST /api/workout-routine/complete-day
 * 
 * Body: { routineId: string, dayNumber: number, notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. 사용자 인증 확인
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // 2. 요청 본문 파싱
    const body = await req.json();
    const { routineId, dayNumber, notes } = body;

    if (!routineId || !dayNumber) {
      return NextResponse.json(
        { error: 'routineId와 dayNumber는 필수입니다.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();

    // 3. 루틴 소유권 확인
    const { data: routine, error: routineError } = await supabase
      .from('workout_routines')
      .select('id, user_id')
      .eq('id', routineId)
      .eq('user_id', userId)
      .single();

    if (routineError || !routine) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 4. 일자 완료 처리
    const { error: updateError } = await supabase
      .from('workout_routine_days')
      .update({
        completed_at: new Date().toISOString(),
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('routine_id', routineId)
      .eq('day_number', dayNumber);

    if (updateError) {
      console.error('Day completion error:', updateError);
      return NextResponse.json(
        { error: '완료 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 5. 모든 일자가 완료되었는지 확인
    const { data: allDays } = await supabase
      .from('workout_routine_days')
      .select('completed_at')
      .eq('routine_id', routineId);

    const allCompleted = allDays?.every((day) => day.completed_at !== null) || false;

    if (allCompleted) {
      // 루틴 완료 처리
      await supabase
        .from('workout_routines')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', routineId);
    }

    return NextResponse.json({
      success: true,
      allCompleted,
    });
  } catch (error) {
    console.error('Day completion error:', error);
    return NextResponse.json(
      {
        error: '완료 처리에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
