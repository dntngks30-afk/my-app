/**
 * 루틴 활성화 API (수동 개방 / 시작)
 *
 * POST /api/routine-engine/activate
 *
 * - READY 상태일 때: 다음 일차로 수동 개방 (current_day++, last_activated_at 갱신)
 * - 또는 유저가 "오늘의 리셋 시작하기" 클릭 시 호출
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { activateRoutine } from '@/lib/routine-engine';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const state = await activateRoutine(userId);

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (err) {
    console.error('[routine-engine/activate] error:', err);
    return NextResponse.json(
      {
        error: '루틴 활성화에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
