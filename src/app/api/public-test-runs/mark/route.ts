import { NextRequest, NextResponse } from 'next/server';
import {
  markPublicTestRunMilestone,
  markPublicTestRunRefineChoice,
  type PublicTestRunMilestone,
} from '@/lib/public-test-runs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' as const };

const MILESTONE_ALLOWLIST = new Set<string>([
  'survey_started',
  'survey_completed',
  'result_viewed',
]);

const SAFE_REASONS = new Set([
  'invalid_json',
  'invalid_kind',
  'invalid_milestone',
  'invalid_choice',
  'invalid_run_id',
  'invalid_anon_id',
  'run_not_found',
  'already_marked',
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

  const kind = body.kind;
  const runId = body.runId;
  const anonId = body.anonId;

  if (typeof runId !== 'string' || typeof anonId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'write_failed' }, { status: 200, headers: NO_STORE });
  }

  if (kind === 'milestone') {
    const milestone = body.milestone;
    if (typeof milestone !== 'string' || !MILESTONE_ALLOWLIST.has(milestone)) {
      return NextResponse.json({ ok: false, reason: 'invalid_milestone' }, { status: 200, headers: NO_STORE });
    }

    const occurredAtIso = body.occurredAtIso;
    const result = await markPublicTestRunMilestone({
      runId,
      anonId,
      milestone: milestone as PublicTestRunMilestone,
      occurredAtIso:
        occurredAtIso === null || occurredAtIso === undefined
          ? undefined
          : typeof occurredAtIso === 'string'
            ? occurredAtIso
            : undefined,
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

  if (kind === 'refine_choice') {
    const choice = body.choice;
    if (choice !== 'baseline' && choice !== 'camera') {
      return NextResponse.json({ ok: false, reason: 'invalid_choice' }, { status: 200, headers: NO_STORE });
    }

    const result = await markPublicTestRunRefineChoice({
      runId,
      anonId,
      choice,
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

  return NextResponse.json({ ok: false, reason: 'invalid_kind' }, { status: 200, headers: NO_STORE });
}
