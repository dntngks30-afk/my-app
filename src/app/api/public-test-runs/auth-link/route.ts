import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { isValidAnonIdForPublicTestProfile } from '@/lib/analytics/public-test-profile';
import { sanitizePilotCode } from '@/lib/pilot/pilot-code';
import { linkPublicTestRunToUserByRun } from '@/lib/public-test-runs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' as const };
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_REASONS = new Set([
  'invalid_json',
  'invalid_payload',
  'invalid_run_id',
  'invalid_anon_id',
  'invalid_pilot_code',
  'run_not_found',
  'pilot_mismatch',
  'user_mismatch',
  'already_marked',
  'write_failed',
]);

function normalizeReason(reason: string | undefined): string {
  if (!reason) return 'write_failed';
  return SAFE_REASONS.has(reason) ? reason : 'write_failed';
}

function invalid(reason: string) {
  return NextResponse.json({ ok: false, reason }, { status: 200, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId(req).catch(() => null);
  if (!userId) {
    return NextResponse.json({ ok: false, reason: 'auth_required' }, { status: 401, headers: NO_STORE });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return invalid('invalid_json');
  }

  const runId = typeof body.runId === 'string' ? body.runId.trim() : '';
  const anonId = typeof body.anonId === 'string' ? body.anonId.trim() : '';

  if (!UUID_RE.test(runId)) return invalid('invalid_run_id');
  if (!isValidAnonIdForPublicTestProfile(anonId)) return invalid('invalid_anon_id');

  let pilotCode: string | null = null;
  if (body.pilotCode !== null && body.pilotCode !== undefined) {
    if (typeof body.pilotCode !== 'string') return invalid('invalid_pilot_code');
    const rawPilotCode = body.pilotCode.trim();
    pilotCode = sanitizePilotCode(rawPilotCode);
    if (rawPilotCode && !pilotCode) return invalid('invalid_pilot_code');
  }

  const result = await linkPublicTestRunToUserByRun({
    runId,
    anonId,
    userId,
    pilotCode,
    markAuthSuccess: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: normalizeReason(result.reason) },
      { status: 200, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { ok: true, ...(result.skipped ? { skipped: true } : {}) },
    { status: 200, headers: NO_STORE }
  );
}
