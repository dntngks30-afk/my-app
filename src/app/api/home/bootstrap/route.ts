/**
 * GET /api/home/bootstrap (bootstrap-lite)
 *
 * 홈 초기 진입용 경량 API. active-lite만 반환.
 * progressReport는 ProgressReportCard가 /api/session/progress-report에서 별도 조회.
 *
 * Auth: Bearer token
 * active-lite 실패 시 전체 실패.
 *
 * Timing: ?debug=1 시 __debug 블록과 서버 로그에 단계별 ms 반환.
 */

import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import type { ActiveSessionLiteResponse } from '@/lib/session/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type BootstrapResponse = {
  activeLite: ActiveSessionLiteResponse;
};

export async function GET(req: NextRequest) {
  const debug = req.nextUrl.searchParams.get('debug') === '1';
  const t0 = debug ? performance.now() : 0;

  try {
    const tAuthStart = debug ? performance.now() : 0;
    const userId = await getCurrentUserId(req);
    const auth_ms = debug ? Math.round(performance.now() - tAuthStart) : 0;

    if (!userId) {
      return fail(401, ApiErrorCode.AUTH_REQUIRED, '로그인이 필요합니다');
    }

    const supabase = getServerSupabaseAdmin();

    let progress_read_ms = 0;
    const extra_ms = 0;

    const tProgressStart = debug ? performance.now() : 0;
    const activeResult = await fetchActiveLiteData(supabase, userId);
    if (debug) progress_read_ms = Math.round(performance.now() - tProgressStart);

    if (!activeResult.ok) {
      return fail(
        activeResult.status,
        (activeResult.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeResult.message
      );
    }

    const data: BootstrapResponse = {
      activeLite: activeResult.data,
    };

    if (debug) {
      const total_ms = Math.round(performance.now() - t0);
      const session_lookup_ms = 0;
      const map_data_ms = 0;
      const user_ms = 0;
      const write_ms = 0;
      const timings = {
        auth_ms,
        user_ms,
        progress_read_ms,
        session_lookup_ms,
        map_data_ms,
        extra_ms,
        write_ms,
        total_ms,
      };
      console.log('[bootstrap-timing]', timings);
      return ok(data, { __debug: timings });
    }

    return ok(data);
  } catch (err) {
    console.error('[home/bootstrap]', err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
