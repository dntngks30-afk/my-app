/**
 * GET /api/routine-plan/get?routineId=&dayNumber=
 *
 * Day Plan 조회.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDayPlan } from '@/lib/routine-plan/day-plan-generator';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const routineId = searchParams.get('routineId');
    const dayNumber = searchParams.get('dayNumber');

    if (!routineId || !dayNumber) {
      return NextResponse.json(
        { error: 'routineId와 dayNumber가 필요합니다.' },
        { status: 400 }
      );
    }

    const { getServerSupabaseAdmin } = await import('@/lib/supabase');
    const supabase = getServerSupabaseAdmin();
    const { data: routine } = await supabase
      .from('workout_routines')
      .select('user_id')
      .eq('id', routineId)
      .single();

    if (!routine || routine.user_id !== userId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const plan = await getDayPlan(routineId, Math.max(1, Math.min(7, Math.floor(Number(dayNumber)))));

    const res = NextResponse.json({
      success: true,
      plan: plan
        ? {
            routine_id: plan.routine_id,
            day_number: plan.day_number,
            selected_template_ids: plan.selected_template_ids,
            reasons: plan.reasons,
            constraints_applied: plan.constraints_applied,
            generator_version: plan.generator_version,
            scoring_version: plan.scoring_version,
          }
        : null,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('[routine-plan/get]', error);
    return NextResponse.json(
      {
        error: 'Day Plan 조회에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
