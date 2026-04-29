'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getUaLower,
  detectStandalone,
  detectInAppBrowserAppName,
  detectIsIos,
  detectIsAndroid,
} from '@/lib/browser/detectInAppBrowser';

/** Chromium `beforeinstallprompt` — DOM lib에 없을 수 있음 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InAppBrowserName =
  | 'kakao'
  | 'instagram'
  | 'youtube'
  | 'threads'
  | 'facebook'
  | 'unknown'
  | null;

export type PwaInstallGuideMode =
  | 'standalone'
  | 'in_app'
  | 'android_chrome_prompt'
  | 'android_chrome_manual'
  | 'ios_safari'
  | 'desktop_or_other';

export type PromptInstallResult =
  | 'accepted'
  | 'dismissed'
  | 'unavailable'
  | 'error';

export type PwaInstallGuideState = {
  mode: PwaInstallGuideMode;
  isStandalone: boolean;
  isInAppBrowser: boolean;
  inAppBrowserName: InAppBrowserName;
  isIos: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  canPromptInstall: boolean;
  promptInstall: () => Promise<PromptInstallResult>;
  /** 클라이언트 하이드레이션 후 true */
  hydrated: boolean;
};

export function detectInAppBrowserName(uaLower: string): InAppBrowserName {
  const a = detectInAppBrowserAppName(uaLower);
  if (a === null) return null;
  if (a === 'android_webview' || a === 'naver' || a === 'line') return 'unknown';
  return a;
}

/** Android WebView 등은 제외하고 일반 크롬/엣지 앱으로 본다 */
function isLikelyMobileChromiumBrowser(uaLower: string, isAndroidUa: boolean): boolean {
  if (!isAndroidUa) return false;
  if (/; wv\)/.test(uaLower)) return false;
  if (/version\/[\d.]+.*mobile.*safari/i.test(uaLower) && !/crios/i.test(uaLower)) return false;
  return /chrome\/|edg\//i.test(uaLower) || /samsungbrowser/i.test(uaLower);
}

/** iOS에서 Safari 앱 (인앱 아님, Chrome iOS 등 제외) */
function isIosSafariStandaloneGuide(uaLower: string, isIosUa: boolean, inApp: boolean): boolean {
  if (!isIosUa || inApp) return false;
  if (/crios|fxios|edgios|opios|opr\//i.test(uaLower)) return false;
  return /safari/i.test(uaLower) || /applewebkit/i.test(uaLower);
}

function computeIsSafariUi(uaLower: string): boolean {
  return /safari/i.test(uaLower) && !/chrome|crios|android/i.test(uaLower);
}

function computeIsChromeUi(uaLower: string): boolean {
  return /chrome/i.test(uaLower) && !/edg/i.test(uaLower);
}

export function usePwaInstallGuideState(): PwaInstallGuideState {
  const [hydrated, setHydrated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [inAppBrowserName, setInAppBrowserName] = useState<InAppBrowserName>(null);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isChrome, setIsChrome] = useState(false);
  const [canPromptInstall, setCanPromptInstall] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const uaLower = getUaLower();
    setIsStandalone(detectStandalone());
    const inAppName = detectInAppBrowserName(uaLower);
    const inApp = inAppName !== null;
    setInAppBrowserName(inAppName);
    setIsInAppBrowser(inApp);
    const ios = detectIsIos(uaLower);
    const android = detectIsAndroid(uaLower);
    setIsIos(ios);
    setIsAndroid(android);
    setIsSafari(computeIsSafariUi(uaLower));
    setIsChrome(computeIsChromeUi(uaLower));
    setHydrated(true);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const mode: PwaInstallGuideMode = useMemo(() => {
    if (!hydrated) return 'desktop_or_other';
    if (isStandalone) return 'standalone';
    if (isInAppBrowser) return 'in_app';

    const uaLower = getUaLower();
    const androidUa = detectIsAndroid(uaLower);
    const iosUa = detectIsIos(uaLower);

    if (androidUa && isLikelyMobileChromiumBrowser(uaLower, androidUa)) {
      if (canPromptInstall) return 'android_chrome_prompt';
      return 'android_chrome_manual';
    }

    if (iosUa && isIosSafariStandaloneGuide(uaLower, iosUa, false)) {
      return 'ios_safari';
    }

    return 'desktop_or_other';
  }, [hydrated, isStandalone, isInAppBrowser, canPromptInstall]);

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    const evt = deferredPromptRef.current;
    if (!evt || typeof evt.prompt !== 'function') {
      return 'unavailable';
    }
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      deferredPromptRef.current = null;
      setCanPromptInstall(false);
      return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
    } catch {
      deferredPromptRef.current = null;
      setCanPromptInstall(false);
      return 'error';
    }
  }, []);

  return {
    mode,
    isStandalone,
    isInAppBrowser,
    inAppBrowserName,
    isIos,
    isAndroid,
    isSafari,
    isChrome,
    canPromptInstall,
    promptInstall,
    hydrated,
  };
}
