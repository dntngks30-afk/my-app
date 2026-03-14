/**
 * PR-RESET-02: Idempotency guard for reset-map endpoints.
 * Check replay → return cached. Check reuse → 409. Missing key → 400.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { NextResponse as NextResponseConstructor } from 'next/server';
import { fail, ApiErrorCode } from '@/lib/api/contract';
import { buildFingerprintHash } from './fingerprint';

export const ROUTE_KEYS = {
  RESET_MAP_START: 'reset-map:start',
  RESET_MAP_APPLY: 'reset-map:apply',
} as const;

export type IdempotencyGuardResult =
  | { action: 'reject'; response: NextResponse }
  | { action: 'replay'; response: NextResponse }
  | { action: 'proceed' };

/**
 * Check idempotency. Returns reject/replay response or proceed.
 */
export async function checkIdempotency(params: {
  supabase: SupabaseClient;
  idempotencyKey: string;
  routeKey: string;
  fingerprintPayload: Record<string, unknown>;
  userId: string;
  method?: string;
}): Promise<IdempotencyGuardResult> {
  const { supabase, idempotencyKey, routeKey, fingerprintPayload, userId } = params;
  const method = params.method ?? 'POST';

  const fingerprintHash = buildFingerprintHash({
    method,
    routeKey,
    payload: fingerprintPayload,
    userId,
  });

  const { data: existing, error } = await supabase
    .from('idempotent_requests')
    .select('fingerprint_hash, status_code, response_body')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    console.error('[idempotency] check failed', error);
    return { action: 'proceed' };
  }

  if (!existing) return { action: 'proceed' };

  if (existing.fingerprint_hash !== fingerprintHash) {
    return {
      action: 'reject',
      response: fail(
        409,
        ApiErrorCode.IDEMPOTENCY_KEY_REUSED,
        '동일한 Idempotency-Key로 다른 요청이 이미 처리되었습니다'
      ),
    };
  }

  const body = existing.response_body as Record<string, unknown>;
  const status = existing.status_code as number;
  return {
    action: 'replay',
    response: NextResponseConstructor.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    }),
  };
}

/**
 * Store idempotent result after successful processing.
 */
export async function storeIdempotentResult(params: {
  supabase: SupabaseClient;
  idempotencyKey: string;
  routeKey: string;
  fingerprintPayload: Record<string, unknown>;
  userId: string;
  statusCode: number;
  responseBody: Record<string, unknown>;
  flowId?: string | null;
  method?: string;
}): Promise<void> {
  const { supabase, idempotencyKey, routeKey, fingerprintPayload, userId } = params;
  const { statusCode, responseBody, flowId } = params;
  const method = params.method ?? 'POST';

  const fingerprintHash = buildFingerprintHash({
    method,
    routeKey,
    payload: fingerprintPayload,
    userId,
  });

  await supabase.from('idempotent_requests').insert({
    idempotency_key: idempotencyKey,
    route_key: routeKey,
    user_id: userId,
    fingerprint_hash: fingerprintHash,
    status_code: statusCode,
    response_body: responseBody,
    flow_id: flowId ?? null,
  });
}
