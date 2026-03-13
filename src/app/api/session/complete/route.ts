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
import { buildSessionExerciseEvents, writeSessionExerciseEvents } from '@/lib/session/session-exercise-events';
import type { ExerciseLogItem } from '@/lib/session/types';
import { runEvaluatorAndUpsert, type AdaptiveSummaryDebug } from '@/lib/session/adaptive-evaluator';

/** Debug-only: insufficient_data when evaluator cannot produce a summary row */
type AdaptiveSummaryDebugOrInsufficient = AdaptiveSummaryDebug | { summary_status: 'insufficient_data' };
import { buildDedupeKey, tryAcquireDedupe } from '@/lib/request-dedupe';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { computePhase, type PhaseLengths } from '@/lib/session/phase';
import { normalizeSessionFeedbackPayload, saveSessionFeedback } from '@/lib/session/feedback';
import { buildExecutionSummary } from '@/lib/session/execution-summary';
import type { FeedbackPayload } from '@/lib/session/feedback-types';
import { evaluateEvidenceGate } from '@/lib/session/evidence-gate';

const ROUTE_COMPLETE = '/api/session/complete';

/** Player difficulty 1–5 → session_feedback.difficulty_feedback. Uses existing adaptive semantics. */
type DifficultyFeedbackValue = 'too_easy' | 'ok' | 'too_hard';

function deriveDifficultyFeedbackFromExerciseLogs(
  logs: ExerciseLogItem[]
): DifficultyFeedbackValue | null {
  const withDiff = logs.filter((l) => typeof l.difficulty === 'number' && l.difficulty >= 1 && l.difficulty <= 5);
  if (withDiff.length === 0) return null;
  const avg = withDiff.reduce((s, l) => s + (l.difficulty ?? 0), 0) / withDiff.length;
  if (avg <= 2) return 'too_easy';
  if (avg >= 4) return 'too_hard';
  return 'ok';
}

