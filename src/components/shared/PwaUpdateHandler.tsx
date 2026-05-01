'use client';

import { useEffect, useState, useRef } from 'react';

type IdleCallbackHandle = number;
type IdleRequestCallback = (deadline: IdleDeadline) => void;

interface IdleWindow extends Window {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
}

/**
 * PWA 서비스 워커 업데이트 감지 및 자동 갱신
 * - 새 버전 감지 시 토스트 표시 후 자동 새로고침
 * - 무한 루프 방지: hasReloaded ref로 controllerchange 시 1회만 reload
 */
export default function PwaUpdateHandler() {
  const [showToast, setShowToast] = useState(false);
  const hasReloaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      if (hasReloaded.current) return;
      hasReloaded.current = true;
      setShowToast(true);
      setTimeout(() => window.location.reload(), 300);
    };

    let removeControllerListener: (() => void) | undefined;

    const setupUpdateDetection = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) return;

        if (registration.waiting) {
          setShowToast(true);
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && registration.waiting) {
              setShowToast(true);
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        const boundHandler = handleControllerChange;
        navigator.serviceWorker.addEventListener('controllerchange', boundHandler);
        removeControllerListener = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', boundHandler);
        };
      } catch {
        // SW 없음 또는 오류 시 무시
      }
    };

    const scheduleSetup = () => {
      const idleWindow = window as IdleWindow;

      if (typeof idleWindow.requestIdleCallback === 'function') {
        const idleId = idleWindow.requestIdleCallback(() => {
          void setupUpdateDetection();
        }, { timeout: 2500 });

        return () => {
          idleWindow.cancelIdleCallback?.(idleId);
        };
      }

      const timeoutId = window.setTimeout(() => {
        void setupUpdateDetection();
      }, 1500);

      return () => {
        window.clearTimeout(timeoutId);
      };
    };

    const cancelSchedule = scheduleSetup();

    return () => {
      cancelSchedule();
      removeControllerListener?.();
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
