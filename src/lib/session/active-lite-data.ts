/**
 * active-lite 데이터 조회 로직 — route와 bootstrap에서 공유
 * Auth는 호출자가 처리. 이 모듈은 userId + supabase만 사용.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import type { ActiveSessionLiteResponse } from './client';

const DEFAULT_TOTAL_SESSIONS = 16;

const FREQUENCY_TO_TOTAL: Record<number, number> = {
  2: 8,
  3: 12,
  4: 16,
  5: 20,
};

async function resolveTotalSessions(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<{ totalSessions: number }> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return { totalSessions: FREQUENCY_TO_TOTAL[freq] };
  }
  return { totalSessions: DEFAULT_TOTAL_SESSIONS };
}

export type ActiveLiteSummary = { session_number: number; status: string };

export type FetchActiveLiteResult =
  | { ok: true; data: ActiveSessionLiteResponse }
  | { ok: false; status: number; code: string; message: string };

export async function fetchActiveLiteData(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<FetchActiveLiteResult> {
  try {
    const [progressRes, planStatusRes] = await Promise.all([
      supabase
        .from('session_program_progress')
        .select('user_id, total_sessions, completed_sessions, active_session_number, last_completed_day_key')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('users').select('plan_status').eq('id', userId).maybeSingle(),
    ]);

    const planStatus = (planStatusRes.data as { plan_status?: string } | null)?.plan_status ?? null;
    let progress = progressRes.data;

    if (!progress) {
      progress = {
        user_id: userId,
        total_sessions: DEFAULT_TOTAL_SESSIONS,
        completed_sessions: 0,
        active_session_number: null,
        last_completed_day_key: null,
      };
      void resolveTotalSessions(supabase, userId)
        .then((resolved) =>
          supabase
            .from('session_program_progress')
            .insert({
              user_id: userId,
              total_sessions: resolved.totalSessions,
              completed_sessions: 0,
              active_session_number: null,
            })
            .select('user_id, total_sessions, completed_sessions, active_session_number, last_completed_day_key')
            .single()
        )
        .then(({ error: insertErr }) => {
          if (insertErr) {
            console.error('[active-lite-data] progress init deferred failed', insertErr);
            void logSessionEvent(supabase, {
              userId,
              eventType: 'session_active_read',
              status: 'error',
              code: 'DB_ERROR',
              meta: { message_short: 'progress init deferred failed' },
            });
          }
        });
    } else {
      const activeSessionNumber = progress.active_session_number;
      if (activeSessionNumber === null) {
        const completed = progress.completed_sessions ?? 0;
        const totalSessions = progress.total_sessions;
        void resolveTotalSessions(supabase, userId).then((resolved) => {
          const safeToSync =
            resolved.totalSessions >= completed && totalSessions !== resolved.totalSessions;
          if (safeToSync) {
            void supabase
              .from('session_program_progress')
              .update({ total_sessions: resolved.totalSessions })
              .eq('user_id', userId)
              .then(() => {});
          }
        });
      }
    }

    const activeSessionNumber = progress.active_session_number;
    const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(progress);

    if (!activeSessionNumber) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_active_read',
        status: 'ok',
        meta: { has_active: false, today_completed: todayCompleted },
      });
      return {
        ok: true,
        data: {
          progress,
          active: null,
          today_completed: todayCompleted,
          plan_status: planStatus,
          ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
        },
      };
    }

    const { data: planRow, error: planErr } = await supabase
      .from('session_plans')
      .select('session_number, status')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();

    if (planErr) {
      console.error('[active-lite-data] plan fetch failed', planErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_active_read',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'plan fetch failed' },
      });
      return { ok: false, status: 500, code: 'DB_ERROR', message: '세션 플랜 조회에 실패했습니다' };
    }

    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_active_read',
      status: 'ok',
      sessionNumber: activeSessionNumber,
      meta: { has_active: true, today_completed: todayCompleted },
    });

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
