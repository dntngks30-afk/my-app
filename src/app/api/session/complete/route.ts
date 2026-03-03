/**
 * POST /api/session/complete
 *
 * 세션 완료 처리 (멱등, race-safe).
 * - status IN ('draft','started')일 때만 업데이트 → 첫 완료만 exercise_logs 저장
 * - session_plans: status='completed', completed_at, duration_seconds, completion_mode, exercise_logs
 * - progress: DB trigger session_sync_progress_on_plan_completed가 SSOT
 * - 응답: next_theme만 포함 (운동 리스트 예고 금지)
 *
 * 테마 4단계 (session_number 기반):
 *   1~4:  "1순위 타겟"
 *   5~8:  "2순위 타겟"
 *   9~12: "통합"
 *   13~16:"릴렉스"
 *
 * Path B 독립 레일: 기존 7일 테이블/엔드포인트와 완전 분리.
 * Auth: Bearer token. Write: service role admin client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';

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

/** session_number → 4단계 테마 */
function getTheme(sessionNumber: number): string {
  if (sessionNumber <= 4)  return '1순위 타겟';
  if (sessionNumber <= 8)  return '2순위 타겟';
  if (sessionNumber <= 12) return '통합';
  return '릴렉스';
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: '인증이 필요합니다.' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'session_number가 유효하지 않습니다 (1 이상의 정수).' } },
        { status: 400 }
      );
    }
    if (durationSeconds === null) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'duration_seconds가 필요합니다 (0 이상의 숫자).' } },
        { status: 400 }
      );
    }
    if (!completionMode) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'completion_mode는 all_done|partial_done|stop_early 중 하나여야 합니다.' } },
        { status: 400 }
      );
    }

    let exerciseLogs: ExerciseLogItem[] | null = null;
    if (body.exercise_logs !== undefined && body.exercise_logs !== null) {
      const parsed = parseAndValidateExerciseLogs(body.exercise_logs);
      if (parsed === null) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'exercise_logs 형식이 올바르지 않습니다. (최대 50개, templateId/name 필수)' } },
          { status: 400 }
        );
      }
      exerciseLogs = parsed;
    }

    const supabase = getServerSupabaseAdmin();

    const nowIso = new Date().toISOString();
    const durationClamped = Math.min(7200, Math.max(0, durationSeconds));

    const planUpdatePayload: Record<string, unknown> = {
      status: 'completed',
      completed_at: nowIso,
      duration_seconds: durationClamped,
      completion_mode: completionMode,
    };
    if (exerciseLogs !== null) {
      planUpdatePayload.exercise_logs = exerciseLogs;
    }

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
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: '세션 완료 업데이트에 실패했습니다.' } },
        { status: 500 }
      );
    }

    if (updatedRows && updatedRows.length >= 1) {
      // First completion — DB trigger syncs progress
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const newCompleted = Math.max(progress?.completed_sessions ?? 0, sessionNumber);
      const nextNum = newCompleted + 1;
      const nextTheme = progress && nextNum <= progress.total_sessions ? getTheme(nextNum) : null;

      const res = NextResponse.json({
        progress: progress ?? null,
        next_theme: nextTheme,
        idempotent: false,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    // 0 rows updated — plan not found, already completed, or concurrent
    const { data: planRow } = await supabase
      .from('session_plans')
      .select('status, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    if (!planRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '해당 세션 플랜을 찾을 수 없습니다.' } },
        { status: 404 }
      );
    }

    if (planRow.status === 'completed') {
      const { data: progress } = await supabase
        .from('session_program_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const nextNum = (progress?.completed_sessions ?? sessionNumber) + 1;
      const nextTheme = progress && nextNum <= progress.total_sessions ? getTheme(nextNum) : null;

      const res = NextResponse.json({
        progress: progress ?? null,
        next_theme: nextTheme,
        idempotent: true,
        exercise_logs: planRow.exercise_logs ?? null,
      });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    return NextResponse.json(
      { error: { code: 'CONCURRENT_UPDATE', message: '동시 업데이트가 감지되었습니다. 잠시 후 다시 시도해 주세요.' } },
      { status: 409 }
    );
  } catch (err) {
    console.error('[session/complete]', err);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: err instanceof Error ? err.message : '서버 오류' } },
      { status: 500 }
    );
  }
}
