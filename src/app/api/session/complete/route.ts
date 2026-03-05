/**
 * POST /api/session/complete
 *
 * 세션 완료 처리 (멱등, race-safe).
 * - status IN ('draft','started')일 때만 업데이트 → 첫 완료만 exercise_logs 저장
 * - session_plans: status='completed', completed_at, duration_seconds, completion_mode, exercise_logs
 * - progress: DB trigger session_sync_progress_on_plan_completed가 SSOT
 * - 응답: next_theme만 포함 (운동 리스트 예고 금지)
 *
 * 테마 4단계: total_sessions 기반 computePhase (8/12/16/20 균등 분배)
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { logSessionEvent, summarizeExerciseLogs } from '@/lib/session-events';
import { buildDedupeKey, tryAcquireDedupe } from '@/lib/request-dedupe';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { computePhase } from '@/lib/session/phase';

const ROUTE_COMPLETE = '/api/session/complete';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CompletionMode = 'all_done' | 'partial_done' | 'stop_early';

type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
};

const MAX_LOGS = 50;
const MAX_STR_LEN = 80;

/** Returns validated array or null if invalid. Empty array is valid. */
function parseAndValidateExerciseLogs(raw: unknown): ExerciseLogItem[] | null {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_LOGS) return null;

  const result: ExerciseLogItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;

    const templateId = typeof obj.templateId === 'string'
      ? obj.templateId.trim().slice(0, MAX_STR_LEN)
      : null;
    const name = typeof obj.name === 'string'
      ? obj.name.trim().slice(0, MAX_STR_LEN)
      : null;
    if (templateId === null || name === null) return null;

    let sets: number | null = null;
    if (typeof obj.sets === 'number' && Number.isFinite(obj.sets)) {
      sets = Math.min(20, Math.max(0, Math.floor(obj.sets)));
    }

    let reps: number | null = null;
    if (typeof obj.reps === 'number' && Number.isFinite(obj.reps)) {
      reps = Math.min(200, Math.max(0, Math.floor(obj.reps)));
    }

    let difficulty: number | null = null;
    if (typeof obj.difficulty === 'number' && Number.isFinite(obj.difficulty)) {
      difficulty = Math.min(5, Math.max(1, Math.floor(obj.difficulty)));
    }

    result.push({ templateId, name, sets, reps, difficulty });
  }
  return result;
}

/** PR4A-Delta: null/undefined → [] 보장. 응답 계약용. */
function toExerciseLogsArray(val: unknown): unknown[] {
  if (val == null) return [];
  if (!Array.isArray(val)) return [];
  return val;
}

const PHASE_LABELS = ['1순위 타겟', '2순위 타겟', '통합', '릴렉스'] as const;

