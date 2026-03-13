/**
 * POST /api/session/progress
 *
 * PR-EXEC-02: Progress save — store partial execution logs WITHOUT triggering completion.
 * exercise_logs UPSERT into session_plans. Must NOT modify session status, stats, adaptive.
 *
 * Auth: Bearer token.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ProgressItem = {
  template_id: string;
  sets: number;
  reps: number;
  hold_seconds: number;
  rpe: number | null;
  completed: boolean;
  skipped: boolean;
};

function parseProgressItem(raw: unknown): ProgressItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const template_id = typeof o.template_id === 'string' ? o.template_id.trim().slice(0, 80) : null;
  if (!template_id) return null;
  const sets = typeof o.sets === 'number' && Number.isFinite(o.sets) ? Math.min(20, Math.max(0, Math.floor(o.sets))) : 0;
  const reps = typeof o.reps === 'number' && Number.isFinite(o.reps) ? Math.min(200, Math.max(0, Math.floor(o.reps))) : 0;
  const hold_seconds = typeof o.hold_seconds === 'number' && Number.isFinite(o.hold_seconds) ? Math.min(600, Math.max(0, Math.floor(o.hold_seconds))) : 0;
  let rpe: number | null = null;
  if (typeof o.rpe === 'number' && Number.isFinite(o.rpe)) rpe = Math.min(10, Math.max(1, Math.floor(o.rpe)));
  else if (o.rpe === null) rpe = null;
  const completed = o.completed === true;
  const skipped = o.skipped === true;
  return { template_id, sets, reps, hold_seconds, rpe, completed, skipped };
}

type ExerciseLogStored = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty?: number | null;
  rpe?: number | null;
  discomfort?: number | null;
};

function mergeLog(
  existing: ExerciseLogStored[],
  item: ProgressItem,
  name: string
): ExerciseLogStored[] {
  const without = existing.filter((l) => l.templateId !== item.template_id);
  const reps = item.hold_seconds > 0 ? item.hold_seconds : item.reps;
  without.push({
    templateId: item.template_id,
    name,
    sets: item.sets > 0 ? item.sets : null,
    reps: reps > 0 ? reps : null,
    difficulty: null,
    rpe: item.rpe,
  });
  return without;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionNumber = typeof body.session_number === 'number' ? Math.floor(body.session_number) : null;
    const rawItems = body.items ?? body;
    const items: ProgressItem[] = [];
    if (Array.isArray(rawItems)) {
      for (const raw of rawItems) {
        const item = parseProgressItem(raw);
        if (item) items.push(item);
      }
    } else {
      const item = parseProgressItem(rawItems);
      if (item) items.push(item);
    }

    if (!sessionNumber || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다 (1 이상의 정수)');
    }
    if (items.length === 0) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'template_id가 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const { data: plan, error: fetchErr } = await supabase
      .from('session_plans')
      .select('id, status, plan_json, exercise_logs')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .in('status', ['draft', 'started'])
      .maybeSingle();

    if (fetchErr) {
      console.error('[session/progress] fetch failed', fetchErr);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 조회에 실패했습니다');
    }
    if (!plan) {
      return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '해당 세션을 찾을 수 없거나 이미 완료되었습니다');
    }

    const planJson = plan.plan_json as { segments?: Array<{ items?: Array<{ templateId?: string; name?: string }> }> } | null;
    const nameByTemplateId: Record<string, string> = {};
    if (planJson?.segments) {
      for (const seg of planJson.segments) {
        for (const it of seg.items ?? []) {
          if (it?.templateId) nameByTemplateId[it.templateId] = typeof it.name === 'string' ? it.name : '운동';
        }
      }
    }

    let merged = (Array.isArray(plan.exercise_logs) ? plan.exercise_logs : []) as ExerciseLogStored[];
    for (const item of items) {
      merged = mergeLog(merged, item, nameByTemplateId[item.template_id] ?? '운동');
    }

    const { error: updateErr } = await supabase
      .from('session_plans')
      .update({ exercise_logs: merged })
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .in('status', ['draft', 'started']);

    if (updateErr) {
      console.error('[session/progress] update failed', updateErr);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '진행 저장에 실패했습니다');
    }

    return ok({ saved: true });
  } catch (err) {
    console.error('[session/progress]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
