import { NextRequest, NextResponse } from 'next/server';
import { startPublicTestRun } from '@/lib/public-test-runs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

const SAFE_REASONS = new Set([
  'invalid_run_id',
  'invalid_anon_id',
  'id_conflict_anon_mismatch',
  'conflict_fetch_failed',
  'insert_failed',
  'invalid_json',
  'write_failed',
]);

function normalizeReason(reason: string | undefined): string {
  if (!reason) return 'write_failed';
  return SAFE_REASONS.has(reason) ? reason : 'write_failed';
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200, headers: NO_STORE });
  }

  const runId = body.runId;
  const anonId = body.anonId;

  if (typeof runId !== 'string' || typeof anonId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'write_failed' }, { status: 200, headers: NO_STORE });
  }

  const pilotCode = body.pilotCode;
  const entryPath = body.entryPath;
  const entryReferrer = body.entryReferrer;
  const startedAtIso = body.startedAtIso;
  const ctaClickedAtIso = body.ctaClickedAtIso;

  const result = await startPublicTestRun({
    runId,
    anonId,
    pilotCode:
      pilotCode === null || pilotCode === undefined
        ? undefined
        : typeof pilotCode === 'string'
          ? pilotCode
          : undefined,
    entryPath:
      entryPath === null || entryPath === undefined
        ? undefined
        : typeof entryPath === 'string'
          ? entryPath
          : undefined,
    entryReferrer:
      entryReferrer === null || entryReferrer === undefined
        ? undefined
        : typeof entryReferrer === 'string'
          ? entryReferrer
          : undefined,
    startedAtIso:
      startedAtIso === null || startedAtIso === undefined
        ? undefined
        : typeof startedAtIso === 'string'
          ? startedAtIso
          : undefined,
    ctaClickedAtIso:
      ctaClickedAtIso === null || ctaClickedAtIso === undefined
        ? undefined
        : typeof ctaClickedAtIso === 'string'
          ? ctaClickedAtIso
          : undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: normalizeReason(result.reason) },
      { status: 200, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      id: result.id ?? runId.trim(),
      ...(result.skipped ? { skipped: true } : {}),
    },
    { status: 200, headers: NO_STORE }
  );
}