/** total_sessions 기반 phase → 테마 라벨 (create/plan-generator와 동일 규칙) */
function getThemeForSession(totalSessions: number, sessionNumber: number): string {
  const total = Math.max(1, Math.min(20, totalSessions));
  const phase = computePhase(total, sessionNumber);
  return PHASE_LABELS[phase - 1];
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const sessionNumber = typeof body.session_number === 'number' ? Math.floor(body.session_number) : null;
    const durationSeconds = typeof body.duration_seconds === 'number' ? Math.max(0, body.duration_seconds) : null;
    const completionMode: CompletionMode | null = (
      ['all_done', 'partial_done', 'stop_early'] as CompletionMode[]
    ).includes(body.completion_mode as CompletionMode)
      ? (body.completion_mode as CompletionMode)
      : null;

    if (!sessionNumber || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다 (1 이상의 정수)');
    }
    if (durationSeconds === null) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'duration_seconds가 필요합니다 (0 이상의 숫자)');
    }
    if (!completionMode) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'completion_mode는 all_done|partial_done|stop_early 중 하나여야 합니다');
    }

    let exerciseLogsArray: ExerciseLogItem[];
    if (body.exercise_logs !== undefined && body.exercise_logs !== null) {
      const parsed = parseAndValidateExerciseLogs(body.exercise_logs);
      if (parsed === null) {
        return fail(400, ApiErrorCode.VALIDATION_FAILED, 'exercise_logs 형식이 올바르지 않습니다 (최대 50개, templateId/name 필수)');
      }
      exerciseLogsArray = parsed;
    } else {
      exerciseLogsArray = [];
    }

    const headerKey = req.headers.get('Idempotency-Key') ?? null;
    const dedupeKey = buildDedupeKey({
      route: ROUTE_COMPLETE,
      userId,
      sessionNumber,
      headerKey,
    });
    const supabase = getServerSupabaseAdmin();

    // P0-09: progress 조회 — session_number > total_sessions, completed_sessions >= total 검증용
    const { data: progress } = await supabase
      .from('session_program_progress')
      .select('total_sessions, completed_sessions')
      .eq('user_id', userId)
      .maybeSingle();

    const totalSessions = progress?.total_sessions ?? 16;
    if (sessionNumber > totalSessions) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'blocked',
        code: 'PROGRAM_FINISHED',
        sessionNumber,
        meta: { total_sessions: totalSessions },
      });
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다');
    }

    const acquired = await tryAcquireDedupe(supabase, {
      route: ROUTE_COMPLETE,
      userId,
      dedupeKey,
      sessionNumber,
      ttlSeconds: 10,
    });
    if (!acquired) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'request_deduped',
        status: 'blocked',
        code: 'REQUEST_DEDUPED',
        sessionNumber,
        meta: { route: ROUTE_COMPLETE },
      });
      return fail(409, ApiErrorCode.REQUEST_DEDUPED, '요청이 처리 중입니다. 잠시 후 다시 시도하세요');
    }

    const nowIso = new Date().toISOString();
    const durationClamped = Math.min(7200, Math.max(0, durationSeconds));

    const planUpdatePayload: Record<string, unknown> = {
      status: 'completed',
      completed_at: nowIso,
      duration_seconds: durationClamped,
      completion_mode: completionMode,
      exercise_logs: exerciseLogsArray,
    };

    // Race-safe: only first completion writes (status IN draft|started)
    const { data: updatedRows, error: planUpdateErr } = await supabase
      .from('session_plans')
      .update(planUpdatePayload)
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .in('status', ['draft', 'started'])
      .select('status, exercise_logs');

    if (planUpdateErr) {
      console.error('[session/complete] plan update failed', planUpdateErr);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'error',
        code: 'DB_ERROR',
        sessionNumber,
        meta: { message_short: 'plan update failed' },
      });
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 완료 업데이트에 실패했습니다');
    }

    if (updatedRows && updatedRows.length >= 1) {
      // First completion — DB trigger syncs progress
      const logsSummary = summarizeExerciseLogs(exerciseLogsArray);
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete',
        status: 'ok',
        sessionNumber,
        meta: {
          duration_seconds: durationClamped,
          completion_mode: completionMode,
          logs_summary: logsSummary,
        },
      });
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const newCompleted = Math.max(progress?.completed_sessions ?? 0, sessionNumber);
      const nextNum = newCompleted + 1;
      const totalSessions = progress?.total_sessions ?? 16;
      const nextTheme = progress && nextNum <= totalSessions ? getThemeForSession(totalSessions, nextNum) : null;

      const data = { progress: progress ?? null, next_theme: nextTheme, idempotent: false, exercise_logs: exerciseLogsArray };
      return ok(data, data);
    }

    // 0 rows updated — plan not found, already completed, or concurrent
    const { data: planRow } = await supabase
      .from('session_plans')
      .select('status, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (!planRow) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'blocked',
        code: 'NOT_FOUND',
        sessionNumber,
        meta: {},
      });
      return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '해당 세션 플랜을 찾을 수 없습니다');
    }

    // P0-09: 프로그램 종료 상태에서 미완료 세션 완료 시도 → 409
    const completedSessions = progress?.completed_sessions ?? 0;
    if (completedSessions >= totalSessions && planRow.status !== 'completed') {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'blocked',
        code: 'PROGRAM_FINISHED',
        sessionNumber,
        meta: { completed_sessions: completedSessions, total_sessions: totalSessions },
      });
      return fail(409, ApiErrorCode.PROGRAM_FINISHED, '모든 세션을 완료했습니다');
    }

    if (planRow.status === 'completed') {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_idempotent',
        status: 'ok',
        sessionNumber,
        meta: { returned_stored: true },
      });
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const nextNum = (progress?.completed_sessions ?? sessionNumber) + 1;
      const totalSessions = progress?.total_sessions ?? 16;
      const nextTheme = progress && nextNum <= totalSessions ? getThemeForSession(totalSessions, nextNum) : null;

      const data = { progress: progress ?? null, next_theme: nextTheme, idempotent: true, exercise_logs: toExerciseLogsArray(planRow.exercise_logs) };
      return ok(data, data);
    }

    void logSessionEvent(supabase, {
      userId,
      eventType: 'session_complete_blocked',
      status: 'blocked',
      code: 'CONCURRENT_UPDATE',
      sessionNumber,
      meta: {},
    });
    return fail(409, ApiErrorCode.CONCURRENT_UPDATE, '동시 업데이트가 감지되었습니다. 잠시 후 다시 시도해 주세요');
  } catch (err) {
    console.error('[session/complete]', err);
    try {
      const userId = await getCurrentUserId(req);
      if (userId) {
        const supabase = getServerSupabaseAdmin();
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_complete_blocked',
          status: 'error',
          code: 'INTERNAL',
          meta: { message_short: err instanceof Error ? err.message : '서버 오류' },
        });
      }
    } catch (_) { /* noop */ }
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