/** Merge derived session feedback when explicit feedback is missing. */
function ensureFeedbackWithDerivedDifficulty(
  feedbackPayload: FeedbackPayload | null,
  exerciseLogsArray: ExerciseLogItem[]
): FeedbackPayload | null {
  const hasExplicit = feedbackPayload?.sessionFeedback?.difficultyFeedback != null;
  if (hasExplicit) return feedbackPayload;

  const derived = deriveDifficultyFeedbackFromExerciseLogs(exerciseLogsArray);
  if (derived == null) return feedbackPayload;

  const sessionFeedback = feedbackPayload?.sessionFeedback ?? {};
  const merged: FeedbackPayload = {
    ...feedbackPayload,
    sessionFeedback: { ...sessionFeedback, difficultyFeedback: derived },
  };
  return merged;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type CompletionMode = 'all_done' | 'partial_done' | 'stop_early';

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

    let rpe: number | null = null;
    if (typeof obj.rpe === 'number' && Number.isFinite(obj.rpe)) {
      rpe = Math.min(10, Math.max(1, Math.floor(obj.rpe)));
    }

    let discomfort: number | null = null;
    if (typeof obj.discomfort === 'number' && Number.isFinite(obj.discomfort)) {
      discomfort = Math.min(10, Math.max(0, Math.floor(obj.discomfort)));
    }

    const plan_item_key = typeof obj.plan_item_key === 'string' && /^\d+:\d+:.+$/.test(obj.plan_item_key)
      ? obj.plan_item_key.trim().slice(0, 120)
      : undefined;
    const segment_index = typeof obj.segment_index === 'number' && Number.isInteger(obj.segment_index) ? obj.segment_index : undefined;
    const item_index = typeof obj.item_index === 'number' && Number.isInteger(obj.item_index) ? obj.item_index : undefined;

    result.push({
      templateId,
      name,
      sets,
      reps,
      difficulty,
      rpe,
      discomfort,
      ...(plan_item_key && { plan_item_key }),
      ...(segment_index !== undefined && { segment_index }),
      ...(item_index !== undefined && { item_index }),
    });
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

/** generation_trace_json에서 phase_lengths 추출 */
function getPhaseLengthsFromTrace(trace: unknown): PhaseLengths | null {
  if (!trace || typeof trace !== 'object') return null;
  const arr = (trace as Record<string, unknown>).phase_lengths;
  if (!Array.isArray(arr) || arr.length !== 4) return null;
  const nums = arr.map((x) => (typeof x === 'number' && Number.isInteger(x) && x >= 1 ? x : null));
  if (nums.some((n) => n === null)) return null;
  const sum = (nums as number[]).reduce((a, b) => a + b, 0);
  if (sum < 4 || sum > 20) return null;
  return nums as PhaseLengths;
}

/** total_sessions + optional phase_lengths → 테마 라벨 (create와 동일 phase 경계) */
function getThemeForSession(
  totalSessions: number,
  sessionNumber: number,
  phaseLengths?: PhaseLengths | null
): string {
  const total = Math.max(1, Math.min(20, totalSessions));
  const phase = computePhase(total, sessionNumber, { phaseLengths, policyOptions: null });
  return PHASE_LABELS[phase - 1];
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const isDebug = body.debug === true || new URL(req.url ?? '/').searchParams.get('debug') === '1';

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

    let feedbackPayload = normalizeSessionFeedbackPayload(body.feedback);
    feedbackPayload = ensureFeedbackWithDerivedDifficulty(feedbackPayload, exerciseLogsArray);

    const headerKey = req.headers.get('Idempotency-Key') ?? null;
    const dedupeKey = buildDedupeKey({
      route: ROUTE_COMPLETE,
      userId,
      sessionNumber,
      headerKey,
    });
    const supabase = getServerSupabaseAdmin();

    // P0-09: progress 조회 — session_number > total_sessions, completed_sessions >= total, active 가드
    const { data: progress } = await supabase
      .from('session_program_progress')
      .select('total_sessions, completed_sessions, active_session_number')
      .eq('user_id', userId)
      .maybeSingle();

    // 과거 세션 완료 차단 (read-only) — active 세션만 complete 허용
    const activeSessionNumber = progress?.active_session_number;
    if (activeSessionNumber !== sessionNumber) {
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'blocked',
        code: 'PAST_SESSION_READ_ONLY',
        sessionNumber,
        meta: { active_session_number: activeSessionNumber ?? null },
      });
      return fail(409, ApiErrorCode.PAST_SESSION_READ_ONLY, '과거 세션은 읽기 전용입니다. 현재 진행 중인 세션만 완료할 수 있습니다');
    }

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

    const { data: currentPlan } = await supabase
      .from('session_plans')
      .select('id, generation_trace_json, plan_json, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();
    const phaseLengthsForNext = getPhaseLengthsFromTrace(currentPlan?.generation_trace_json);

    // PR-EXEC-02: merge persisted logs — plan_item_key 우선, templateId fallback
    const dbLogs = currentPlan?.exercise_logs && Array.isArray(currentPlan.exercise_logs) ? (currentPlan.exercise_logs as Array<Record<string, unknown>>) : [];
    const clientByPlanItemKey = new Map<string, ExerciseLogItem>();
    const clientQueueByTemplateId = new Map<string, ExerciseLogItem[]>();
    for (const l of exerciseLogsArray) {
      if (l.plan_item_key) {
        clientByPlanItemKey.set(l.plan_item_key, l);
      } else {
        const q = clientQueueByTemplateId.get(l.templateId) ?? [];
        q.push(l);
        clientQueueByTemplateId.set(l.templateId, q);
      }
    }
    const dbByTemplateId = new Map<string, ExerciseLogItem>();
    for (const row of dbLogs) {
      const templateId = typeof row.templateId === 'string' ? row.templateId : null;
      const name = typeof row.name === 'string' ? row.name : '';
      if (templateId) {
        const sets = typeof row.sets === 'number' && Number.isFinite(row.sets) ? Math.min(20, Math.max(0, Math.floor(row.sets))) : null;
        const reps = typeof row.reps === 'number' && Number.isFinite(row.reps) ? Math.min(200, Math.max(0, Math.floor(row.reps))) : null;
        const difficulty = typeof row.difficulty === 'number' && Number.isFinite(row.difficulty) ? Math.min(5, Math.max(1, Math.floor(row.difficulty))) : null;
        const rpe = typeof row.rpe === 'number' && Number.isFinite(row.rpe) ? Math.min(10, Math.max(1, Math.floor(row.rpe))) : null;
        const discomfort = typeof row.discomfort === 'number' && Number.isFinite(row.discomfort) ? Math.min(10, Math.max(0, Math.floor(row.discomfort))) : null;
        dbByTemplateId.set(templateId, { templateId, name, sets, reps, difficulty: difficulty ?? null, rpe: rpe ?? null, discomfort: discomfort ?? null });
      }
    }
    const pj = currentPlan?.plan_json as { segments?: Array<{ items?: Array<{ templateId?: string }> }> } | null;
    const planItems: Array<{ plan_item_key: string; templateId: string }> = [];
    if (pj?.segments) {
      for (let segIdx = 0; segIdx < pj.segments.length; segIdx++) {
        const seg = pj.segments[segIdx]!;
        for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
          const tid = seg.items![itemIdx]?.templateId;
          if (typeof tid === 'string') {
            planItems.push({ plan_item_key: `${segIdx}:${itemIdx}:${tid}`, templateId: tid });
          }
        }
      }
    }
    const merged: ExerciseLogItem[] = [];
    for (const p of planItems) {
      let log = clientByPlanItemKey.get(p.plan_item_key);
      if (!log) {
        const q = clientQueueByTemplateId.get(p.templateId);
        log = q?.shift();
      }
      if (!log) log = dbByTemplateId.get(p.templateId) ?? undefined;
      if (log) {
        // PR-RISK-04: enrich with plan_item_key when missing (templateId fallback path)
        const parts = p.plan_item_key.split(':');
        const segIdx = parseInt(parts[0] ?? '0', 10);
        const itemIdx = parseInt(parts[1] ?? '0', 10);
        const enriched: ExerciseLogItem = log.plan_item_key
          ? log
          : { ...log, plan_item_key: p.plan_item_key, segment_index: segIdx, item_index: itemIdx };
        merged.push(enriched);
      }
    }
    exerciseLogsArray = merged.length > 0 ? merged : exerciseLogsArray;

    // PR-DATA-01: evidence gate — reject insufficient execution evidence before persisting
    const gateResult = evaluateEvidenceGate(
      currentPlan?.plan_json as Record<string, unknown> | null,
      exerciseLogsArray,
      feedbackPayload
    );
    if (!gateResult.allowed) {
      const obs = gateResult.observability;
      void logSessionEvent(supabase, {
        userId,
        eventType: 'session_complete_blocked',
        status: 'blocked',
        code: gateResult.code,
        sessionNumber,
        meta: {
          message: gateResult.message,
          evidence_gate: obs,
        },
      });
      const details = isDebug
        ? {
            total_items: obs.total_items,
            completed_items: obs.completed_items,
            completion_ratio: obs.completion_ratio,
            coverage_ratio: obs.coverage_ratio,
            main_completed: obs.main_segment_completed,
            with_performed_value: obs.performed_value_count,
            evidence_score: obs.evidence_score_total,
            received_exercise_logs_count: obs.received_exercise_logs_count,
            threshold_profile: obs.threshold_profile,
            reject_reason_code: obs.reject_reason_code ?? null,
            reject_reason_detail: obs.reject_reason_detail,
            ...(obs.identity_match && { identity_match: obs.identity_match }),
          }
        : undefined;
      return fail(422, gateResult.code as ApiErrorCode, gateResult.message, details);
    }

    const nowIso = new Date().toISOString();
    const durationClamped = Math.min(7200, Math.max(0, durationSeconds));

    const executionSummary = buildExecutionSummary(
      sessionNumber,
      nowIso,
      completionMode,
      feedbackPayload,
      !!feedbackPayload
    );

    // PR-DATA-01A: persist evidence gate observability on successful completion
    // PR-RISK-08a: allow path — evidence_gate in execution_summary_json + debug response when debug=1
    // PR-UX-00: pain_areas stored in execution_summary_json (no session_feedback schema change)
    const executionSummaryWithGate = {
      ...executionSummary,
      evidence_gate: gateResult.observability,
      pain_areas: feedbackPayload?.sessionFeedback?.painAreas ?? undefined,
    };

    const planUpdatePayload: Record<string, unknown> = {
      status: 'completed',
      completed_at: nowIso,
      duration_seconds: durationClamped,
      completion_mode: completionMode,
      exercise_logs: exerciseLogsArray,
      execution_summary_json: executionSummaryWithGate,
    };

    // Race-safe: only first completion writes (status IN draft|started)
    const { data: updatedRows, error: planUpdateErr } = await supabase
      .from('session_plans')
      .update(planUpdatePayload)
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .in('status', ['draft', 'started'])
      .select('id, status, exercise_logs');

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

      // PR-A: exercise-level session_exercise_events (truthful, no fake per-set)
      let eventLogResult: { attempted: number; written: number; failed: number } | undefined;
      let adaptiveSummary: AdaptiveSummaryDebugOrInsufficient | null = null;
      const planId = (updatedRows[0] as { id?: string }).id ?? currentPlan?.id;
      if (exerciseLogsArray.length > 0 && planId) {
        const eventRows = buildSessionExerciseEvents(exerciseLogsArray, currentPlan?.plan_json as Record<string, unknown> | null, {
          userId,
          sessionPlanId: planId,
          sessionNumber,
          completedAt: nowIso,
        });
        eventLogResult = await writeSessionExerciseEvents(supabase, eventRows);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[session/complete] event_log', { sessionNumber, ...eventLogResult });
        }
        // PR-B: run adaptive evaluator after event logging
        adaptiveSummary = await runEvaluatorAndUpsert(supabase, { userId, sessionPlanId: planId, sessionNumber });
      }
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const newCompleted = Math.max(progress?.completed_sessions ?? 0, sessionNumber);
      const nextNum = newCompleted + 1;
      const totalSessions = progress?.total_sessions ?? 16;
      const nextTheme =
        progress && nextNum <= totalSessions
          ? getThemeForSession(totalSessions, nextNum, phaseLengthsForNext)
          : null;

      let feedbackSaved = false;
      if (feedbackPayload) {
        const result = await saveSessionFeedback(supabase, feedbackPayload, {
          userId,
          sessionNumber,
          sessionPlanId: updatedRows?.[0] != null && 'id' in updatedRows[0] ? (updatedRows[0] as { id: string }).id : null,
        });
        feedbackSaved = result.saved;
      }

      const data = {
        progress: progress ?? null,
        next_theme: nextTheme,
        idempotent: false,
        exercise_logs: exerciseLogsArray,
        ...(feedbackPayload && { feedback_saved: feedbackSaved }),
      };
      const debugExtras: Record<string, unknown> = {};
      if (isDebug) debugExtras.evidence_gate = gateResult.observability;
      if (isDebug && eventLogResult) debugExtras.event_log = eventLogResult;
      if (isDebug && adaptiveSummary) debugExtras.adaptive_summary = adaptiveSummary;
      return ok(data, Object.keys(debugExtras).length > 0 ? { debug: debugExtras } : undefined);
    }

    // 0 rows updated — plan not found, already completed, or concurrent
    const { data: planRow } = await supabase
      .from('session_plans')
      .select('id, status, exercise_logs')
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
      const nextTheme =
        progress && nextNum <= totalSessions
          ? getThemeForSession(totalSessions, nextNum, phaseLengthsForNext)
          : null;

      let feedbackSaved = false;
      if (feedbackPayload) {
        const result = await saveSessionFeedback(supabase, feedbackPayload, {
          userId,
          sessionNumber,
          sessionPlanId: planRow && 'id' in planRow ? (planRow as { id: string }).id : null,
        });
        feedbackSaved = result.saved;
      }

      const data = {
        progress: progress ?? null,
        next_theme: nextTheme,
        idempotent: true,
        exercise_logs: toExerciseLogsArray(planRow.exercise_logs),
        ...(feedbackPayload && { feedback_saved: feedbackSaved }),
      };
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
