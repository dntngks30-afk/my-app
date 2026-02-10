/**
 * 푸시 알림 구독 API
 * 
 * POST /api/push-notifications/subscribe
 * 
 * 클라이언트에서 생성한 푸시 구독 정보를 받아서 DB에 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

/**
 * 요청에서 사용자 ID 추출
 */
async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    // Authorization 헤더가 없으면 body에서 userId 사용
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('User authentication error:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userId: bodyUserId } = body;

    if (!subscription) {
      return NextResponse.json({ error: 'subscription은 필수입니다.' }, { status: 400 });
    }

    // 사용자 ID 확인 (헤더 또는 body에서)
    let userId = await getCurrentUserId(req);
    if (!userId && bodyUserId) {
      userId = bodyUserId;
    }

    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
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
