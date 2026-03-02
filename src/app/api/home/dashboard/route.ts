/**
 * GET /api/home/dashboard
 *
 * Home 화면 전용 단일 엔드포인트.
 * status + routine list + latestRoutineId를 1회 응답.
 * requireActivePlan. debug=1 시 timings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { checkAndUpdateRoutineStatus } from '@/lib/routine-engine';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = ['icn1'];

const MS_24H = 24 * 60 * 60 * 1000;

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
    const [statusResult, routinesRes, completionResult] = await Promise.all([
      checkAndUpdateRoutineStatus(userId),
      supabase
        .from('workout_routines')
        .select('id, created_at, started_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
      (async () => {
        const { data: ur } = await supabase
          .from('user_routines')
          .select('current_day')
          .eq('user_id', userId)
          .maybeSingle();
        const day = ur?.current_day ?? 1;
        return supabase
          .from('routine_completions')
          .select('id')
          .eq('user_id', userId)
          .eq('day_number', day)
          .limit(1)
          .maybeSingle();
      })(),
    ]);
    const tRoutines = performance.now();

    const state = statusResult.state;
    const server_now_utc = new Date().toISOString();
    const baseAtUtc = state.lastActivatedAt;
    let lock_until_utc: string | null = null;
    let rest_recommended = false;
    if (baseAtUtc) {
      const baseMs = new Date(baseAtUtc).getTime();
      const elapsed = Date.now() - baseMs;
      lock_until_utc = new Date(baseMs + MS_24H).toISOString();
      rest_recommended = elapsed < MS_24H;
    }
    const tProgress = tRoutines;

    const todayCompletedForDay = !!completionResult?.data;

    const routines = routinesRes.data ?? [];
    const latestRoutineId = routines[0]?.id ?? null;

    const payload: Record<string, unknown> = {
      success: true,
      user: { id: userId },
      routine: {
        latestRoutineId,
        currentDay: state.currentDay,
        started_at: routines[0]?.started_at ?? null,
      },
      progress: {
        status: state.status,
        lastActivatedAt: state.lastActivatedAt,
      },
      state,
      todayCompletedForDay,
      server_now_utc,
      lock_until_utc,
      rest_recommended,
    };

    const tEnd = performance.now();
    if (isDebug) {
      payload.timings = {
        t_auth: Math.round(tAuth - t0),
        t_routines_parallel: Math.round(tRoutines - tRoutinesStart),
        t_total: Math.round(tEnd - t0),
      };
      if (auth.timings) {
        (payload.timings as Record<string, number>).t_auth_user = auth.timings.t_auth_user;
        (payload.timings as Record<string, number>).t_auth_plan = auth.timings.t_auth_plan;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[home/dashboard] timings', payload.timings);
      }
    }

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    if (isDebug && payload.timings) {
      const t = payload.timings as Record<string, number>;
      const parts = [
        `auth;dur=${t.t_auth ?? 0}`,
        `routines_parallel;dur=${t.t_routines_parallel ?? 0}`,
        `total;dur=${t.t_total ?? 0}`,
      ];
      res.headers.set('Server-Timing', parts.join(', '));
    }
    return res;
  } catch (err) {
    console.error('[home/dashboard]', err);
    const errPayload: Record<string, unknown> = { error: '대시보드 조회에 실패했습니다.' };
    if (isDebug) errPayload.details = err instanceof Error ? err.message : String(err);
    return NextResponse.json(errPayload, { status: 500 });
  }
}
