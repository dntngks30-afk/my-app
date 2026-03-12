/**
 * 푸시 알림 클라이언트 유틸리티
 *
 * 브라우저 푸시 알림 권한 요청 및 토큰 관리.
 * SW 등록은 next-pwa가 단일 소유. 이 모듈은 기존 등록만 재사용.
 */

/** next-pwa가 등록한 SW의 scope와 동일 */
const SW_SCOPE = '/';

/**
 * 기존 Service Worker 등록 조회 (재사용 전용).
 * next-pwa(register:true)가 유일한 등록 주체. 직접 register() 호출 없음.
 * 푸시 구독/조회 시 이 함수로 registration을 얻는다.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    let registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    if (registration) return registration;

    // next-pwa 주입 스크립트가 아직 실행되지 않은 경우 대기 후 재시도
    await new Promise((r) => setTimeout(r, 400));
    registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    return registration ?? null;
  } catch {
    return null;
  }
}

/**
 * 푸시 알림 권한 요청
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('푸시 알림을 지원하지 않는 브라우저입니다.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // 권한 요청
  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * 푸시 구독 생성
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  publicKey: string
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    console.log('푸시 구독 성공:', subscription);
    return subscription;
  } catch (error) {
    console.error('푸시 구독 실패:', error);
    return null;
  }
}

/**
 * 기존 푸시 구독 조회
 */
export async function getExistingSubscription(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    console.error('구독 조회 실패:', error);
    return null;
  }
}

/**
 * 푸시 구독 해제
 */
export async function unsubscribeFromPush(
  registration: ServiceWorkerRegistration
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('푸시 구독 해제 성공');
      return true;
    }
    return false;
  } catch (error) {
    console.error('푸시 구독 해제 실패:', error);
    return false;
  }
}

/**
 * VAPID 공개 키를 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 푸시 구독 정보를 서버에 전송
 * accessToken: Bearer 토큰 (session.access_token)
 */
export async function sendSubscriptionToServer(
  subscription: PushSubscription,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/push-notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });

    if (!response.ok) {
      throw new Error('서버 전송 실패');
    }

    return true;
  } catch (error) {
    console.error('구독 정보 전송 실패:', error);
    return false;
  }
}

/**
 * 푸시 알림 지원 여부 확인
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}
