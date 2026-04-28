/**
 * GET /api/journey/summary
 * 여정 탭용 움직임 타입 + 최근 7일 수행 요약.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { fail, ApiErrorCode } from '@/lib/api/contract';
import { getJourneySummary } from '@/lib/journey/getJourneySummary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const body = await getJourneySummary(userId);
    return NextResponse.json(body, { status: 200, headers: CACHE_NO_STORE });
  } catch (err) {
    console.error('[GET /api/journey/summary]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '요약을 불러오지 못했습니다');
  }
}
