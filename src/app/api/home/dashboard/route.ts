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

    const [statusResult, routinesRes] = await Promise.all([
      checkAndUpdateRoutineStatus(userId),
      supabase
        .from('workout_routines')
        .select('id, created_at, status, started_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const tQueries = performance.now();

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

    const { data: completionRow } = await supabase
      .from('routine_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('day_number', state.currentDay)
      .limit(1)
      .maybeSingle();

    const todayCompletedForDay = !!completionRow;

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
        t_query_status: Math.round(tQueries - tAuth),
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
    return res;
  } catch (err) {
    console.error('[home/dashboard]', err);
    return NextResponse.json(
      { error: '대시보드 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
