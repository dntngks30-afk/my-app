'use client';

import { useEffect, useState, useCallback } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export interface PwaInstallState {
  canPromptInstall: boolean;
  isIOS: boolean;
  isInAppBrowser: boolean;
  isStandalone: boolean;
}

export function usePwaInstall() {
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // iOS: iPhone/iPad + Safari
    const ua = navigator.userAgent;
    const iosCheck = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iosCheck);

    // In-app browser: Kakao, Instagram, Facebook webview
    const inAppPatterns = [
      /KAKAOTALK/i,
      /Instagram/i,
      /FBAN|FBAV/i,
      /NAVER/i,
      /Line\//i,
    ];
    setIsInAppBrowser(inAppPatterns.some((p) => p.test(ua)));

    // Standalone: 이미 앱으로 실행 중
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanPromptInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (typeof window === 'undefined') return 'unavailable';
    if (!deferredPrompt) return 'unavailable';

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      return outcome;
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    canPromptInstall,
    isIOS,
    isInAppBrowser,
    isStandalone,
    promptInstall,
  };
}
