/**
 * POST /api/routine-plan/ensure
 *
 * Day Plan 조회 또는 생성 (멱등). 있으면 반환, 없으면 생성 후 반환.
 * plan/get + generate 워터폴을 1회 호출로 축소.
 * Bearer only, no-store.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDayPlan } from '@/lib/routine-plan/day-plan-generator';
import type { DailyCondition } from '@/lib/routine-plan/day-plan-generator';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getTemplatesForMediaByIds } from '@/lib/workout-routine/exercise-templates-db';

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

function toPlanResponse(plan: {
  routine_id: string;
  day_number: number;
  selected_template_ids: string[];
  reasons: string[];
  constraints_applied: string[];
  generator_version: string;
  scoring_version: string;
  rule_version?: string | null;
  daily_condition_snapshot?: unknown;
}) {
  return {
    routine_id: plan.routine_id,
    day_number: plan.day_number,
    selected_template_ids: plan.selected_template_ids,
    reasons: plan.reasons,
    constraints_applied: plan.constraints_applied,
    generator_version: plan.generator_version,
    scoring_version: plan.scoring_version,
    rule_version: plan.rule_version ?? 'rule_v1',
    daily_condition_snapshot: plan.daily_condition_snapshot ?? null,
  };
}

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { routineId, dayNumber, debug: debugFlag, includeMedia } = body;
    const debug = debugFlag === true;

    if (!routineId || !dayNumber) {
      return NextResponse.json(
        { error: 'routineId와 dayNumber는 필수입니다.' },
        { status: 400 }
      );
    }

    let userId: string;
    if (includeMedia) {
      const auth = await requireActivePlan(req);
      if (auth instanceof NextResponse) return auth;
      userId = auth.userId;
    } else {
      const uid = await getCurrentUserId(req);
      if (!uid) {
        return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
      }
      userId = uid;
    }
    const tAuth = performance.now();

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

    let dailyCondition: DailyCondition | null = body.dailyCondition ?? null;
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
    const tSelectDaily = performance.now();

    const result = await generateDayPlan(routineId, day, dailyCondition, {
      forceRegenerate: false,
      preloadedContext: { userId: routine.user_id },
    });
    const { plan, regenerated } = result;
    const tGenerate = performance.now();

    const payload: Record<string, unknown> = {
      success: true,
      plan: toPlanResponse({
        ...plan,
        daily_condition_snapshot: dailyCondition ?? plan.daily_condition_snapshot,
      }),
      created: regenerated,
    };
    if (includeMedia && plan.selected_template_ids?.length) {
      const templates = await getTemplatesForMediaByIds(plan.selected_template_ids);
      const templateMap = new Map(templates.map((t) => [t.id, t]));
      const mediaPayloads = await Promise.all(
        templates.map((t) =>
          buildMediaPayload(t.media_ref, t.duration_sec ?? 300)
        )
      );
      const mediaById = new Map(templates.map((t, i) => [t.id, mediaPayloads[i]]));
      payload.segments_with_media = plan.selected_template_ids.map((id, i) => {
        const t = templateMap.get(id);
        const media = mediaById.get(id);
        return {
          templateId: id,
          templateName: t?.name ?? `운동 ${i + 1}`,
          mediaPayload: media ?? {
            kind: 'placeholder',
            autoplayAllowed: false,
            notes: ['영상 준비 중입니다.'],
          },
        };
      });
    }
    if (debug) {
        payload.timings = {
          total_ms: Math.round(tGenerate - t0),
          auth_ms: Math.round(tAuth - t0),
          select_daily_ms: Math.round(tSelectDaily - tAuth),
          generate_ms: Math.round(tGenerate - tSelectDaily),
        };
      }
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (error) {
    console.error('[routine-plan/ensure]', error);
    return NextResponse.json(
      {
        error: 'Day Plan 조회/생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
