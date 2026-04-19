/**
 * GET /api/session/node-display-batch?from=1&to=20
 *
 * Display-only batch hydration for map/panel copy (no segments, no exercise payloads).
 * Read-time derivation from plan_json.meta; no DB writes.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { buildSessionNodeDisplayHydrationItem } from '@/lib/session/session-node-display-hydration-item';
import type { SessionNodeDisplayHydrationItem, SessionNodeDisplayHydrationResponse } from '@/lib/session/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const { searchParams } = new URL(req.url);
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');
    const from = Math.max(1, Math.floor(parseInt(fromRaw ?? '1', 10) || 1));
    const to = Math.min(20, Math.max(from, Math.floor(parseInt(toRaw ?? '20', 10) || 20)));
    if (from < 1 || to > 20 || from > to) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, 'from/to는 1~20 범위에서 from ≤ to 여야 합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from('session_plans')
      .select('session_number, plan_json')
      .eq('user_id', userId)
      .gte('session_number', from)
      .lte('session_number', to)
      .order('session_number', { ascending: true });

    if (error) {
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '세션 플랜 조회에 실패했습니다');
    }

    const items: SessionNodeDisplayHydrationItem[] = (rows ?? []).map((row: { session_number: number; plan_json: unknown }) => {
      const pj = row.plan_json as { meta?: Record<string, unknown> } | null | undefined;
      const meta = pj?.meta;
      return buildSessionNodeDisplayHydrationItem(row.session_number, meta);
    });

    const data: SessionNodeDisplayHydrationResponse = { items };
    return ok(data);
  } catch (e) {
    console.error('[session/node-display-batch]', e);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
