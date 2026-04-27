/**
 * active-lite 데이터 조회 로직 — route와 bootstrap에서 공유
 * Auth는 호출자가 처리. 이 모듈은 userId + supabase만 사용.
 *
 * Read-only: progress insert/update, event log 제거 (홈 첫 진입 critical path 경량화).
 * progress 없으면 safe default 반환. 생성은 session/create 또는 session/profile에서 수행.
 *
 * rail_ready: session_program_progress 행이 DB에 실제로 존재할 때만 true.
 * (세션 실행 가능 여부·RAIL_NOT_READY와 동일 의미 아님 — UI가 가짜 16칸 맵을 그리지 않도록 구분용.)
 */

import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import type { ActiveSessionLiteResponse } from './client';

const DEFAULT_TOTAL_SESSIONS = 16;

export type ActiveLiteSummary = { session_number: number; status: string };

export type FetchActiveLiteResult =
  | { ok: true; data: ActiveSessionLiteResponse }
  | { ok: false; status: number; code: string; message: string };

export type FetchActiveLiteOpts = {
  /** debug 시 단계별 ms 기록 (progress_read_ms, session_lookup_ms, write_ms) */
  timings?: Record<string, number>;
};

export async function fetchActiveLiteData(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase').getServerSupabaseAdmin>>,
  userId: string,
  opts?: FetchActiveLiteOpts
): Promise<FetchActiveLiteResult> {
  const timings = opts?.timings;
  const t0 = timings ? performance.now() : 0;

  try {
    const [progressRes, planStatusRes] = await Promise.all([
      supabase
        .from('session_program_progress')
        .select(
          'user_id, total_sessions, completed_sessions, active_session_number, last_completed_day_key, last_completed_at, updated_at'
        )
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('users').select('plan_status').eq('id', userId).maybeSingle(),
    ]);

    if (timings) timings.progress_read_ms = Math.round(performance.now() - t0);
    if (timings) timings.write_ms = 0;

    const planStatus = (planStatusRes.data as { plan_status?: string } | null)?.plan_status ?? null;
    const hadDbProgress = progressRes.data != null;
    let progress = progressRes.data;

    if (!progress) {
      progress = {
        user_id: userId,
        total_sessions: DEFAULT_TOTAL_SESSIONS,
        completed_sessions: 0,
        active_session_number: null,
        last_completed_day_key: null,
        last_completed_at: null,
        updated_at: '',
      };
    }

    const railMeta = {
      rail_ready: hadDbProgress,
      progress_source: hadDbProgress ? ('db' as const) : ('default_fallback' as const),
    };

    const activeSessionNumber = progress.active_session_number;
    const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(progress);

    if (!activeSessionNumber) {
      if (timings) timings.session_lookup_ms = 0;
      if (timings) timings.extra_ms = Math.round(performance.now() - t0) - (timings.progress_read_ms ?? 0);
      return {
        ok: true,
        data: {
          progress,
          active: null,
          today_completed: todayCompleted,
          plan_status: planStatus,
          ...railMeta,
          ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
        },
      };
    }

    const tPlan = timings ? performance.now() : 0;
    const { data: planRow, error: planErr } = await supabase
      .from('session_plans')
      .select('session_number, status')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();

    if (timings) timings.session_lookup_ms = Math.round(performance.now() - tPlan);
    if (timings) timings.extra_ms = Math.round(performance.now() - t0) - (timings.progress_read_ms ?? 0) - (timings.session_lookup_ms ?? 0);

    if (planErr) {
      console.error('[active-lite-data] plan fetch failed', planErr);
      return { ok: false, status: 500, code: 'DB_ERROR', message: '세션 플랜 조회에 실패했습니다' };
    }

    const active: ActiveLiteSummary | null = planRow
      ? { session_number: planRow.session_number, status: planRow.status ?? 'draft' }
      : null;

    return {
      ok: true,
      data: {
        progress,
        active,
        today_completed: todayCompleted,
        plan_status: planStatus,
        ...railMeta,
        ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }),
      },
    };
  } catch (err) {
    console.error('[active-lite-data]', err);
    return {
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: err instanceof Error ? err.message : '서버 오류',
    };
  }
}
