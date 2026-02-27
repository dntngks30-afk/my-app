/**
 * POST /api/routine-plan/generate
 *
 * Day Plan 생성 (멱등). routineId, dayNumber 필수.
 * dailyCondition: body에 있으면 사용, 없으면 DB 조회, 없으면 서버 기본값 사용(2xx 보장).
 * Bearer only, no-store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDayPlan } from '@/lib/routine-plan/day-plan-generator';
import type { DailyCondition } from '@/lib/routine-plan/day-plan-generator';

export const dynamic = 'force-dynamic';

function getDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

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
    const { routineId, dayNumber, dailyCondition: bodyCondition, forceRegenerate } = body;

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

    const DEFAULT_CONDITION: DailyCondition & { source?: string } = {
      source: 'default',
      time_available: 15,
    };

    let dailyCondition: DailyCondition | null = bodyCondition ?? null;
    if (!dailyCondition) {
      const dayKeyUtc = getDayKeyUtc();
      const { data: row } = await supabase
        .from('daily_conditions')
        .select('pain_today, stiffness, sleep, time_available_min, equipment_available')
        .eq('user_id', userId)
        .eq('day_key_utc', dayKeyUtc)
        .maybeSingle();

      if (row) {
        dailyCondition = {
          pain_today: row.pain_today ?? undefined,
          stiffness: row.stiffness ?? undefined,
          sleep: row.sleep ?? undefined,
          time_available: row.time_available_min ?? 15,
          equipment_available: row.equipment_available ?? [],
        };
      } else {
        dailyCondition = DEFAULT_CONDITION;
      }
    }

    const result = await generateDayPlan(
      routineId,
      day,
      dailyCondition,
      { forceRegenerate: !!forceRegenerate }
    );

    const { plan, regenerated, regen_reason } = result;
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
        rule_version: plan.rule_version ?? 'rule_v1',
        daily_condition_snapshot: dailyCondition ?? null,
        created_at_utc: new Date().toISOString(),
      },
      regenerated,
      ...(regen_reason && { regen_reason }),
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
