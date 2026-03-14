/**
 * POST /api/reset-map/[id]/apply
 *
 * PR-RESET-01: Reset Map Flow apply 전이.
 * started | preview_ready → applied.
 * 422 INVALID_STATE: 이미 applied/aborted.
 * Auth: Bearer token. Write: service role (RLS bypass).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { canApply } from '@/lib/reset-map/state';
import type { ResetMapState } from '@/lib/reset-map/types';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const { id } = await params;
    if (!id) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'flow id가 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
      .from('reset_map_flow')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[reset-map/apply] fetch failed', fetchErr);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 조회에 실패했습니다');
    }

    if (!row) {
      return fail(404, ApiErrorCode.RESET_FLOW_NOT_FOUND, '플로우를 찾을 수 없습니다');
    }

    const state = row.state as ResetMapState;
    if (!canApply(state)) {
      return fail(
        422,
        ApiErrorCode.INVALID_STATE,
        `현재 상태에서는 적용할 수 없습니다 (state=${state})`,
        { state }
      );
    }

    const { data, error } = await supabase
      .from('reset_map_flow')
      .update({
        state: 'applied',
        result: 'applied',
        applied_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .in('state', ['started', 'preview_ready'])
      .select()
      .single();

    if (error) {
      console.error('[reset-map/apply] update failed', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '적용에 실패했습니다');
    }

    if (!data) {
      return fail(
        422,
        ApiErrorCode.INVALID_STATE,
        `현재 상태에서는 적용할 수 없습니다 (state=${state})`,
        { state }
      );
    }

    return ok(data);
  } catch (err) {
    console.error('[reset-map/apply]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
