/**
 * POST /api/routine-plan/generate
 *
 * Day Plan 생성 (멱등). routineId, dayNumber, dailyCondition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDayPlan } from '@/lib/routine-plan/day-plan-generator';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user.id;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { routineId, dayNumber, dailyCondition, forceRegenerate } = body;

    if (!routineId || !dayNumber) {
      return NextResponse.json(
        { error: 'routineId와 dayNumber는 필수입니다.' },
        { status: 400 }
      );
    }

    const day = Math.max(1, Math.min(7, Math.floor(Number(dayNumber))));

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

    const plan = await generateDayPlan(
      routineId,
      day,
      dailyCondition ?? null,
      { forceRegenerate: !!forceRegenerate }
    );

    const res = NextResponse.json({
      success: true,
      plan: {
        routine_id: plan.routine_id,
        day_number: plan.day_number,
        selected_template_ids: plan.selected_template_ids,
        reasons: plan.reasons,
        constraints_applied: plan.constraints_applied,
        generator_version: plan.generator_version,
        scoring_version: plan.scoring_version,
        created_at_utc: new Date().toISOString(),
      },
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('[routine-plan/generate]', error);
    return NextResponse.json(
      {
        error: 'Day Plan 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
