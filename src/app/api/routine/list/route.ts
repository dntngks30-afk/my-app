/**
 * GET /api/routine/list
 * 내 루틴 목록 조회 (허브용)
 * requireActivePlan. Bearer only, no-store.
 * debug=1 시 timings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = ['icn1'];

const ROUTINE_LIST_LIMIT = 20;

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const { searchParams } = new URL(req.url);
  const isDebug = searchParams.get('debug') === '1';

  try {
    const auth = await requireActivePlan(req, { recordTimings: isDebug });
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;
    const tAuth = performance.now();

    const supabase = getServerSupabaseAdmin();

    const tRoutinesStart = performance.now();
    const [routinesRes, userRoutinesRes] = await Promise.all([
      supabase
        .from('workout_routines')
        .select('id, created_at, status, started_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(ROUTINE_LIST_LIMIT),
      supabase
        .from('user_routines')
        .select('current_day')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    const tRoutines = performance.now();

    const { data: routines, error: routineError } = routinesRes;

    if (routineError) {
      console.error('[routine/list]', routineError);
      const errPayload: Record<string, unknown> = { error: '루틴 목록 조회 실패' };
      if (isDebug) errPayload.details = routineError.message;
      return NextResponse.json(errPayload, { status: 500 });
    }

    if (!routines?.length) {
      const tEnd = performance.now();
      const payload: Record<string, unknown> = { success: true, routines: [] };
      if (isDebug) {
        const t_auth = Math.round(tAuth - t0);
        const t_db = Math.round(tRoutines - tRoutinesStart);
        const t_compute = Math.round(tEnd - tRoutines);
        payload.timings = {
          t_auth,
          t_db,
          t_compute,
          t_routines: t_db,
          t_attendance: 0,
          t_total: Math.round(tEnd - t0),
        };
        if (auth.timings) {
          (payload.timings as Record<string, number>).t_auth_user = auth.timings.t_auth_user;
          (payload.timings as Record<string, number>).t_auth_plan = auth.timings.t_auth_plan;
        }
      }
      const res = NextResponse.json(payload);
      res.headers.set('Cache-Control', 'no-store, max-age=0');
      if (isDebug && payload.timings) {
        const t = payload.timings as Record<string, number>;
        res.headers.set('Server-Timing', [
          `auth;dur=${t.t_auth ?? 0}`,
          `db;dur=${t.t_db ?? 0}`,
          `compute;dur=${t.t_compute ?? 0}`,
          `total;dur=${t.t_total ?? 0}`,
        ].join(', '));
      }
      return res;
    }

    const ids = routines.map((r) => r.id);

    const tAttendanceStart = performance.now();
    const { data: daysRows, error: daysError } = await supabase
      .from('workout_routine_days')
      .select('routine_id, day_number, completed_at')
      .in('routine_id', ids as string[]);
    const tAttendance = performance.now();

    if (daysError) {
      console.error('[routine/list] days', daysError);
    }

    const daysByRoutine = new Map<string, { completed: number; lastCompletedDay: number }>();
    for (const r of routines) {
      daysByRoutine.set(r.id, { completed: 0, lastCompletedDay: 0 });
    }
    for (const d of daysRows ?? []) {
      const cur = daysByRoutine.get(d.routine_id);
      if (!cur) continue;
      if (d.completed_at) {
        cur.completed += 1;
        if (d.day_number > cur.lastCompletedDay) {
          cur.lastCompletedDay = d.day_number;
        }
      }
    }

    const currentDay = (userRoutinesRes.data as { current_day?: number } | null)?.current_day ?? 1;

    const routinesOut = routines.map((r) => {
      const progress = daysByRoutine.get(r.id) ?? { completed: 0, lastCompletedDay: 0 };
      const nextDay =
        progress.lastCompletedDay > 0
          ? Math.min(7, progress.lastCompletedDay + 1)
          : currentDay;
      return {
        id: r.id,
        created_at: r.created_at,
        status: r.status,
        started_at: r.started_at,
        completedDays: progress.completed,
        lastCompletedDay: progress.lastCompletedDay,
        nextDay,
      };
    });

    const tEnd = performance.now();
    const payload: Record<string, unknown> = {
      success: true,
      routines: routinesOut,
      currentDay,
    };
    if (isDebug) {
      const t_auth = Math.round(tAuth - t0);
      const t_db = Math.round(tAttendance - tRoutinesStart);
      const t_compute = Math.round(tEnd - tAttendance);
      payload.timings = {
        t_auth,
        t_db,
        t_compute,
        t_routines: Math.round(tRoutines - tRoutinesStart),
        t_attendance: Math.round(tAttendance - tAttendanceStart),
        t_total: Math.round(tEnd - t0),
      };
      if (auth.timings) {
        (payload.timings as Record<string, number>).t_auth_user = auth.timings.t_auth_user;
        (payload.timings as Record<string, number>).t_auth_plan = auth.timings.t_auth_plan;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[routine/list] timings', payload.timings);
      }
    }

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    if (isDebug && payload.timings) {
      const t = payload.timings as Record<string, number>;
      res.headers.set('Server-Timing', [
        `auth;dur=${t.t_auth ?? 0}`,
        `db;dur=${t.t_db ?? 0}`,
        `compute;dur=${t.t_compute ?? 0}`,
        `total;dur=${t.t_total ?? 0}`,
      ].join(', '));
    }
    return res;
  } catch (error) {
    console.error('[routine/list]', error);
    const errPayload: Record<string, unknown> = { error: '루틴 목록 조회 실패' };
    if (isDebug) errPayload.details = error instanceof Error ? error.message : String(error);
    return NextResponse.json(errPayload, { status: 500 });
  }
}
