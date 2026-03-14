/**
 * POST /api/reset-map/[id]/preview-result
 *
 * PR-RESET-04: Preview gate MVP.
 * Evaluates quality signals, updates flow to preview_ready or keeps started.
 * Auth: Bearer token. Write: service role (RLS bypass).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { canReceivePreview } from '@/lib/reset-map/state';
import type { ResetMapState } from '@/lib/reset-map/types';
import { evaluatePreview, type PreviewPayload } from '@/lib/reset-map/preview';
import { logResetMapEvent } from '@/lib/reset-map/events';
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

    const body = (await req.json().catch(() => ({}))) as PreviewPayload;
    const payload: PreviewPayload = {
      tracking_conf: typeof body.tracking_conf === 'number' ? body.tracking_conf : undefined,
      landmark_coverage: typeof body.landmark_coverage === 'number' ? body.landmark_coverage : undefined,
      permission_state: ['granted', 'denied', 'limited', 'unknown'].includes(body.permission_state as string)
        ? (body.permission_state as PreviewPayload['permission_state'])
        : undefined,
    };

    const supabase = getServerSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
      .from('reset_map_flow')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[reset-map/preview-result] fetch failed', fetchErr);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 조회에 실패했습니다');
    }

    if (!row) {
      return fail(404, ApiErrorCode.RESET_FLOW_NOT_FOUND, '플로우를 찾을 수 없습니다');
    }

    const state = row.state as ResetMapState;
    if (!canReceivePreview(state)) {
      return fail(
        422,
        ApiErrorCode.INVALID_STATE,
        `현재 상태에서는 프리뷰를 평가할 수 없습니다 (state=${state})`,
        { state }
      );
    }

    const { proceed, reasons } = evaluatePreview(payload);
    const previewSnapshot = {
      tracking_conf: payload.tracking_conf,
      landmark_coverage: payload.landmark_coverage,
      permission_state: payload.permission_state,
      proceed,
      reasons,
      evaluated_at: new Date().toISOString(),
    };

    if (proceed) {
      const { data, error } = await supabase
        .from('reset_map_flow')
        .update({
          state: 'preview_ready',
          preview_snapshot: previewSnapshot,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .eq('state', 'started')
        .select()
        .single();

      if (error) {
        console.error('[reset-map/preview-result] update failed', error);
        return fail(500, ApiErrorCode.INTERNAL_ERROR, '상태 업데이트에 실패했습니다');
      }

      if (!data) {
        return fail(422, ApiErrorCode.INVALID_STATE, '상태 전이에 실패했습니다', { state });
      }

      void logResetMapEvent(supabase, {
        flowId: id,
        userId,
        name: 'preview_ready',
        attrs: { previous_state: 'started' },
      });

      return ok({
        flow_id: id,
        proceed: true,
        state: 'preview_ready',
        reasons: [],
      });
    }

    const { error: updateErr } = await supabase
      .from('reset_map_flow')
      .update({ preview_snapshot: previewSnapshot })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('state', 'started');

    if (updateErr) {
      console.error('[reset-map/preview-result] snapshot update failed', updateErr);
    }

    void logResetMapEvent(supabase, {
      flowId: id,
      userId,
      name: 'preview_blocked',
      attrs: { reasons },
    });

    return ok({
      flow_id: id,
      proceed: false,
      state: 'started',
      reasons,
    });
  } catch (err) {
    console.error('[reset-map/preview-result]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
