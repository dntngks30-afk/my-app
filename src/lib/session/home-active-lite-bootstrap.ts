import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { fetchActiveLiteData } from '@/lib/session/active-lite-data';
import { ok, fail, ApiErrorCode } from '@/lib/api/contract';
import type { ActiveSessionLiteResponse, HomeNodeDisplayBundle } from '@/lib/session/client';
import { fetchHomeNodeDisplayBundle } from '@/lib/session/home-node-display-bundle';

export type HomeActiveLiteBootstrapResponse = {
  activeLite: ActiveSessionLiteResponse;
  nodeDisplayBundle?: HomeNodeDisplayBundle;
};

type HomeActiveLiteBootstrapOptions = {
  errorTag: string;
};

export async function handleGetHomeActiveLiteBootstrap(
  req: NextRequest,
  options: HomeActiveLiteBootstrapOptions
) {
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

    const timingsObj: Record<string, number> = {};
    const activeResult = await fetchActiveLiteData(
      supabase,
      userId,
      debug ? { timings: timingsObj } : undefined
    );

    if (!activeResult.ok) {
      return fail(
        activeResult.status,
        (activeResult.code as ApiErrorCode) || ApiErrorCode.INTERNAL_ERROR,
        activeResult.message
      );
    }

    const totalSessions = activeResult.data.progress.total_sessions ?? 16;
    const activeSessionNumber = activeResult.data.progress.active_session_number ?? null;
    let nodeDisplayBundle: HomeNodeDisplayBundle | undefined;
    try {
      nodeDisplayBundle = await fetchHomeNodeDisplayBundle(supabase, userId, {
        totalSessions,
        activeSessionNumber,
      });
    } catch (e) {
      console.warn(options.errorTag, 'nodeDisplayBundle skipped', e);
    }

    const data: HomeActiveLiteBootstrapResponse = {
      activeLite: activeResult.data,
      ...(nodeDisplayBundle && nodeDisplayBundle.items.length > 0 ? { nodeDisplayBundle } : {}),
    };

    if (debug) {
      const total_ms = Math.round(performance.now() - t0);
      const timings = {
        auth_ms,
        progress_read_ms: timingsObj.progress_read_ms ?? 0,
        session_lookup_ms: timingsObj.session_lookup_ms ?? 0,
        extra_ms: timingsObj.extra_ms ?? 0,
        write_ms: timingsObj.write_ms ?? 0,
        total_ms,
      };
      console.log('[bootstrap-timing]', timings);
      return ok(data, { __debug: timings });
    }

    return ok(data);
  } catch (err) {
    console.error(options.errorTag, err);
    return fail(500, ApiErrorCode.INTERNAL_ERROR, '서버 오류');
  }
}
