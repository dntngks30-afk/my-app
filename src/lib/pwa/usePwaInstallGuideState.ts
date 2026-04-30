'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getUaLower,
  detectStandalone,
  detectInAppBrowserAppName,
  detectIsIos,
  detectIsAndroid,
} from '@/lib/browser/detectInAppBrowser';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type PwaInstallGuideStateName =
  | 'already_standalone'
  | 'android_in_app_browser'
  | 'ios_in_app_browser'
  | 'ios_safari'
  | 'android_install_prompt_available'
  | 'android_install_prompt_unavailable'
  | 'desktop_or_unknown';

export type PromptInstallResult = 'accepted' | 'dismissed' | 'unavailable' | 'error';

export type PwaInstallGuideState = {
  state: PwaInstallGuideStateName;
  hydrated: boolean;
  isStandalone: boolean;
  isIos: boolean;
  isAndroid: boolean;
  canPromptInstall: boolean;
  promptInstall: () => Promise<PromptInstallResult>;
};

function isLikelyAndroidBrowser(uaLower: string, isAndroid: boolean): boolean {
  if (!isAndroid) return false;
  if (/; wv\)/.test(uaLower)) return false;
  return /chrome\/|edg\//i.test(uaLower) || /samsungbrowser/i.test(uaLower);
}

function isIosSafari(uaLower: string, isIos: boolean): boolean {
  if (!isIos) return false;
  if (/crios|fxios|edgios|opios|opr\//i.test(uaLower)) return false;
  return /safari/i.test(uaLower) || /applewebkit/i.test(uaLower);
}

export function usePwaInstallGuideState(): PwaInstallGuideState {
  const [hydrated, setHydrated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [state, setState] = useState<PwaInstallGuideStateName>('desktop_or_unknown');
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const uaLower = getUaLower();
    const standalone = detectStandalone();
    const ios = detectIsIos(uaLower);
    const android = detectIsAndroid(uaLower);
    const inApp = detectInAppBrowserAppName(uaLower) !== null;

    setHydrated(true);
    setIsStandalone(standalone);
    setIsIos(ios);
    setIsAndroid(android);

    if (standalone) {
      setState('already_standalone');
    } else if (inApp && ios) {
      setState('ios_in_app_browser');
    } else if (inApp && android) {
      setState('android_in_app_browser');
    } else if (isIosSafari(uaLower, ios)) {
      setState('ios_safari');
    } else if (isLikelyAndroidBrowser(uaLower, android)) {
      setState('android_install_prompt_unavailable');
    } else {
      setState('desktop_or_unknown');
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanPromptInstall(true);
      setState('android_install_prompt_available');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const promptInstall = useCallback(async (): Promise<PromptInstallResult> => {
    const evt = deferredPromptRef.current;
    if (!evt) return 'unavailable';
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

  return useMemo(() => ({ state, hydrated, isStandalone, isIos, isAndroid, canPromptInstall, promptInstall }), [state, hydrated, isStandalone, isIos, isAndroid, canPromptInstall, promptInstall]);
}
