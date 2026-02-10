/**
 * 일일 운동 루틴 알림 발송 로직
 * 
 * 매일 아침 활성 루틴을 가진 사용자에게 해당 일자의 운동 루틴을 알림으로 발송합니다.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * VAPID 키 확인 (web-push 패키지 필요)
 * TODO: web-push 패키지 설치 필요: npm install web-push
 */
function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error('VAPID 키가 설정되지 않았습니다.');
  }

  // web-push 패키지가 설치되어 있으면 사용
  // 동적 import로 처리하여 패키지가 없어도 에러 없이 동작
  return { publicKey, privateKey };
}

/**
 * 일일 운동 루틴 알림 대상 조회
 */
export async function getDailyWorkoutNotificationTargets(targetDate: Date = new Date()) {
  const supabase = getServerSupabaseAdmin();

  // SQL 함수 사용 또는 직접 쿼리
  const { data, error } = await supabase.rpc('get_daily_workout_notification_targets', {
    target_date: targetDate.toISOString().split('T')[0],
  });

  if (error) {
    console.error('알림 대상 조회 실패:', error);
    // SQL 함수가 없으면 직접 쿼리
    return await getDailyWorkoutNotificationTargetsDirect(targetDate);
  }

  return data || [];
}

/**
 * 직접 쿼리로 알림 대상 조회 (fallback)
 */
