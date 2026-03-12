/**
 * POST /api/deep-test/track
 * Deep Test funnel events. Fire-and-forget, no PII.
 * Writes to session_events (event_type, meta).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';
import { logSessionEvent } from '@/lib/session-events';

const ALLOWED = [
  'deep_test_started',
  'deep_test_section_viewed',
  'deep_test_section_completed',
  'deep_test_abandoned',
  'deep_test_submitted',
  'deep_result_viewed',
  'deep_result_cta_clicked',
] as const;

export async function POST(req: NextRequest) {
  const auth = await requireDeepAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  let body: { event?: string; payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, payload = {} } = body;
  if (!event || typeof event !== 'string' || !ALLOWED.includes(event as (typeof ALLOWED)[number])) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
  }

  const meta: Record<string, unknown> = { ...payload };
  delete meta.answers;
  delete meta.raw;

  const supabase = getServerSupabaseAdmin();
  await logSessionEvent(supabase, {
    userId,
    eventType: event,
    meta,
  });

  return NextResponse.json({ ok: true });
}
