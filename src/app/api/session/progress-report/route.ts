/**
 * GET /api/session/progress-report
 *
 * PR-P2-2: 4-session progress report (read-only).
 * Snapshot + feedback 기반 요약. 진단/치료 표현 금지.
 * Auth: Bearer token.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getProgressWindowReport } from '@/lib/session/progress-report';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const report = await getProgressWindowReport(userId);
    return ok(report, report);
  } catch (err) {
    console.error('[session/progress-report]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
