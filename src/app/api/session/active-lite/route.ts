/**
 * GET /api/session/active-lite
 *
 * Home 초기 로드용 경량 엔드포인트. plan_json, condition 등 제외.
 * progress + today_completed + next_unlock_at + active(session_number, status)만 반환.
 * 상세 plan은 패널/플레이어 오픈 시 /api/session/plan으로 별도 조회.
 *
 * Auth: Bearer token (getCurrentUserId → getClaims 우선)
 * Perf: ?debug=1 → Server-Timing + data.timings for latency breakdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getTodayCompletedAndNextUnlock } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function addTimingHeaders(res: NextResponse, timings: Record<string, number>, isDebug: boolean): Response {
  if (!isDebug || Object.keys(timings).length === 0) return res;
  const parts = Object.entries(timings).map(([k, v]) => `${k};dur=${v}`);
  const next = res.clone();
  next.headers.set('Server-Timing', parts.join(', '));
  return next;
}

function logTimingBreakdown(timings: Record<string, number>, path: string): void {
  const lines = [
    '[session/active-lite] perf',
    `  auth_ms: ${timings.auth_ms ?? '-'}`,
    `  progress_db_ms: ${timings.progress_db_ms ?? '-'}`,
    `  plan_status_db_ms: ${timings.plan_status_db_ms ?? '-'}`,
    `  profile_db_ms: ${timings.profile_db_ms ?? '-'}`,
    `  progress_init_ms: ${timings.progress_init_ms ?? '-'}`,
    `  progress_sync_ms: ${timings.progress_sync_ms ?? '-'}`,
    `  active_plan_db_ms: ${timings.active_plan_db_ms ?? '-'}`,
    `  processing_ms: ${timings.processing_ms ?? '-'}`,
    `  event_log_ms: ${timings.event_log_ms ?? '-'}`,
    `  total_ms: ${timings.total_ms ?? '-'}`,
    `  path: ${path}`,
  ];
  console.info(lines.join('\n'));
}

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const isDebug = new URL(req.url).searchParams.get('debug') === '1';
  const timings: Record<string, number> = {};

  try {
    const userId = await getCurrentUserId(req);
    timings.auth_ms = Math.round(performance.now() - t0);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const tProgressStart = performance.now();

    const [progressRes, planStatusRes] = await Promise.all([
      supabase
        .from('session_program_progress')
        .select('user_id, total_sessions, completed_sessions, active_session_number, last_completed_day_key')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('users').select('plan_status').eq('id', userId).maybeSingle(),
    ]);

    const parallelDbMs = Math.round(performance.now() - tProgressStart);
    timings.progress_db_ms = parallelDbMs;
    timings.plan_status_db_ms = parallelDbMs;
    const planStatus = (planStatusRes.data as { plan_status?: string } | null)?.plan_status ?? null;
    let progress = progressRes.data;

    if (!progress) {
      const tResolveStart = performance.now();
      const resolved = await resolveTotalSessions(supabase, userId);
      timings.profile_db_ms = Math.round(performance.now() - tResolveStart);
      const tInsertStart = performance.now();
      const { data: created, error: insertErr } = await supabase
        .from('session_program_progress')
        .insert({
          user_id: userId,
          total_sessions: resolved.totalSessions,
          completed_sessions: 0,
          active_session_number: null,
        })
        .select('user_id, total_sessions, completed_sessions, active_session_number, last_completed_day_key')
        .single();

      timings.progress_init_ms = Math.round(performance.now() - tInsertStart);
      if (insertErr || !created) {
        console.error('[session/active-lite] progress init failed', insertErr);
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_active_read',
          status: 'error',
          code: 'DB_ERROR',
          meta: { message_short: 'progress init failed' },
        });
        return fail(500, ApiErrorCode.INTERNAL_ERROR, '진행 상태 초기화에 실패했습니다');
      }
      progress = created;
    } else {
      const activeSessionNumber = progress.active_session_number;
      if (activeSessionNumber === null) {
        const tResolveStart = performance.now();
        const resolved = await resolveTotalSessions(supabase, userId);
        timings.profile_db_ms = Math.round(performance.now() - tResolveStart);
        const completed = progress.completed_sessions ?? 0;
        const safeToSync =
          resolved.totalSessions >= completed && progress.total_sessions !== resolved.totalSessions;
        if (safeToSync) {
          timings.progress_sync_ms = 0;
          void supabase
            .from('session_program_progress')
            .update({ total_sessions: resolved.totalSessions })
            .eq('user_id', userId)
            .then(() => {});
        }
      }
    }

    const activeSessionNumber = progress.active_session_number;
    const tProcessingStart = performance.now();
    const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(progress);
    timings.processing_ms = Math.round(performance.now() - tProcessingStart);

    if (!activeSessionNumber) {
      timings.event_log_ms = 0;
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_active_read',
        status: 'ok',
        meta: { has_active: false, today_completed: todayCompleted },
      });
      timings.total_ms = Math.round(performance.now() - t0);
      if (isDebug) logTimingBreakdown(timings, 'no_active');
      const data = {
        progress,
        active: null as ActiveLiteSummary | null,
        today_completed: todayCompleted,
        plan_status: planStatus,
        ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
      };
      return addTimingHeaders(ok(data, isDebug ? { timings } : undefined), timings, isDebug);
    }

    // 경량 조회: session_number, status만 (plan_json 제외)
    const tPlanStart = performance.now();
    const { data: planRow, error: planErr } = await supabase
      .from('session_plans')
      .select('session_number, status')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();

    if (planErr) {
      console.error('[session/active-lite] plan fetch failed', planErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_active_read',
        status: 'error',
        code: 'DB_ERROR',
        meta: { message_short: 'plan fetch failed' },
      });
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 조회에 실패했습니다');
    }

    timings.active_plan_db_ms = Math.round(performance.now() - tPlanStart);
    timings.total_ms = Math.round(performance.now() - t0);
    if (isDebug) logTimingBreakdown(timings, 'with_active');

    timings.event_log_ms = 0;
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

    const data = {
      progress,
      active,
      today_completed: todayCompleted,
      plan_status: planStatus,
      ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }),
    };
    return addTimingHeaders(ok(data, isDebug ? { timings } : undefined), timings, isDebug);
  } catch (err) {
    console.error('[session/active-lite]', err);
    try {
      const userId = await getCurrentUserId(req);
      if (userId) {
        const supabase = getServerSupabaseAdmin();
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_active_read',
          status: 'error',
          code: 'INTERNAL',
          meta: { message_short: err instanceof Error ? err.message : '서버 오류' },
        });
      }
    } catch (_) {
      /* noop */
    }
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
