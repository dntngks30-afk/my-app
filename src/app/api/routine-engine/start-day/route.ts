/**
 * POST /api/routine-engine/start-day
 *
 * 홈 "Day 시작하기" 1회 호출 — workout/get + ensure + activate 워터폴 통합
 * Bearer only, no-store.
 *
 * Body: { dayNumber: number }
 * 응답: { success: true, routineId, dayNumber }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { activateRoutine } from '@/lib/routine-engine';
import { generateDayPlan, type DailyCondition } from '@/lib/routine-plan/day-plan-generator';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getCurrentRoutineId(userId: string): Promise<string | null> {
  const supabase = getServerSupabaseAdmin();
  const { data: active } = await supabase
    .from('workout_routines')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (active?.id) return active.id;

  const { data: draft } = await supabase
    .from('workout_routines')
    .select('id')
    .eq('user_id', userId)
    .is('started_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return draft?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const dayNumber = Math.max(1, Math.min(7, Math.floor(Number(body?.dayNumber ?? 1))));

    const routineId = await getCurrentRoutineId(userId);
    if (!routineId) {
      return NextResponse.json(
        { error: '운동 루틴을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const supabase = getServerSupabaseAdmin();
    const dayKeyUtc = getDayKeyUtc();
    const DEFAULT_CONDITION: DailyCondition = { time_available: 15 };

    let dailyCondition: DailyCondition | null = null;
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

    const { plan } = await generateDayPlan(routineId, dayNumber, dailyCondition, {
      forceRegenerate: false,
      preloadedContext: { userId },
    });

    if (!plan?.selected_template_ids?.length) {
      return NextResponse.json(
        { error: '플랜을 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    await activateRoutine(userId);

    const res = NextResponse.json({
      success: true,
      routineId,
      dayNumber,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (err) {
    console.error('[routine-engine/start-day]', err);
    return NextResponse.json(
      {
        error: '시작에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
