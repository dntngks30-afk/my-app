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

export type PwaInstallGuideMode =
  | 'already_standalone'
  | 'android_in_app_browser'
  | 'ios_in_app_browser'
  | 'ios_safari'
  | 'android_install_prompt_available'
  | 'android_install_prompt_unavailable'
  | 'desktop_or_unknown';

export type PromptInstallResult =
  | 'accepted'
  | 'dismissed'
  | 'unavailable'
  | 'error';

export type PwaInstallGuideState = {
  mode: PwaInstallGuideMode;
  isStandalone: boolean;
  isInAppBrowser: boolean;
  isIos: boolean;
  isAndroid: boolean;
  canPromptInstall: boolean;
  promptInstall: () => Promise<PromptInstallResult>;
  hydrated: boolean;
};

function isLikelyMobileChromiumBrowser(uaLower: string, isAndroidUa: boolean): boolean {
  if (!isAndroidUa) return false;
  if (/; wv\)/.test(uaLower)) return false;
  if (/version\/[\d.]+.*mobile.*safari/i.test(uaLower) && !/crios/i.test(uaLower)) return false;
  return /chrome\/|edg\//i.test(uaLower) || /samsungbrowser/i.test(uaLower);
}

function isIosSafari(uaLower: string, isIosUa: boolean, inApp: boolean): boolean {
  if (!isIosUa || inApp) return false;
  if (/crios|fxios|edgios|opios|opr\//i.test(uaLower)) return false;
  return /safari/i.test(uaLower) || /applewebkit/i.test(uaLower);
}

export function usePwaInstallGuideState(): PwaInstallGuideState {
  const [hydrated, setHydrated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [canPromptInstall, setCanPromptInstall] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const uaLower = getUaLower();
    setIsStandalone(detectStandalone());

    const inApp = detectInAppBrowserAppName(uaLower) !== null;
    setIsInAppBrowser(inApp);

    const ios = detectIsIos(uaLower);
    const android = detectIsAndroid(uaLower);
    setIsIos(ios);
    setIsAndroid(android);
    setHydrated(true);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const mode: PwaInstallGuideMode = useMemo(() => {
    if (!hydrated) return 'desktop_or_unknown';
    if (isStandalone) return 'already_standalone';

    const uaLower = getUaLower();
    const iosUa = detectIsIos(uaLower);
    const androidUa = detectIsAndroid(uaLower);
    const inApp = detectInAppBrowserAppName(uaLower) !== null;

    if (androidUa && inApp) return 'android_in_app_browser';
    if (iosUa && inApp) return 'ios_in_app_browser';
    if (iosUa && isIosSafari(uaLower, iosUa, false)) return 'ios_safari';

    if (androidUa) {
      if (canPromptInstall && isLikelyMobileChromiumBrowser(uaLower, androidUa)) {
        return 'android_install_prompt_available';
      }
      return 'android_install_prompt_unavailable';
    }

    return 'desktop_or_unknown';
  }, [hydrated, isStandalone, canPromptInstall]);

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    if (isIos) return 'unavailable';
    const evt = deferredPromptRef.current;
    if (!evt || typeof evt.prompt !== 'function') return 'unavailable';

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
  }, [isIos]);

  return {
    mode,
    isStandalone,
    isInAppBrowser,
    isIos,
    isAndroid,
    canPromptInstall,
    promptInstall,
    hydrated,
  };
}