async function getDailyWorkoutNotificationTargetsDirect(targetDate: Date) {
  const supabase = getServerSupabaseAdmin();
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // 활성 루틴과 해당 일자의 운동 조회
  const { data: routines, error } = await supabase
    .from('workout_routines')
    .select(
      `
      id,
      user_id,
      started_at,
      users:user_id (
        email
      ),
      user_notification_preferences:user_id (
        daily_workout_enabled,
        daily_workout_time,
        daily_workout_timezone,
        email_enabled,
        push_enabled,
        push_token
      ),
      workout_routine_days (
        id,
        day_number,
        exercises,
        completed_at
      )
    `
    )
    .eq('status', 'active');

  if (error) {
    console.error('루틴 조회 실패:', error);
    return [];
  }

  const targets: Array<{
    user_id: string;
    routine_id: string;
    day_number: number;
    notification_time: string;
    timezone: string;
    email_enabled: boolean;
    push_enabled: boolean;
    push_token?: string;
    email?: string;
  }> = [];

  routines?.forEach((routine: any) => {
    if (!routine.user_notification_preferences || !routine.user_notification_preferences.daily_workout_enabled) {
      return;
    }

    const startedAt = new Date(routine.started_at);
    const daysSinceStart = Math.floor(
      (targetDate.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    if (daysSinceStart < 1 || daysSinceStart > 7) {
      return; // 7일 범위를 벗어남
    }

    const day = routine.workout_routine_days?.find(
      (d: any) => d.day_number === daysSinceStart && !d.completed_at
    );

    if (!day) {
      return; // 해당 일자가 없거나 이미 완료됨
    }

    targets.push({
      user_id: routine.user_id,
      routine_id: routine.id,
      day_number: daysSinceStart,
      notification_time: routine.user_notification_preferences.daily_workout_time || '09:00:00',
      timezone: routine.user_notification_preferences.daily_workout_timezone || 'Asia/Seoul',
      email_enabled: routine.user_notification_preferences.email_enabled || false,
      push_enabled: routine.user_notification_preferences.push_enabled || false,
      push_token: routine.user_notification_preferences.push_token || undefined,
      email: routine.users?.email,
    });
  });

  return targets;
}

/**
 * 푸시 알림 발송
 * TODO: web-push 패키지 설치 필요: npm install web-push
 */
async function sendPushNotification(
  subscription: any,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    if (!process.env.VAPID_PRIVATE_KEY) {
      console.warn('VAPID 키가 없어 푸시 알림을 발송할 수 없습니다.');
      return false;
    }

    // web-push 패키지 동적 import (선택적)
    try {
      const webpush = (await import('web-push')).default;
      getVapidKeys();

      webpush.setVapidDetails(
        'mailto:support@posturelab.com',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!
      );

      const payload = JSON.stringify({
        title,
        body,
        data: data || {},
        icon: '/favicon.ico',
      });

      await webpush.sendNotification(subscription, payload);
      return true;
    } catch (importError) {
      console.warn('web-push 패키지가 설치되지 않았습니다. 푸시 알림을 건너뜁니다.');
      return false;
    }
  } catch (error) {
    console.error('푸시 알림 발송 실패:', error);
    return false;
  }
}

/**
 * 이메일 알림 발송
 */
async function sendEmailWorkoutNotification(
  email: string,
  dayNumber: number,
  exercises: any[]
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY가 없어 이메일 알림을 발송할 수 없습니다.');
      return false;
    }

    const exerciseList = exercises
      .map((ex, idx) => `${idx + 1}. ${ex.name} (${ex.duration}분)`)
      .join('\n');

    const totalDuration = exercises.reduce((sum, ex) => sum + (ex.duration || 0), 0);

    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F7F9FC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F9FC; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #2563EB 0%, #3B82F6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #FFFFFF;">
                오늘의 운동 루틴 - Day ${dayNumber}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1E293B;">
                오늘 수행할 운동 목록입니다. 총 <strong>${totalDuration}분</strong> 소요됩니다.
              </p>
              <div style="background-color: #F8FAFC; border-radius: 8px; padding: 20px; margin: 20px 0;">
                ${exercises.map((ex, idx) => `
                  <div style="margin-bottom: ${idx < exercises.length - 1 ? '15px' : '0'}; padding-bottom: ${idx < exercises.length - 1 ? '15px' : '0'}; border-bottom: ${idx < exercises.length - 1 ? '1px solid #E2E8F0' : 'none'};">
                    <h3 style="margin: 0 0 5px 0; font-size: 16px; color: #1E293B;">${idx + 1}. ${ex.name}</h3>
                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #64748B;">${ex.description}</p>
                    <p style="margin: 0; font-size: 12px; color: #94A3B8;">
                      ${ex.sets && ex.reps ? `${ex.sets}세트 × ${ex.reps}회` : ''}
                      ${ex.holdTime ? `${ex.holdTime}초 유지` : ''}
                      · ${ex.duration}분
                    </p>
                  </div>
                `).join('')}
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://posturelab.com'}/my-routine" 
                   style="display: inline-block; background-color: #2563EB; color: #FFFFFF; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                  내 루틴 보기
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `
오늘의 운동 루틴 - Day ${dayNumber}

오늘 수행할 운동 목록 (총 ${totalDuration}분):

${exerciseList}

내 루틴 보기: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://posturelab.com'}/my-routine
    `;

    const { error } = await resend.emails.send({
      from: 'PostureLab <onboarding@resend.dev>',
      to: [email],
      subject: `오늘의 운동 루틴 - Day ${dayNumber}`,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      throw new Error(`이메일 발송 실패: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('이메일 알림 발송 실패:', error);
    return false;
  }
}

/**
 * 일일 운동 루틴 알림 발송 (메인 함수)
 */
export async function sendDailyWorkoutNotifications(targetDate: Date = new Date()) {
  const supabase = getServerSupabaseAdmin();

  try {
    // 1. 알림 대상 조회
    const targets = await getDailyWorkoutNotificationTargets(targetDate);

    if (targets.length === 0) {
      console.log('발송할 알림 대상이 없습니다.');
      return { sent: 0, failed: 0 };
    }

    console.log(`알림 대상: ${targets.length}명`);

    let sentCount = 0;
    let failedCount = 0;

    // 2. 각 대상에게 알림 발송
    for (const target of targets) {
      try {
        // 해당 일자의 운동 정보 조회
        const { data: dayData } = await supabase
          .from('workout_routine_days')
          .select('exercises')
          .eq('routine_id', target.routine_id)
          .eq('day_number', target.day_number)
          .single();

        if (!dayData || !dayData.exercises || dayData.exercises.length === 0) {
          console.warn(`Day ${target.day_number} 운동 정보가 없습니다.`);
          continue;
        }

        const exercises = dayData.exercises;
        const exerciseNames = exercises.map((ex: any) => ex.name).join(', ');
        const totalDuration = exercises.reduce((sum: number, ex: any) => sum + (ex.duration || 0), 0);

        const title = `오늘의 운동 루틴 - Day ${target.day_number}`;
        const message = `${exerciseNames} 등 ${exercises.length}개 운동 (총 ${totalDuration}분)`;

        // 알림 레코드 생성
        const notificationData = {
          user_id: target.user_id,
          type: 'daily_workout',
          title,
          message,
          routine_id: target.routine_id,
          routine_day_id: dayData.id,
          action_url: '/my-routine',
          scheduled_for: new Date().toISOString(),
        };

        let emailSent = false;
        let pushSent = false;

        // 이메일 알림 발송
        if (target.email_enabled && target.email) {
          emailSent = await sendEmailWorkoutNotification(
            target.email,
            target.day_number,
            exercises
          );
        }

        // 푸시 알림 발송
        if (target.push_enabled && target.push_token) {
          try {
            const subscription = JSON.parse(target.push_token);
            pushSent = await sendPushNotification(subscription, title, message, {
              url: '/my-routine',
              routineId: target.routine_id,
              dayNumber: target.day_number,
            });
          } catch (error) {
            console.error('푸시 구독 파싱 실패:', error);
          }
        }

        // 알림 레코드 저장
        const { error: notifError } = await supabase.from('notifications').insert({
          ...notificationData,
          sent_via_email: emailSent,
          sent_via_push: pushSent,
          sent_at: new Date().toISOString(),
        });

        if (notifError) {
          console.error('알림 레코드 저장 실패:', notifError);
        }

        if (emailSent || pushSent) {
          sentCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`사용자 ${target.user_id} 알림 발송 실패:`, error);
        failedCount++;
      }
    }

    console.log(`알림 발송 완료: 성공 ${sentCount}건, 실패 ${failedCount}건`);

    return { sent: sentCount, failed: failedCount };
  } catch (error) {
    console.error('일일 알림 발송 중 오류:', error);
    throw error;
  }
}
