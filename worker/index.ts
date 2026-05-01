/**
 * Custom worker code injected into next-pwa generated SW.
 * Listens for SKIP_WAITING to activate waiting worker (used by PwaUpdateHandler).
 */
type WaitableEvent = Event & {
  waitUntil(promise: Promise<unknown>): void;
};

type PushPayloadEvent = WaitableEvent & {
  data?: {
    json(): unknown;
  } | null;
};

type NotificationClickEvent = WaitableEvent & {
  notification: Notification;
};

type MoveReWindowClient = {
  url: string;
  focus?: () => Promise<MoveReWindowClient>;
  navigate?: (url: string) => Promise<MoveReWindowClient | null>;
};

type MoveReClients = {
  matchAll(options: {
    type: 'window';
    includeUncontrolled: boolean;
  }): Promise<MoveReWindowClient[]>;
  openWindow?: (url: string) => Promise<MoveReWindowClient | null>;
};

type MoveReServiceWorkerGlobal = typeof globalThis & {
  clients: MoveReClients;
  location: Location;
  registration: ServiceWorkerRegistration;
  skipWaiting(): Promise<void>;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  addEventListener(type: 'push', listener: (event: PushPayloadEvent) => void): void;
  addEventListener(type: 'notificationclick', listener: (event: NotificationClickEvent) => void): void;
};

type PushPayload = {
  title?: unknown;
  body?: unknown;
  url?: unknown;
  tag?: unknown;
  type?: unknown;
};

type NormalizedPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  type: string;
};

const sw = self as unknown as MoveReServiceWorkerGlobal;

const TEST_PUSH_FALLBACK = {
  title: 'MOVE RE 테스트 알림',
  body: '알림이 정상적으로 연결됐어요.',
  url: '/app/home?source=push&type=test',
  tag: 'move-re-test',
  type: 'test',
} as const;

const CLICK_FALLBACK_URL = '/app/home?source=push';

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function safeInternalPath(value: unknown, fallback: string, externalFallback = fallback): string {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;

  try {
    const parsed = new URL(value.trim(), sw.location.origin);
    if (parsed.origin !== sw.location.origin) return externalFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function readPushPayload(event: PushPayloadEvent): NormalizedPushPayload {
  let raw: PushPayload = {};

  try {
    const parsed = event.data?.json();
    if (parsed && typeof parsed === 'object') {
      raw = parsed as PushPayload;
    }
  } catch {
    raw = {};
  }

  return {
    title: stringOrFallback(raw.title, TEST_PUSH_FALLBACK.title),
    body: stringOrFallback(raw.body, TEST_PUSH_FALLBACK.body),
    url: safeInternalPath(raw.url, TEST_PUSH_FALLBACK.url, CLICK_FALLBACK_URL),
    tag: stringOrFallback(raw.tag, TEST_PUSH_FALLBACK.tag),
    type: stringOrFallback(raw.type, TEST_PUSH_FALLBACK.type),
  };
}

sw.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});

sw.addEventListener('push', (event: PushPayloadEvent) => {
  const payload = readPushPayload(event);

  event.waitUntil(
    sw.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/brand/move-re-icon-192.png',
      tag: payload.tag,
      data: {
        url: payload.url,
        type: payload.type,
      },
    })
  );
});

sw.addEventListener('notificationclick', (event: NotificationClickEvent) => {
  event.notification.close();

  const notificationData = event.notification.data as { url?: unknown } | undefined;
  const targetUrl = safeInternalPath(notificationData?.url, CLICK_FALLBACK_URL);

  event.waitUntil((async () => {
    try {
      const windows = await sw.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const appWindow = windows.find((client) => {
        try {
          return new URL(client.url).origin === sw.location.origin;
        } catch {
          return false;
        }
      });

      if (appWindow) {
        const navigated = appWindow.navigate ? await appWindow.navigate(targetUrl) : appWindow;
        const focusTarget = navigated ?? appWindow;
        await focusTarget.focus?.();
        return;
      }

      if (sw.clients.openWindow) {
        await sw.clients.openWindow(targetUrl);
      }
    } catch {
      // Keep notification click handling best-effort so SW activation stays healthy.
    }
  })());
});
