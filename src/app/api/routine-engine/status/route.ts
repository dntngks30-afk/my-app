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
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const status = await computeRoutineStatusPayload(userId);

    const res = NextResponse.json({ success: true, ...status });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
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
