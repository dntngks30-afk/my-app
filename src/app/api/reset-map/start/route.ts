/**
 * POST /api/reset-map/start
 *
 * PR-RESET-01: Reset Map Flow 시작.
 * state=started 플로우 행 생성.
 * Auth: Bearer token. Write: service role (RLS bypass).
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : null;
    const variantTag = typeof body.variant_tag === 'string' ? body.variant_tag : null;

    const { data, error } = await supabase
      .from('reset_map_flow')
      .insert({
        user_id: userId,
        session_id: sessionId,
        state: 'started',
        flow_version: 'v1',
        variant_tag: variantTag,
      })
      .select()
      .single();

    if (error) {
      console.error('[reset-map/start] insert failed', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 시작에 실패했습니다');
    }

    return ok(data);
  } catch (err) {
    console.error('[reset-map/start]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
