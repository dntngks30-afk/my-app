/**
 * PR-RESET-BE-03 — POST /api/reset/media (active plan 필요, 재생 가능 payload).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import { resolveResetMediaSelection, validateResetMediaRequestBody } from '@/lib/reset/reset-media-core';
import { buildResetMediaResponseForSelection } from '@/lib/reset/reset-media-fetch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function safeJsonBody(
  req: NextRequest
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; message: string }> {
  try {
    const raw = await req.json();
    if (
      raw === null ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      return { ok: false, message: '요청 본문이 유효하지 않습니다.' };
    }
    return { ok: true, value: raw as Record<string, unknown> };
  } catch {
    return { ok: false, message: 'JSON 형식이 올바르지 않습니다.' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const parsed = await safeJsonBody(req);
    if (!parsed.ok) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, parsed.message);
    }

    const v = validateResetMediaRequestBody(parsed.value);
    if (!v.ok) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, v.message);
    }

    const resolved = resolveResetMediaSelection(v.input);
    if (!resolved.ok) {
      return fail(400, ApiErrorCode.VALIDATION_FAILED, resolved.message);
    }

    const payload = await buildResetMediaResponseForSelection(resolved.selection);
    return ok(payload);
  } catch (err) {
    console.error('[POST /api/reset/media]', err);
    return fail(
      500,
      ApiErrorCode.INTERNAL_ERROR,
      '리셋 영상 조회 중 오류가 발생했습니다.'
    );
  }
}
