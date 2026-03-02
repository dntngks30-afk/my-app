/**
 * POST /api/routine-plan/ensure
 *
 * Day Plan 조회 또는 생성 (멱등). 있으면 반환, 없으면 생성 후 반환.
 * plan/get + generate 워터폴을 1회 호출로 축소.
 * Bearer only, no-store. 유료 권한(plan_status='active') 필수.
 * 핫패스(existingPlan): generateDayPlan 미로드.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { createServerTiming } from '@/lib/debug/serverTiming';
import type { GenerateDayPlanResult } from '@/lib/routine-plan/day-plan-generator';
import type { DailyCondition } from '@/lib/routine-plan/day-plan-generator';
import { getServerSupabaseAdmin } from '@/lib/supabase';

function traceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = ['icn1'];

function getDayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
  const t = createServerTiming();
  const rid = traceId();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  t.mark('body');
  const bodyDebug = body?.debug;
  const queryDebug = (() => {
    try {
      const u = new URL(req.url);
      return u.searchParams.get('debug') === '1';
    } catch {
      return false;
    }
  })();
  const isDebug =
    queryDebug ||
    bodyDebug === true ||
    bodyDebug === 1 ||
    bodyDebug === '1';
  try {
    const {
      routineId,
      dayNumber,
      includeMedia: includeMediaRaw,
      mediaMode: mediaModeRaw,
      includeStatus: includeStatusRaw,
      includeTemplates: includeTemplatesRaw,
    } = body;
    const includeMedia = includeMediaRaw === true || includeMediaRaw === 1 || includeMediaRaw === '1';
    const includeStatus = includeStatusRaw === true || includeStatusRaw === 1 || includeStatusRaw === '1';
    const includeTemplates =
      includeTemplatesRaw === true ||
      includeTemplatesRaw === 1 ||
      includeTemplatesRaw === '1';
    const rawMode = mediaModeRaw === 'none' || mediaModeRaw === 'first' || mediaModeRaw === 'all'
      ? mediaModeRaw
      : includeMedia
        ? 'first'
        : 'none';
    const mediaMode = rawMode as 'none' | 'first' | 'all';

    if (!routineId || !dayNumber) {
      const res = NextResponse.json(
        { error: 'routineId와 dayNumber는 필수입니다.' },
        { status: 400 }
      );
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      return res;
    }

    const auth = await requireActivePlan(req, { recordTimings: isDebug });
    t.mark('auth');
    if (auth instanceof NextResponse) {
      auth.headers.set('Server-Timing', t.header());
      auth.headers.set('x-mr-trace', rid);
      return auth;
    }
    const userId = auth.userId;

    const day = Math.max(1, Math.min(7, Math.floor(Number(dayNumber))));

    const supabase = getServerSupabaseAdmin();

    const [{ data: routine }, { data: existingPlan }] = await Promise.all([
      supabase
        .from('workout_routines')
        .select('user_id')
        .eq('id', routineId)
        .single(),
      supabase
        .from('routine_day_plans')
        .select('routine_id, day_number, selected_template_ids, reasons, constraints_applied, generator_version, scoring_version, rule_version, daily_condition_snapshot')
        .eq('routine_id', routineId)
        .eq('day_number', day)
        .maybeSingle(),
    ]);

    if (!routine || routine.user_id !== userId) {
      const res = NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      return res;
    }

    t.mark('db_select');

    let generateResult: GenerateDayPlanResult | null = null;
    let plan: {
      routine_id: string;
      day_number: number;
      selected_template_ids: string[];
      reasons: string[];
      constraints_applied: string[];
      generator_version: string;
      scoring_version: string;
      rule_version?: string | null;
      daily_condition_snapshot?: unknown;
    };
    let regenerated: boolean;

    if (existingPlan) {
      plan = {
        routine_id: existingPlan.routine_id,
        day_number: existingPlan.day_number,
        selected_template_ids: existingPlan.selected_template_ids ?? [],
        reasons: existingPlan.reasons ?? [],
        constraints_applied: existingPlan.constraints_applied ?? [],
        generator_version: existingPlan.generator_version ?? 'gen_v1',
        scoring_version: existingPlan.scoring_version ?? 'deep_v2',
        rule_version: existingPlan.rule_version ?? 'rule_v1',
        daily_condition_snapshot: existingPlan.daily_condition_snapshot ?? null,
      };
      regenerated = false;
    } else {
      const { generateDayPlan } = await import('@/lib/routine-plan/day-plan-generator');
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
          const eq = row.equipment_available;
          dailyCondition = {
            pain_today: row.pain_today ?? undefined,
            stiffness: row.stiffness ?? undefined,
            sleep: row.sleep ?? undefined,
            time_available: row.time_available_min ?? 15,
            equipment_available: Array.isArray(eq) ? eq.filter((x): x is string => typeof x === 'string') : [],
          };
        } else {
          dailyCondition = DEFAULT_CONDITION;
        }
      }

      generateResult = await generateDayPlan(
        routineId as string,
        day,
        dailyCondition,
        {
          forceRegenerate: false,
          preloadedContext: { userId },
          debug: isDebug,
        }
      );
      plan = {
        ...generateResult.plan,
        daily_condition_snapshot: dailyCondition ?? generateResult.plan.daily_condition_snapshot,
      };
      regenerated = generateResult.regenerated;
      t.mark('db_plan_create');
    }

    t.mark('payload_start');

    const payload: Record<string, unknown> = {
      success: true,
      plan: toPlanResponse(plan),
      created: regenerated,
    };

    const ids = plan.selected_template_ids ?? [];

    if ((includeTemplates || mediaMode !== 'none') && ids.length > 0) {
      const { getTemplatesForMediaByIds } = await import('@/lib/workout-routine/exercise-templates-db');
      const templates = await getTemplatesForMediaByIds(ids);
      const templateMap = new Map(templates.map((t) => [t.id, t]));
      if (includeTemplates) {
        payload.segments = ids.map((id, i) => {
          const t = templateMap.get(id);
          return {
            templateId: id,
            templateName: t?.name ?? `운동 ${i + 1}`,
            durationSec: t?.duration_sec ?? 60,
            kind: 'work' as const,
          };
        });
      }
      if (mediaMode !== 'none') {
        const signIds = mediaMode === 'all' ? ids : ids.slice(0, 1);
        const placeholderMedia = {
          kind: 'placeholder' as const,
          autoplayAllowed: false,
          notes: ['영상 준비 중입니다.'],
        };

        const signTemplates = templates.filter((t) => signIds.includes(t.id));
        let mediaById = new Map<string, { kind: string; autoplayAllowed: boolean; notes?: string[] }>();
        if (signTemplates.length > 0) {
          let settled: PromiseSettledResult<{ kind: string; autoplayAllowed: boolean; notes?: string[] }>[];
          try {
            const { buildMediaPayload } = await import('@/lib/media/media-payload');
            settled = await Promise.allSettled(
              signTemplates.map((t) =>
                buildMediaPayload(t.media_ref, t.duration_sec ?? 300)
              )
            );
          } catch (importErr) {
            if (isDebug) console.warn('[routine-plan/ensure] media-payload import failed', importErr);
            settled = signTemplates.map(() => ({ status: 'rejected' as const, reason: 'import_failed' }));
          }
          signTemplates.forEach((t, i) => {
            const payload = settled[i]?.status === 'fulfilled'
              ? (settled[i] as PromiseFulfilledResult<{ kind: string; autoplayAllowed: boolean; notes?: string[] }>).value
              : placeholderMedia;
            mediaById.set(t.id, payload);
          });
          if (isDebug && settled.some((s) => s.status === 'rejected')) {
            const warnings: string[] = [];
            settled.forEach((s, i) => {
              if (s.status === 'rejected') {
                warnings.push(`media_fail:${signTemplates[i]?.id ?? i}`);
              }
            });
            payload.debug_warnings = warnings;
          }
        }

        payload.segments_with_media = ids.map((id, i) => {
          const t = templateMap.get(id);
          const media = mediaById.get(id) ?? placeholderMedia;
          return {
            templateId: id,
            templateName: t?.name ?? `운동 ${i + 1}`,
            mediaPayload: media,
          };
        });
      }
    }
    if (includeStatus) {
      try {
        const { computeRoutineStatusPayload } = await import('@/lib/routine-engine');
        payload.status = await computeRoutineStatusPayload(userId);
      } catch (statusErr) {
        if (isDebug) console.warn('[routine-plan/ensure] status embed failed', statusErr);
      }
    }

    t.mark('payload');

    if (isDebug) {
      const timings: Record<string, number> = {};
      if (auth.timings) {
        timings.t_auth_user = auth.timings.t_auth_user;
        timings.t_auth_plan = auth.timings.t_auth_plan;
      }
      payload.timings = timings;
      if (generateResult?.generator_timings) {
        payload.generator_subtimings = generateResult.generator_timings;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[routine-plan/ensure] timings', payload.timings);
      }
    }
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('Server-Timing', t.header());
    res.headers.set('x-mr-trace', rid);
    res.headers.set('x-mr-ensure-mode', regenerated ? 'create' : 'read');
    return res;
  } catch (error) {
    console.error('[routine-plan/ensure]', error);
    const payload: Record<string, unknown> = {
      error: 'Day Plan 조회/생성에 실패했습니다.',
    };
    if (isDebug) {
      payload.details = error instanceof Error ? error.message : String(error);
    }
    const res = NextResponse.json(payload, { status: 500 });
    res.headers.set('Server-Timing', t.header());
    res.headers.set('x-mr-trace', rid);
    return res;
  }
}
