/**
 * GET /api/reset-map/debug/[flowId]/events
 *
 * PR-RESET-10: Event timeline for a flow. Auth required. Own flows only.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const { flowId } = await params;
    if (!flowId) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'flow id가 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const { data: flow, error: flowErr } = await supabase
      .from('reset_map_flow')
      .select('id, user_id')
      .eq('id', flowId)
      .eq('user_id', userId)
      .maybeSingle();

    if (flowErr || !flow) {
      return fail(404, ApiErrorCode.RESET_FLOW_NOT_FOUND, '플로우를 찾을 수 없습니다');
    }

    const { data: events, error: eventsErr } = await supabase
      .from('reset_map_events')
      .select('id, name, ts, attrs')
      .eq('flow_id', flowId)
      .order('ts', { ascending: true });

    if (eventsErr) {
      console.error('[reset-map/debug/events] fetch failed', eventsErr);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '이벤트 조회에 실패했습니다');
    }

    return ok({ flow_id: flowId, events: events ?? [] });
  } catch (err) {
    console.error('[reset-map/debug/events]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
