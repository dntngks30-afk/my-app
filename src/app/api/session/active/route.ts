/**
 * GET /api/session/active
 *
 * 진행 중(active_session_number) 세션을 반환. 없으면 active:null.
 * progress row가 없으면 자동 upsert (total_sessions는 profile 기반, 없으면 16).
 *
 * BE-ONB-02: session_user_profile.target_frequency → total_sessions(8/12/16/20) 연동.
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 *
 * Auth: Bearer token (Authorization: Bearer <access_token>)
 *   프로젝트 전체가 Bearer 기반 인프라(@supabase/ssr 미설치, PKCE+localStorage)이므로
 *   Bearer 방식으로 일관성 유지. 쿠키 세션 전환은 별도 인프라 PR 필요.
 *
 * Write: getServerSupabaseAdmin (service role) — RLS bypass, 클라 direct write 차단됨.
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

/** BE-ONB-02: profile.target_frequency → total_sessions. 없으면 16. */
async function resolveTotalSessions(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<{ totalSessions: number; source: 'profile' | 'default' }> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return { totalSessions: FREQUENCY_TO_TOTAL[freq], source: 'profile' };
  }
  return { totalSessions: DEFAULT_TOTAL_SESSIONS, source: 'default' };
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    // progress 조회 — 없으면 자동 생성(upsert)
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
        console.error('[session/active] progress init failed', insertErr);
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
      // BE-ONB-02: progress 있음 + profile 존재 시 안전 조건일 때만 sync
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
        } else if (resolved.totalSessions < completed) {
          console.warn('[session/active] sync skipped: resolved < completed_sessions');
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
      const data = { progress, active: null, today_completed: todayCompleted, ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }) };
      return ok(data, data);
    }

    // active 세션 플랜 조회
    const { data: plan, error: planErr } = await supabase
      .from('session_plans')
      .select('id, session_number, status, theme, plan_json, condition, created_at, started_at')
      .eq('user_id', userId)
      .eq('session_number', activeSessionNumber)
      .maybeSingle();

    if (planErr) {
      console.error('[session/active] plan fetch failed', planErr);
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
      sessionNumber: activeSessionNumber ?? undefined,
      meta: { has_active: !!activeSessionNumber, today_completed: todayCompleted },
    });

    const data = { progress, active: plan ?? null, today_completed: todayCompleted, ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }) };
    return ok(data, data);
  } catch (err) {
    console.error('[session/active]', err);
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
    } catch (_) { /* noop */ }
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
