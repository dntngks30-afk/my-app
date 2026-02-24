/**
 * 운동 일자 출석 처리 API (멱등)
 *
 * POST /api/workout-routine/complete-day
 *
 * Body: { routineId?: string }  (없으면 active 루틴 사용)
 * - 오늘 일차(todayDay)를 routine_attendance에 기록
 * - ON CONFLICT DO NOTHING (중복 호출 시 changed=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { computeTodayDay } from '@/lib/workout-routine/day';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
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

    let body: { routineId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body ok
    }

    const { routineId } = body;
    const supabase = getServerSupabaseAdmin();

    let routine: { id: string; started_at: string | null } | null = null;

    if (routineId) {
      const { data, error } = await supabase
        .from('workout_routines')
        .select('id, started_at')
        .eq('id', routineId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
      routine = data;
    } else {
      const { data } = await supabase
        .from('workout_routines')
        .select('id, started_at')
        .eq('user_id', userId)
        .not('started_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        return NextResponse.json(
          { error: '시작된 루틴이 없습니다.' },
          { status: 404 }
        );
      }
      routine = data;
    }

    if (!routine) {
      return NextResponse.json({ error: '루틴을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!routine.started_at) {
      return NextResponse.json(
        { error: '루틴이 아직 시작되지 않았습니다.' },
        { status: 409 }
      );
    }

    const dayNumber = computeTodayDay(routine.started_at);

    const { data: inserted, error: insertError } = await supabase
      .from('routine_attendance')
      .upsert(
        {
          routine_id: routine.id,
          day_number: dayNumber,
          completed_at: new Date().toISOString(),
        },
        {
          onConflict: 'routine_id,day_number',
          ignoreDuplicates: true,
        }
      )
      .select('id')
      .maybeSingle();

    if (insertError) {
      console.error('Attendance insert error:', insertError);
      return NextResponse.json(
        { error: '출석 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    const changed = !!inserted;

    const { data: allAttendance } = await supabase
      .from('routine_attendance')
      .select('day_number')
      .eq('routine_id', routine.id);
    const completedCount = allAttendance?.length ?? 0;

    if (changed && completedCount >= 7) {
      await supabase
        .from('workout_routines')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', routine.id);
    }

    return NextResponse.json({
      ok: true,
      routineId: routine.id,
      dayNumber,
      changed,
      allCompleted: completedCount >= 7,
    });
  } catch (err) {
    console.error('Complete-day error:', err);
    return NextResponse.json(
      {
        error: '처리 중 오류가 발생했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
