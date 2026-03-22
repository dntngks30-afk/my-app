/**
 * FLOW-07 / PR-FLOW-06 — Canonical Session Readiness API
 *
 * GET /api/readiness
 *
 * 응답 본문은 SessionReadinessV1 (PR-FLOW-06). READ ONLY.
 *
 * @see src/lib/readiness/get-session-readiness.ts
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import {
  getSessionReadiness,
  UNAUTHENTICATED_SESSION_READINESS_V1,
} from '@/lib/readiness/get-session-readiness';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);

    if (!userId) {
      return ok(UNAUTHENTICATED_SESSION_READINESS_V1);
    }

    const readiness = await getSessionReadiness(userId);
    return ok(readiness);
  } catch (err) {
    console.error('[GET /api/readiness]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '준비 상태 조회 중 오류가 발생했습니다.');
  }
}
