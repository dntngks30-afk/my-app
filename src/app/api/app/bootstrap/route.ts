import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { loadSessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { buildSessionBootstrapSummary } from '@/lib/session/bootstrap-summary';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AppBootstrapData = {
  user: {
    id: string;
    plan_status: string | null;
  };
  session: {
    active_session: { session_number: number; status: string } | null;
    completed_sessions: number;
    total_sessions: number;
    today_completed?: boolean;
    next_unlock_at?: string | null;
  };
  next_session: {
    session_number: number;
    focus_axes: string[];
    estimated_time: number;
  } | null;
  stats_preview: {
    completed_sessions: number;
    weekly_streak: number;
  };
};

function estimateMinutesFromPlanJson(planJson: unknown): number {
  const segments = (planJson as {
    segments?: Array<{ duration_sec?: number; items?: unknown[] }>;
  } | null)?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return 0;
  const totalSeconds = segments.reduce((sum, segment) => {
    if (typeof segment.duration_sec === 'number' && Number.isFinite(segment.duration_sec)) {
      return sum + segment.duration_sec;
    }
    return sum + (Array.isArray(segment.items) ? segment.items.length * 300 : 0);
  }, 0);
  return Math.max(1, Math.round(totalSeconds / 60));
}

function getWeeklyStreak(progress: { completed_sessions?: number; last_completed_day_key?: string | null } | null): number {
  const completed = progress?.completed_sessions ?? 0;
  const lastDayKey = progress?.last_completed_day_key;
  if (typeof lastDayKey === 'string' && lastDayKey.length >= 10) return 1;
  return completed > 0 ? Math.min(completed, 7) : 0;
}

async function loadNextSessionPreview(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase').getServerSupabaseAdmin>>,
  userId: string,
  activeSession: { session_number: number; status: string } | null,
  session: { completed_sessions: number; total_sessions: number; today_completed?: boolean }
): Promise<AppBootstrapData['next_session']> {
  try {
    if (activeSession?.session_number) {
      const { data: row } = await supabase
        .from('session_plans')
        .select('session_number, plan_json')
        .eq('user_id', userId)
        .eq('session_number', activeSession.session_number)
        .maybeSingle();

      const planJson = row?.plan_json as {
        meta?: { session_focus_axes?: string[] };
      } | null;

      return {
        session_number: row?.session_number ?? activeSession.session_number,
        focus_axes: Array.isArray(planJson?.meta?.session_focus_axes)
          ? planJson.meta.session_focus_axes
          : [],
        estimated_time: estimateMinutesFromPlanJson(planJson),
      };
    }

    if (session.today_completed) return null;

    const nextSessionNumber = session.completed_sessions + 1;
    if (nextSessionNumber > session.total_sessions) return null;

    const deepSummary = await loadSessionDeepSummary(userId);
    if (!deepSummary) return null;

    const summary = await buildSessionBootstrapSummary({
      sessionNumber: nextSessionNumber,
      deepSummary,
    });

    return {
      session_number: nextSessionNumber,
      focus_axes: summary.focus_axes,
      estimated_time: Math.max(1, Math.round(summary.estimated_duration / 60)),
    };
  } catch (err) {
    console.warn('[app/bootstrap] next_session preview fallback', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const isDebug = req.nextUrl.searchParams.get('debug') === '1';
  const timings: Record<string, number> = {};

  try {
    const userId = await getCurrentUserId(req);
    timings.auth_ms = Math.round(performance.now() - t0);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const tSession = performance.now();
    const activeLite = await fetchActiveLiteData(supabase, userId);
    timings.session_ms = Math.round(performance.now() - tSession);

    if (!activeLite.ok) {
      return fail(
        activeLite.status,
        (activeLite.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeLite.message
      );
    }

    const sessionData = {
      active_session: activeLite.data.active,
      completed_sessions: activeLite.data.progress.completed_sessions ?? 0,
      total_sessions: activeLite.data.progress.total_sessions ?? 16,
      today_completed: activeLite.data.today_completed === true,
      next_unlock_at: activeLite.data.next_unlock_at ?? null,
    };

    const tNext = performance.now();
    const nextSession = await loadNextSessionPreview(
      supabase,
      userId,
      activeLite.data.active,
      sessionData
    );
    timings.next_session_ms = Math.round(performance.now() - tNext);

    const data: AppBootstrapData = {
      user: {
        id: userId,
        plan_status: activeLite.data.plan_status ?? null,
      },
      session: sessionData,
      next_session: nextSession,
      stats_preview: {
        completed_sessions: activeLite.data.progress.completed_sessions ?? 0,
        weekly_streak: getWeeklyStreak(activeLite.data.progress),
      },
    };

    if (isDebug) {
      timings.total_ms = Math.round(performance.now() - t0);
      return ok(data, { timings });
    }

    return ok(data);
  } catch (err) {
    console.error('[app/bootstrap]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
