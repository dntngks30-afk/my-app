/**
 * 푸시 알림 권한 요청 컴포넌트
 * 
 * 사용자에게 푸시 알림 권한을 요청하고 구독을 설정합니다.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  getExistingSubscription,
  sendSubscriptionToServer,
  isPushNotificationSupported,
} from '@/lib/push-notifications/client';
import { supabase } from '@/lib/supabase';

export default function PushNotificationPrompt() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // 지원 여부 확인
    if (!isPushNotificationSupported()) {
      return;
    }

    setSupported(true);
    setPermission(Notification.permission);

    // 사용자 ID 가져오기
    const getUserId = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }
    };

    getUserId();

    // 기존 구독 확인
    const checkExistingSubscription = async () => {
      const registration = await registerServiceWorker();
      if (registration) {
        const subscription = await getExistingSubscription(registration);
        if (subscription) {
          setIsRegistered(true);
        }
      }
    };

    checkExistingSubscription();
  }, []);

  const handleEnableNotifications = async () => {
    if (!supported || !userId) {
      return;
    }

    setIsSubscribing(true);

    try {
      // 1. Service Worker 등록
      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Service Worker 등록 실패');
      }

      // 2. 권한 요청
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission !== 'granted') {
        alert('푸시 알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        setIsSubscribing(false);
        return;
      }

      // 3. VAPID 공개 키 가져오기 (환경 변수 또는 API에서)
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID 공개 키가 설정되지 않았습니다.');
        setIsSubscribing(false);
        return;
      }

      // 4. 푸시 구독 생성
      const subscription = await subscribeToPush(registration, vapidPublicKey);
      if (!subscription) {
        throw new Error('푸시 구독 생성 실패');
      }

      // 5. 서버에 구독 정보 전송
      const success = await sendSubscriptionToServer(subscription, userId);
      if (!success) {
        throw new Error('서버 전송 실패');
      }

      setIsRegistered(true);
    } catch (error) {
      console.error('푸시 알림 설정 실패:', error);
      alert('푸시 알림 설정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!supported) {
    return null; // 지원하지 않는 브라우저에서는 표시하지 않음
  }

  if (permission === 'granted' && isRegistered) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-800">
            <span>✓</span>
            <span className="text-sm">푸시 알림이 활성화되었습니다</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-sm text-red-800">
            푸시 알림이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-[var(--text)]">푸시 알림 받기</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-[var(--muted)]">
          매일 아침 오늘의 운동 루틴을 알림으로 받아보세요.
        </p>
        <Button
          onClick={handleEnableNotifications}
          disabled={isSubscribing || !userId}
          className="w-full bg-[var(--brand)] text-white"
        >
          {isSubscribing ? '설정 중...' : '알림 활성화'}
        </Button>
      </CardContent>
    </Card>
  );
}
