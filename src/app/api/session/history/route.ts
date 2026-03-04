/**
 * GET /api/session/history
 *
 * 완료된 세션 기록 SSOT. status='completed'만 노출.
 * 정렬: session_number DESC (최신 위). 스키마 고정, null 금지.
 *
 * Auth: Bearer token. 401 if not logged in.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { logSessionEvent } from '@/lib/session-events';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function toExerciseLogsArray(val: unknown): unknown[] {
  if (val == null) return [];
  if (!Array.isArray(val)) return [];
  return val;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(limitParam ?? '', 10) || DEFAULT_LIMIT)
    );

    const supabase = getServerSupabaseAdmin();

    const [progressRes, plansRes] = await Promise.all([
      supabase
        .from('session_program_progress')
        .select('completed_sessions, total_sessions, last_completed_at')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('session_plans')
        .select('session_number, completed_at, duration_seconds, completion_mode, theme, exercise_logs')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('session_number', { ascending: false })
        .limit(limit),
    ]);

    const progress = progressRes.data;
    const plans = plansRes.data ?? [];
    const progressErr = progressRes.error;
    const plansErr = plansRes.error;

    if (progressErr) {
      console.error('[session/history] progress fetch error', progressErr);
    }
    if (plansErr) {
      console.error('[session/history] plans fetch error', plansErr);
    }

    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_history_read',
      status: 'ok',
      meta: { limit, returned_count: plans.length },
    });

    const payload = {
      progress: {
        completed_sessions: progress?.completed_sessions ?? 0,
        total_sessions: progress?.total_sessions ?? 16,
        last_completed_at: progress?.last_completed_at ?? null,
      },
      items: plans.map((p) => ({
        session_number: p.session_number,
        theme: p.theme ?? '',
        completed_at: p.completed_at ?? '',
        duration_seconds: p.duration_seconds ?? 0,
        completion_mode: p.completion_mode ?? 'unknown',
        exercise_logs: toExerciseLogsArray((p as { exercise_logs?: unknown }).exercise_logs),
      })),
    };

    return ok(payload, payload);
  } catch (err) {
    console.error('[session/history]', err);
    try {
      const userId = await getCurrentUserId(req);
      if (userId) {
        const supabase = getServerSupabaseAdmin();
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_history_read',
          status: 'error',
          code: 'INTERNAL',
          meta: { message_short: err instanceof Error ? err.message : '서버 오류' },
        });
      }
    } catch (_) { /* noop */ }
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
