import { getSessionSafe } from '@/lib/supabase';
import { urlBase64ToUint8Array } from '@/lib/push/urlBase64ToUint8Array';

export type PushPlatform = 'ios' | 'android' | 'desktop' | 'other';

export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export async function subscribeToPush(publicKey: string): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const keyBytes = urlBase64ToUint8Array(publicKey);
  const applicationServerKey = keyBytes as unknown as BufferSource;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

export async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch('/api/push/vapid-public-key', {
    method: 'GET',
    cache: 'no-store',
  });
  const data = (await res.json()) as { ok?: boolean; publicKey?: string };
  if (!res.ok || !data?.ok || !data.publicKey) {
    throw new Error('Failed to get VAPID public key');
  }
  return data.publicKey;
}

export function detectPushPlatform(): PushPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/mac|win|linux/.test(ua)) return 'desktop';
  return 'other';
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const { session } = await getSessionSafe();
  const token = session?.access_token;
  if (!token) throw new Error('Missing auth token');

  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription');
  }

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint,
      keys: { p256dh, auth },
      platform: detectPushPlatform(),
      userAgent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      installed: isPwaStandalone(),
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to save push subscription');
  }
}
