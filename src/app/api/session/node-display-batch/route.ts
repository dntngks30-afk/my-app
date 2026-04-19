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
import { resolveSessionDisplayContract } from '@/lib/session/session-display-contract';
import type { SessionNodeDisplayHydrationItem, SessionNodeDisplayHydrationResponse } from '@/lib/session/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildHydrationItem(
  sessionNumber: number,
  meta: Record<string, unknown> | null | undefined
): SessionNodeDisplayHydrationItem {
  if (!meta || typeof meta !== 'object') {
    return { session_number: sessionNumber };
  }
  const c = resolveSessionDisplayContract(meta);
  const priority_vector =
    meta.priority_vector &&
    typeof meta.priority_vector === 'object' &&
    meta.priority_vector !== null &&
    !Array.isArray(meta.priority_vector)
      ? (meta.priority_vector as Record<string, number>)
      : undefined;

  return {
    session_number: sessionNumber,
    ...(c.session_role_code && { session_role_code: c.session_role_code }),
    ...(c.session_role_label && { session_role_label: c.session_role_label }),
    ...(c.session_goal_code && { session_goal_code: c.session_goal_code }),
    ...(c.session_goal_label && { session_goal_label: c.session_goal_label }),
    ...(c.session_goal_hint && { session_goal_hint: c.session_goal_hint }),
    ...(typeof meta.session_rationale === 'string'
      ? { session_rationale: meta.session_rationale }
      : meta.session_rationale === null
        ? { session_rationale: null }
        : {}),
    ...(Array.isArray(meta.session_focus_axes) &&
    meta.session_focus_axes.length > 0
      ? { session_focus_axes: meta.session_focus_axes as string[] }
      : {}),
    ...(priority_vector ? { priority_vector } : {}),
    ...(meta.pain_mode === 'none' ||
    meta.pain_mode === 'caution' ||
    meta.pain_mode === 'protected'
      ? { pain_mode: meta.pain_mode }
      : {}),
    ...(Array.isArray(meta.focus) && meta.focus.length > 0 ? { focus: meta.focus as string[] } : {}),
  };
}

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
      return buildHydrationItem(row.session_number, meta);
    });

    const data: SessionNodeDisplayHydrationResponse = { items };
    return ok(data);
  } catch (e) {
    console.error('[session/node-display-batch]', e);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
