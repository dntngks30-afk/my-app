/**
 * 일일 운동 루틴 알림 Cron Job
 * 
 * GET /api/cron/daily-workout-notification
 * 
 * Vercel Cron Job에서 매일 아침 실행됩니다.
 * Authorization 헤더에 CRON_SECRET을 포함해야 합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendDailyWorkoutNotifications } from '@/lib/notifications/daily-workout-sender';

export const runtime = 'nodejs'; // Cron Job은 Node.js 런타임 필요

export async function GET(req: NextRequest) {
  try {
    // Cron Job 인증 확인
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json({ error: 'Cron 설정 오류' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 });
    }

    // 오늘 날짜로 알림 발송
    const today = new Date();
    const result = await sendDailyWorkoutNotifications(today);

    return NextResponse.json({
      success: true,
      date: today.toISOString().split('T')[0],
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('일일 알림 Cron Job 실행 실패:', error);
    return NextResponse.json(
      {
        error: '알림 발송 실패',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
