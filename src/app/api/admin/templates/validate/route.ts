/**
 * POST /api/admin/templates/validate
 * media_ref 규격 검사 (저장 전)
 * Body: { media_ref: unknown }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { validateMediaRef } from '@/lib/admin/media-ref-schema';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  let body: { media_ref?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const result = validateMediaRef(body.media_ref);

  const res = NextResponse.json({
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
