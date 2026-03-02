/**
 * 7일 루틴 상태 조회 API
 *
 * GET /api/routine-engine/status
 *
 * 서버에서 24h/48h 듀얼 타이머를 평가하여 현재 상태를 반환합니다.
 * todayCompletedForDay: current_day에 대한 완료 기록 존재 여부
 * lock_until_utc: last_activated_at + 24h (activate 기준)
 * auto_advance_at_utc: last_activated_at + 48h
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { computeRoutineStatusPayload } from '@/lib/routine-engine';

export async function GET(req: NextRequest) {
  const t0 = performance.now();
  const { searchParams } = new URL(req.url);
  const isDebug = searchParams.get('debug') === '1';
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const tAuth = performance.now();

    const status = await computeRoutineStatusPayload(userId);
    const tEnd = performance.now();

    const payload: Record<string, unknown> = { success: true, ...status };
    if (isDebug) {
      payload.timings = {
        t_auth: Math.round(tAuth - t0),
        t_db: Math.round(tEnd - tAuth),
        t_compute: 0,
        t_total: Math.round(tEnd - t0),
      };
    }

    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    if (isDebug) {
      const t = payload.timings as Record<string, number>;
      res.headers.set('Server-Timing', [
        `auth;dur=${t.t_auth ?? 0}`,
        `db;dur=${t.t_db ?? 0}`,
        `compute;dur=${t.t_compute ?? 0}`,
        `total;dur=${t.t_total ?? 0}`,
      ].join(', '));
    }
    return res;
  } catch (err) {
    console.error('[routine-engine/status] error:', err);
    return NextResponse.json(
      {
        error: '루틴 상태 조회에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
