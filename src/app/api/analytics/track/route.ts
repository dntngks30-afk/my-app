import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { upsertAnalyticsIdentityLink } from '@/lib/analytics/identity';
import {
  isDuplicateAnalyticsInsertError,
  sanitizeAnalyticsEventInput,
} from '@/lib/analytics/sanitize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_NO_STORE = { 'Cache-Control': 'no-store' };

function success(body: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...body }, { headers: CACHE_NO_STORE });
}

function dropped() {
  return NextResponse.json(
    { ok: true, dropped: true },
    { status: 202, headers: CACHE_NO_STORE }
  );
}

function invalidPayload() {
  return NextResponse.json(
    { ok: false, error: 'invalid_payload' },
    { status: 400, headers: CACHE_NO_STORE }
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return invalidPayload();
    }
  } catch {
    return invalidPayload();
  }

  let supabase: ReturnType<typeof getServerSupabaseAdmin>;
  let userId: string | null = null;

  try {
    supabase = getServerSupabaseAdmin();
    userId = await getCurrentUserId(req, supabase).catch(() => null);
  } catch {
    return dropped();
  }

  const sanitized = sanitizeAnalyticsEventInput({
    ...body,
    source: 'client',
    user_id: userId,
    user_agent: req.headers.get('user-agent') ?? undefined,
    referrer: req.headers.get('referer') ?? req.headers.get('referrer') ?? undefined,
  });

  if (!sanitized.ok) {
    return invalidPayload();
  }

  try {
    const { error } = await supabase
      .from('analytics_events')
      .insert(sanitized.event);

    if (error) {
      if (isDuplicateAnalyticsInsertError(error)) {
        return success({ deduped: true });
      }
      console.error('[api/analytics/track] insert failed');
      return dropped();
    }

    await upsertAnalyticsIdentityLink({
      anon_id: sanitized.event.anon_id,
      user_id: sanitized.event.user_id,
      source: 'track_endpoint',
      supabase,
    });

    return success();
  } catch {
    return dropped();
  }
}

