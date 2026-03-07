/**
 * GET /api/session/plan-summary?session_number=N
 *
 * 패널 첫 렌더용 경량 조회. segments만 반환 (plan_json.meta, condition 등 제외).
 * exercise list / routine summary 렌더에 필요한 최소 데이터.
 *
 * Auth: Bearer token.
 * Perf: ?debug=1 → data.timings.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type PlanSummaryResponse = {
  session_number: number;
  status: string;
  segments: Array<{
    title: string;
    items: Array<{
      templateId: string;
      name: string;
      order: number;
      sets?: number;
      reps?: number;
      hold_seconds?: number;
    }>;
  }>;
};

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

    const { searchParams } = new URL(req.url);
    const sessionNumberParam = searchParams.get('session_number');
    const sessionNumber = sessionNumberParam != null
      ? Math.floor(parseInt(sessionNumberParam, 10) || 0)
      : null;

    if (sessionNumber == null || sessionNumber < 1) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'session_number가 유효하지 않습니다 (1 이상의 정수)');
    }

    const tDb = performance.now();
    const supabase = getServerSupabaseAdmin();
    const { data: row, error } = await supabase
      .from('session_plans')
      .select('session_number, status, plan_json')
      .eq('user_id', userId)
      .eq('session_number', sessionNumber)
      .maybeSingle();

    timings.db_ms = Math.round(performance.now() - tDb);

    if (error) {
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 조회에 실패했습니다');
    }
    if (!row) {
      return fail(404, ApiErrorCode.SESSION_PLAN_NOT_FOUND, '해당 세션 플랜을 찾을 수 없습니다');
    }

    const tExtract = performance.now();
    const planJson = row.plan_json as { segments?: Array<{ title?: string; items?: Array<{ templateId?: string; name?: string; order?: number; sets?: number; reps?: number; hold_seconds?: number }> }> } | null;
    const segments = (planJson?.segments ?? []).map(seg => ({
      title: seg.title ?? '',
      items: (seg.items ?? []).map(it => ({
        templateId: it.templateId ?? '',
        name: it.name ?? '',
        order: it.order ?? 0,
        sets: it.sets,
        reps: it.reps,
        hold_seconds: it.hold_seconds,
      })),
    }));

    timings.extract_ms = Math.round(performance.now() - tExtract);
    timings.total_ms = Math.round(performance.now() - t0);

    if (isDebug && process.env.NODE_ENV !== 'production') {
      console.info('[session/plan-summary] perf', timings);
    }

    const data: PlanSummaryResponse = {
      session_number: row.session_number,
      status: row.status ?? 'draft',
      segments,
    };

    return ok(data, isDebug ? { timings } : undefined);
  } catch (err) {
    console.error('[session/plan-summary]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
