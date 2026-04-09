import type { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { buildDedupeKey, tryAcquireDedupe } from '@/lib/request-dedupe';
import { getKstDayKeyUTC } from '@/lib/time/kst';
import { logSessionEvent } from '@/lib/session-events';
import type { RequestGateResult, SessionCreateRequestBody, SessionCreateTimings } from './types';

const ROUTE_CREATE = '/api/session/create';

function normalizeRequestBody(body: Record<string, unknown>, url: string): SessionCreateRequestBody {
  const isDebug = body.debug === true || new URL(url).searchParams.get('debug') === '1';
  const conditionMood = (['good', 'ok', 'bad'] as const).includes(body.condition_mood as 'good' | 'ok' | 'bad')
    ? (body.condition_mood as 'good' | 'ok' | 'bad')
    : 'ok';
  const timeBudget = (['short', 'normal'] as const).includes(body.time_budget as 'short' | 'normal')
    ? (body.time_budget as 'short' | 'normal')
    : 'normal';
  const painFlags = Array.isArray(body.pain_flags)
    ? (body.pain_flags as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const equipment = typeof body.equipment === 'string' ? body.equipment : 'none';

  return {
    isDebug,
    conditionMood,
    timeBudget,
    painFlags,
    equipment,
  };
}

export async function runRequestGate(
  req: NextRequest,
  t0: number,
  timings: SessionCreateTimings
): Promise<RequestGateResult> {
  const userId = await getCurrentUserId(req);
  timings.auth_ms = Math.round(performance.now() - t0);
  if (!userId) {
    return { kind: 'auth_required' };
  }

  const tDedupe = performance.now();
  const headerKey = req.headers.get('Idempotency-Key') ?? null;
  const kstDay = getKstDayKeyUTC();
  const dedupeKey = buildDedupeKey({ route: ROUTE_CREATE, userId, kstDay, headerKey });
  const supabase = getServerSupabaseAdmin();
  const acquired = await tryAcquireDedupe(supabase, {
    route: ROUTE_CREATE,
    userId,
    dedupeKey,
    kstDay,
    ttlSeconds: 10,
  });
  timings.dedupe_ms = Math.round(performance.now() - tDedupe);

  if (!acquired) {
    void logSessionEvent(supabase, {
      userId,
      eventType: 'request_deduped',
      status: 'blocked',
      code: 'REQUEST_DEDUPED',
      meta: { route: ROUTE_CREATE },
    });
    return { kind: 'request_deduped' };
  }

  const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  return {
    kind: 'continue',
    req,
    userId,
    supabase,
    timings,
    t0,
    requestBody: normalizeRequestBody(rawBody, req.url),
  };
}
