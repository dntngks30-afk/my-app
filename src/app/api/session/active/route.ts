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
 *
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

/** ?debug=1 시 Server-Timing 헤더 추가. */
function addTimingHeaders(
  res: NextResponse,
  timings: Record<string, number>,
  isDebug: boolean
): NextResponse {
  if (!isDebug || Object.keys(timings).length === 0) return res;
  const parts = Object.entries(timings).map(([k, v]) => `${k};dur=${v}`);
  const next = res.clone();
  next.headers.set('Server-Timing', parts.join(', '));
  return next;
}

/** 서버 로그에 타이밍 breakdown 출력 (?debug=1 시). */
function logTimingBreakdown(timings: Record<string, number>, path: string): void {
  const lines = [
    '[session/active] perf',
    `  auth check: ${timings.auth_ms ?? '-'} ms`,
    `  DB query (progress): ${timings.progress_query_ms ?? '-'} ms`,
    `  DB query (profile): ${timings.profile_query_ms ?? '-'} ms`,
    `  DB insert (progress): ${timings.progress_insert_ms ?? '-'} ms`,
    `  DB sync (progress): ${timings.progress_sync_ms ?? '-'} ms`,
    `  DB query (plan): ${timings.plan_query_ms ?? '-'} ms`,
    `  processing logic: ${timings.processing_ms ?? '-'} ms`,
    `  total: ${timings.total_ms ?? '-'} ms`,
    `  path: ${path}`,
  ];
  console.info(lines.join('\n'));
}

type ResolvedTotal = {
  totalSessions: number;
  source: 'profile' | 'default';
  profile_present: boolean;
  target_frequency: number | null;
};

/** BE-ONB-02: profile.target_frequency → total_sessions. 없으면 16. P0: observability for default fallback. */
async function resolveTotalSessions(
  supabase: Awaited<ReturnType<typeof getServerSupabaseAdmin>>,
  userId: string
): Promise<ResolvedTotal> {
  const { data } = await supabase
    .from('session_user_profile')
    .select('target_frequency')
    .eq('user_id', userId)
    .maybeSingle();

  const freq = data?.target_frequency ?? null;
  const profilePresent = data != null;
  if (typeof freq === 'number' && freq in FREQUENCY_TO_TOTAL) {
    return { totalSessions: FREQUENCY_TO_TOTAL[freq], source: 'profile', profile_present: true, target_frequency: freq };
  }
  return { totalSessions: DEFAULT_TOTAL_SESSIONS, source: 'default', profile_present: profilePresent, target_frequency: freq };
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
    let lastResolved: ResolvedTotal | null = null;

    // progress 조회 — 없으면 자동 생성(upsert)
    let { data: progress } = await supabase
      .from('session_program_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    timings.progress_query_ms = Math.round(performance.now() - tProgressStart);

    if (!progress) {
      const tResolveStart = performance.now();
      const resolved = await resolveTotalSessions(supabase, userId);
      lastResolved = resolved;
      timings.profile_query_ms = Math.round(performance.now() - tResolveStart);

      if (resolved.source === 'default') {
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_active_read',
          status: 'blocked',
          code: 'FREQUENCY_REQUIRED',
          meta: {
            profile_present: resolved.profile_present,
            target_frequency: resolved.target_frequency,
            fallback_blocked: true,
          },
        });
        return fail(
          409,
          ApiErrorCode.FREQUENCY_REQUIRED,
          '주당 목표 빈도를 먼저 설정해 주세요. 심층 테스트 결과 보기에서 빈도를 선택한 후 다시 시도해 주세요.',
          { fallback_blocked: true, rail_ready: false }
        );
      }

      const tInsertStart = performance.now();
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

      timings.progress_insert_ms = Math.round(performance.now() - tInsertStart);
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
        const tResolveStart = performance.now();
        const resolved = await resolveTotalSessions(supabase, userId);
        lastResolved = resolved;
        timings.profile_query_ms = Math.round(performance.now() - tResolveStart);
        const completed = progress.completed_sessions ?? 0;
        const safeToSync =
          resolved.totalSessions >= completed && progress.total_sessions !== resolved.totalSessions;
        if (safeToSync) {
          const tSyncStart = performance.now();
          const { data: synced, error: syncErr } = await supabase
            .from('session_program_progress')
            .update({ total_sessions: resolved.totalSessions })
            .eq('user_id', userId)
            .select()
            .single();
          timings.progress_sync_ms = Math.round(performance.now() - tSyncStart);
          if (!syncErr && synced) progress = synced;
        } else if (resolved.totalSessions < completed) {
          console.warn('[session/active] sync skipped: resolved < completed_sessions', {
            resolved_total: resolved.totalSessions,
            completed_sessions: completed,
            profile_present: resolved.profile_present,
          });
          void logSessionEvent(supabase, {
            userId,
            eventType: 'session_active_read',
            status: 'ok',
            meta: {
              sync_skipped: true,
              reason: 'resolved_total_sessions_lt_completed',
              resolved_total: resolved.totalSessions,
              completed_sessions: completed,
            },
          });
        }
      }
    }

    const activeSessionNumber = progress.active_session_number;
    const tProcessingStart = performance.now();
    const { todayCompleted, nextUnlockAt } = getTodayCompletedAndNextUnlock(progress);
    timings.processing_ms = Math.round(performance.now() - tProcessingStart);

    if (!activeSessionNumber) {
      const meta: Record<string, unknown> = { has_active: false, today_completed: todayCompleted };
      if (lastResolved) {
        meta.freq_source = lastResolved.source;
        meta.profile_present = lastResolved.profile_present;
        meta.target_frequency = lastResolved.target_frequency;
        meta.total_sessions = lastResolved.totalSessions;
      }
      void logSessionEvent(supabase, { userId, eventType: 'session_active_read', status: 'ok', meta });
      timings.total_ms = Math.round(performance.now() - t0);
      if (isDebug) logTimingBreakdown(timings, 'no_active');
      const data = { progress, active: null, today_completed: todayCompleted, ...(nextUnlockAt != null && { next_unlock_at: nextUnlockAt }) };
      const debugExtras = isDebug && lastResolved
        ? { freq_source: lastResolved.source, profile_present: lastResolved.profile_present, target_frequency: lastResolved.target_frequency }
        : undefined;
      return addTimingHeaders(ok(data, isDebug ? { timings, ...debugExtras } : undefined), timings, isDebug);
    }

    // active 세션 플랜 조회
    const tPlanStart = performance.now();
    const { data: plan, error: planErr } = await supabase
      .from('session_plans')
      .select('session_number, status, theme, plan_json, condition, created_at, started_at')
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

    timings.plan_query_ms = Math.round(performance.now() - tPlanStart);
    timings.total_ms = Math.round(performance.now() - t0);
    if (isDebug) logTimingBreakdown(timings, 'with_active');

    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_active_read',
      status: 'ok',
      sessionNumber: activeSessionNumber ?? undefined,
      meta: { has_active: !!activeSessionNumber, today_completed: todayCompleted },
    });

    const data = { progress, active: plan ?? null, today_completed: todayCompleted, ...(nextUnlockAt && { next_unlock_at: nextUnlockAt }) };
    return addTimingHeaders(ok(data, isDebug ? { timings } : undefined), timings, isDebug);
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
