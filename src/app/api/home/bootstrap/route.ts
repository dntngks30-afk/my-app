/**
 * GET /api/home/bootstrap
 *
 * 홈 초기 진입용 집계 API. active-lite + progress-report를 1회에 반환.
 * 요청 수 감소, first render에 필요한 최소 데이터 제공.
 *
 * Auth: Bearer token
 * active-lite 실패 시 전체 실패. progress-report 실패 시 progressReport: null.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { getProgressWindowReport } from '@/lib/session/progress-report';
import type { ProgressWindowReport } from '@/lib/session/progress-report';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import type { ActiveSessionLiteResponse } from '@/lib/session/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type BootstrapResponse = {
  activeLite: ActiveSessionLiteResponse;
  progressReport: ProgressWindowReport | null;
};

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    const [activeResult, progressReport] = await Promise.all([
      fetchActiveLiteData(supabase, userId),
      getProgressWindowReport(userId).catch(() => null),
    ]);

    if (!activeResult.ok) {
      return fail(
        activeResult.status,
        (activeResult.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeResult.message
      );
    }

    const data: BootstrapResponse = {
      activeLite: activeResult.data,
      progressReport,
    };

    return ok(data);
  } catch (err) {
    console.error('[home/bootstrap]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
