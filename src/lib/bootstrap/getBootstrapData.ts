/**
 * Bootstrap composer — assembles minimal summary for app init.
 * Read-only. No writes, no side effects.
 * user + home are critical; stats_summary and my_summary use safe fallbacks on failure.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserSummary } from './queries/getUserSummary';
import { getHomeSummary } from './queries/getHomeSummary';
import { getStatsSummary } from './queries/getStatsSummary';
import { getMySummary } from './queries/getMySummary';
import type { BootstrapData, BootstrapDebugTimings } from './types';

export type GetBootstrapDataResult =
  | { ok: true; data: BootstrapData; timings?: BootstrapDebugTimings }
  | { ok: false; status: number; message: string };

export async function getBootstrapData(
  supabase: SupabaseClient,
  userId: string,
  opts?: { debug?: boolean }
): Promise<GetBootstrapDataResult> {
  const t0 = opts?.debug ? performance.now() : 0;
  const timings: BootstrapDebugTimings = {
    auth_ms: 0,
    user_ms: 0,
    home_ms: 0,
    stats_ms: 0,
    my_ms: 0,
    total_ms: 0,
  };

  try {
    const measure = async <T>(
      fn: () => Promise<T>,
      setMs: (ms: number) => void
    ): Promise<T> => {
      const t0 = performance.now();
      const r = await fn();
      if (opts?.debug) setMs(Math.round(performance.now() - t0));
      return r;
    };

    const [user, home, statsResult, myResult] = await Promise.all([
      measure(() => getUserSummary(supabase, userId), (ms) => { timings.user_ms = ms; }),
      measure(() => getHomeSummary(supabase, userId), (ms) => { timings.home_ms = ms; }),
      measure(
        () =>
          getStatsSummary(supabase, userId).catch(() => ({
            completed_sessions: 0,
            completion_rate: 0,
            streak_days: 0,
            last_checkin_at: null as string | null,
          })),
        (ms) => { timings.stats_ms = ms; }
      ),
      measure(
        () => getMySummary(supabase, userId).catch(() => null),
        (ms) => { timings.my_ms = ms; }
      ),
    ]);

    const statsSummary = statsResult;
    const mySummary = myResult ?? {
      display_name: user.display_name,
      plan_status: user.plan_status,
      program_label: '주 4회 / 총 16세션',
      joined_at: null as string | null,
    };

    if (opts?.debug) {
      timings.total_ms = Math.round(performance.now() - t0);
    }

    const data: BootstrapData = {
      user,
      home,
      stats_summary: statsSummary,
      my_summary: mySummary,
    };

    return {
      ok: true,
      data,
      ...(opts?.debug && { timings }),
    };
  } catch (err) {
    console.error('[bootstrap]', err);
    return {
      ok: false,
      status: 500,
      message: err instanceof Error ? err.message : '서버 오류',
    };
  }
}
