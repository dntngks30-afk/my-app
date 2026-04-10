/**
 * POST /api/reset-map/start
 *
 * PR-RESET-01: Reset Map Flow 시작.
 * PR-RESET-02: Idempotency-Key required. Replay safe.
 * PR-RESET-06: Active flow uniqueness. Reuse existing active flow.
 * Auth: Bearer token. Write: service role (RLS bypass).
 */

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import {
  checkIdempotency,
  storeIdempotentResult,
  ROUTE_KEYS,
} from '@/lib/idempotency/guard';
import { logResetMapEvent } from '@/lib/reset-map/events';
import { getActiveFlowByUser } from '@/lib/reset-map/activeFlow';
import { checkRailReady } from '@/lib/session/profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toStartData(
  row: { id: string; state: string; started_at: string },
  reused: boolean
) {
  return {
    flow_id: row.id,
    state: row.state,
    reused,
    started_at: row.started_at,
  };
}

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return fail(
      400,
      ApiErrorCode.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key 헤더가 필요합니다'
    );
  }

  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : null;
    const variantTag = typeof body.variant_tag === 'string' ? body.variant_tag : null;

    const fingerprintPayload = {
      session_id: sessionId,
      variant_tag: variantTag,
    };

    const guardResult = await checkIdempotency({
      supabase,
      idempotencyKey,
      routeKey: ROUTE_KEYS.RESET_MAP_START,
      fingerprintPayload,
      userId,
    });

    if (guardResult.action === 'reject') return guardResult.response;
    if (guardResult.action === 'replay') {
      void logResetMapEvent(supabase, {
        flowId: '00000000-0000-0000-0000-000000000000',
        userId,
        name: 'idempotent_replay_served',
        attrs: { idempotency_key: idempotencyKey },
      });
      return guardResult.response;
    }

    const railCheck = await checkRailReady(supabase, userId);
    if (!railCheck.ready) {
      void logResetMapEvent(supabase, {
        flowId: '00000000-0000-0000-0000-000000000000',
        userId,
        name: 'rail_not_ready_blocked',
        attrs: { reason: railCheck.reason ?? 'unknown' },
      });
      return fail(
        409,
        ApiErrorCode.RAIL_NOT_READY,
        '세션 레일이 준비되지 않았습니다. 심층 테스트 결과 보기에서 주당 빈도를 선택한 후 다시 시도해 주세요.',
        { reason: railCheck.reason, rail_ready: false }
      );
    }

    const activeFlow = await getActiveFlowByUser(supabase, userId);
    if (activeFlow) {
      const data = toStartData(activeFlow, true);
      void logResetMapEvent(supabase, {
        flowId: activeFlow.id,
        userId,
        name: 'active_flow_reused',
        attrs: { state: activeFlow.state },
      });
      const responseBody = { ok: true as const, data };
      const outcome = await storeIdempotentResult({
        supabase,
        idempotencyKey,
        routeKey: ROUTE_KEYS.RESET_MAP_START,
        fingerprintPayload,
        userId,
        statusCode: 200,
        responseBody,
        flowId: activeFlow.id,
      });
      if ('stored' in outcome) return ok(data);
      if (outcome.fingerprintMatch) {
        void logResetMapEvent(supabase, {
          flowId: activeFlow.id,
          userId,
          name: 'idempotent_conflict_recovered',
          attrs: { idempotency_key: idempotencyKey },
        });
        return NextResponse.json(outcome.storedResponse, {
          status: outcome.statusCode,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      return fail(
        409,
        ApiErrorCode.IDEMPOTENCY_KEY_REUSED,
        '동일한 Idempotency-Key로 다른 요청이 이미 처리되었습니다'
      );
    }

    const { data: inserted, error } = await supabase
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

    if (error?.code === '23505') {
      const recovered = await getActiveFlowByUser(supabase, userId);
      if (recovered) {
        const data = toStartData(recovered, true);
        void logResetMapEvent(supabase, {
          flowId: recovered.id,
          userId,
          name: 'duplicate_start_prevented',
          attrs: { state: recovered.state },
        });
        const responseBody = { ok: true as const, data };
        const outcome = await storeIdempotentResult({
          supabase,
          idempotencyKey,
          routeKey: ROUTE_KEYS.RESET_MAP_START,
          fingerprintPayload,
          userId,
          statusCode: 200,
          responseBody,
          flowId: recovered.id,
        });
        if ('stored' in outcome) return ok(data);
        if (outcome.fingerprintMatch) {
          void logResetMapEvent(supabase, {
            flowId: recovered.id,
            userId,
            name: 'idempotent_conflict_recovered',
            attrs: { idempotency_key: idempotencyKey },
          });
          return NextResponse.json(outcome.storedResponse, {
            status: outcome.statusCode,
            headers: { 'Cache-Control': 'no-store' },
          });
        }
        return fail(
          409,
          ApiErrorCode.IDEMPOTENCY_KEY_REUSED,
          '동일한 Idempotency-Key로 다른 요청이 이미 처리되었습니다'
        );
      }
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 시작에 실패했습니다');
    }

    if (error) {
      console.error('[reset-map/start] insert failed', error);
      return fail(500, ApiErrorCode.INTERNAL_ERROR, '플로우 시작에 실패했습니다');
    }

    const data = toStartData(inserted, false);
    void logResetMapEvent(supabase, {
      flowId: inserted.id,
      userId,
      name: 'started',
      attrs: { flow_version: 'v1', session_id: sessionId },
    });

    const responseBody = { ok: true as const, data };
    const outcome = await storeIdempotentResult({
      supabase,
      idempotencyKey,
      routeKey: ROUTE_KEYS.RESET_MAP_START,
      fingerprintPayload,
      userId,
      statusCode: 200,
      responseBody,
      flowId: inserted.id,
    });

    if ('stored' in outcome) return ok(data);
    if (outcome.fingerprintMatch) {
      void logResetMapEvent(supabase, {
        flowId: inserted.id,
        userId,
        name: 'idempotent_conflict_recovered',
        attrs: { idempotency_key: idempotencyKey },
      });
      return NextResponse.json(outcome.storedResponse, {
        status: outcome.statusCode,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return fail(
      409,
      ApiErrorCode.IDEMPOTENCY_KEY_REUSED,
      '동일한 Idempotency-Key로 다른 요청이 이미 처리되었습니다'
    );
  } catch (err) {
    console.error('[reset-map/start]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
