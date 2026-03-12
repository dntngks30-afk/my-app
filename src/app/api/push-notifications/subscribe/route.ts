/**
 * 푸시 알림 구독 API
 *
 * POST /api/push-notifications/subscribe
 *
 * 클라이언트에서 생성한 푸시 구독 정보를 받아서 DB에 저장합니다.
 * Auth: Bearer 토큰 필수 (shared getCurrentUserId). body.userId는 신뢰하지 않음.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { subscription } = body;

    if (!subscription) {
      return NextResponse.json({ error: 'subscription은 필수입니다.' }, { status: 400 });
    }

    const supabase = getServerSupabaseAdmin();

    // 구독 정보 저장 또는 업데이트
    const subscriptionData = {
      user_id: userId,
      push_token: JSON.stringify(subscription),
      push_enabled: true,
      updated_at: new Date().toISOString(),
    };

    // 기존 설정 확인
    const { data: existing } = await supabase
      .from('user_notification_preferences')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      // 업데이트
      const { error } = await supabase
        .from('user_notification_preferences')
        .update(subscriptionData)
        .eq('user_id', userId);

      if (error) {
        console.error('Push subscription update error:', error);
        return NextResponse.json(
          { error: '구독 정보 업데이트에 실패했습니다.' },
          { status: 500 }
        );
      }
    } else {
      // 생성
      const { error } = await supabase
        .from('user_notification_preferences')
        .insert({
          ...subscriptionData,
          email_enabled: true, // 기본값
          daily_workout_enabled: true,
          daily_workout_time: '09:00:00',
          daily_workout_timezone: 'Asia/Seoul',
        });

      if (error) {
        console.error('Push subscription insert error:', error);
        return NextResponse.json(
          { error: '구독 정보 저장에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '푸시 알림이 활성화되었습니다.',
    });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      {
        error: '푸시 알림 구독에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
