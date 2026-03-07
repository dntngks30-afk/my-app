/**
 * GET /api/session/active-lite
 *
 * Home 초기 로드용 경량 엔드포인트. plan_json, condition 등 제외.
 * progress + today_completed + next_unlock_at + active(session_number, status)만 반환.
 * 상세 plan은 패널/플레이어 오픈 시 /api/session/plan으로 별도 조회.
 *
 * Auth: Bearer token (getCurrentUserId → getClaims 우선)
 */

import { NextRequest } from 'next/server';
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

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    let { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!progress) {
      const resolved = await resolveTotalSessions(supabase, userId);
      const { data: created, error: insertErr } = await supabase
        .from('session_program_progress')
        .insert({
          user_id: userId,
          total_sessions: resolved.totalSessions,
          completed_sessions: 0,
          active_session_number: null,
        })
        .select()
        .single();

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
        const resolved = await resolveTotalSessions(supabase, userId);
        const completed = progress.completed_sessions ?? 0;
        const safeToSync =
          resolved.totalSessions >= completed && progress.total_sessions !== resolved.totalSessions;
        if (safeToSync) {
          const { data: synced, error: syncErr } = await supabase
            .from('session_program_progress')
            .update({ total_sessions: resolved.totalSessions })
            .eq('user_id', userId)
            .select()
            .single();
          if (!syncErr && synced) progress = synced;
        }
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
      const data = {
        progress,
        active: null as ActiveLiteSummary | null,
        today_completed: todayCompleted,
        ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }),
      };
      return ok(data);
    }

    // 경량 조회: session_number, status만 (plan_json 제외)
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
      ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }),
    };
    return ok(data);
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
