'use client';

import { useEffect, useRef, useState } from 'react';

const APP_VERSION_STORAGE_KEY = 'move-re:last-app-version';
const UPDATE_RELOAD_GUARD_KEY = 'move-re:pwa-update-reload-at';
const MIN_UPDATE_CHECK_INTERVAL_MS = 30_000;
const RELOAD_GUARD_WINDOW_MS = 10_000;

type AppVersionPayload = {
  ok?: boolean;
  version?: unknown;
};

async function fetchAppVersion(): Promise<string | null> {
  try {
    const res = await fetch('/api/app-version', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      return null;
    }

    const payload = (await res.json()) as AppVersionPayload;

    if (payload.ok !== true || typeof payload.version !== 'string') {
      return null;
    }

    const version = payload.version.trim();
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

function safeReadLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function canReloadForUpdate(): boolean {
  try {
    const now = Date.now();
    const lastReloadAt = Number(
      window.sessionStorage.getItem(UPDATE_RELOAD_GUARD_KEY) || 0
    );

    if (
      Number.isFinite(lastReloadAt) &&
      now - lastReloadAt < RELOAD_GUARD_WINDOW_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(UPDATE_RELOAD_GUARD_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

/**
 * PWA 서비스 워커 업데이트 감지 및 자동 갱신
 * - 새 버전 감지 시 토스트 표시 후 자동 새로고침
 * - 무한 루프 방지: hasReloaded ref로 controllerchange 시 1회만 reload
 */
export default function PwaUpdateHandler() {
  const [showToast, setShowToast] = useState(false);
  const hasReloaded = useRef(false);
  const isCheckingRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let removeControllerListener: (() => void) | undefined;
    let removeUpdateFoundListener: (() => void) | undefined;

    const requestSkipWaiting = (
      registration: ServiceWorkerRegistration | null | undefined
    ) => {
      const waitingWorker = registration?.waiting;
      if (!waitingWorker) return false;

      setShowToast(true);
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      return true;
    };

    const handleControllerChange = () => {
      if (hasReloaded.current) return;
      if (!canReloadForUpdate()) return;

      hasReloaded.current = true;
      setShowToast(true);
      setTimeout(() => window.location.reload(), 300);
    };

    let mounted = true;

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );
    removeControllerListener = () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
    };

    const runUpdateCheck = async (options?: { force?: boolean }) => {
      const force = options?.force === true;
      if (!force) {
        if (
          Date.now() - lastCheckAtRef.current <
          MIN_UPDATE_CHECK_INTERVAL_MS
        ) {
          return;
        }
      }
      if (isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) {
          return;
        }

        const serverVersion = await fetchAppVersion();

        let versionChanged = false;
        if (serverVersion !== null) {
          const lastSeen = safeReadLocalStorage(APP_VERSION_STORAGE_KEY);
          if (!lastSeen) {
            safeWriteLocalStorage(APP_VERSION_STORAGE_KEY, serverVersion);
          } else if (lastSeen !== serverVersion) {
            safeWriteLocalStorage(APP_VERSION_STORAGE_KEY, serverVersion);
            versionChanged = true;
          }
        }

        try {
          await registration.update();
        } catch {
          // ignore
        }

        requestSkipWaiting(registration);

        if (versionChanged && registration.waiting) {
          requestSkipWaiting(registration);
        }
      } catch {
        // SW 없음 또는 오류 시 무시
      } finally {
        lastCheckAtRef.current = Date.now();
        isCheckingRef.current = false;
      }
    };

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!mounted) return;

        if (!registration) {
          void runUpdateCheck({ force: true });
          return;
        }

        const onUpdateFound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && registration.waiting) {
              requestSkipWaiting(registration);
            }
          });
        };

        registration.addEventListener('updatefound', onUpdateFound);
        removeUpdateFoundListener = () => {
          registration.removeEventListener('updatefound', onUpdateFound);
        };

        if (!mounted) return;
        void runUpdateCheck({ force: true });
      } catch {
        if (mounted) {
          void runUpdateCheck({ force: true });
        }
      }
    })();

    const runThrottledCheck = () => {
      void runUpdateCheck();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runThrottledCheck();
      }
    };

    const onPageShow = () => {
      runThrottledCheck();
    };

    const onFocus = () => {
      runThrottledCheck();
    };

    const onOnline = () => {
      runThrottledCheck();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      mounted = false;
      removeControllerListener?.();
      removeUpdateFoundListener?.();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <>
      {showToast && (
        <div
          className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-full border-2 border-slate-900 bg-[#F8F6F0] px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm font-semibold text-slate-800">
            최신 버전을 적용 중입니다{' '}
            <span className="text-[#FB923C]">🚀</span>
          </span>
        </div>
      )}
    </>
  );
}
