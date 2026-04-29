'use client';

import { useCallback, useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { InAppAuthHandoffSheet } from '@/components/auth/InAppAuthHandoffSheet';
import {
  extractBridgeQueryFromInternalPath,
  sanitizeAuthNextPath,
} from '@/lib/auth/authHandoffContract';
import { buildAuthHandoffAbsoluteUrl } from '@/lib/auth/buildAuthHandoffUrl';
import { buildAndroidChromeIntentUrl } from '@/lib/auth/androidChromeIntent';
import { getUaLower, isAuthHandoffInAppBrowser, detectIsAndroid, detectIsIos } from '@/lib/browser/detectInAppBrowser';
import { getPilotCodeFromCurrentUrl } from '@/lib/pilot/pilot-context';

/** 로그인·회원가입 후 기본 복귀 (app/auth/page.tsx와 동일 계약) */
const DEFAULT_POST_AUTH_PATH = '/app/home';

interface SignupClientProps {
  errorParam?: string | null;
  /** 결과·실행 퍼널 복귀용. 유효하지 않으면 기본 경로 */
  next?: string;
}

function resolveRedirectTo(next: string | undefined): string {
  return sanitizeAuthNextPath(next, DEFAULT_POST_AUTH_PATH);
}

export default function SignupClient({ errorParam, next }: SignupClientProps) {
  const redirectTo = resolveRedirectTo(next);
  const [env, setEnv] = useState({ inApp: false, isAndroid: false, isIos: false });
  const [uaHydrated, setUaHydrated] = useState(false);
  const [iosHandoffUrl, setIosHandoffUrl] = useState<string | null>(null);

  useEffect(() => {
    const ua = getUaLower();
    setEnv({
      inApp: isAuthHandoffInAppBrowser(ua),
      isAndroid: detectIsAndroid(ua),
      isIos: detectIsIos(ua),
    });
    setUaHydrated(true);
  }, []);

  const bridgeExtras = useCallback(() => {
    const fromNext = extractBridgeQueryFromInternalPath(redirectTo);
    const pilot = fromNext.pilot ?? getPilotCodeFromCurrentUrl();
    return {
      publicResultId: fromNext.publicResultId,
      stage: fromNext.stage,
      anonId: fromNext.anonId,
      pilot,
    };
  }, [redirectTo]);

  const openHandoffUrl = useCallback(
    (url: string) => {
      if (env.inApp && env.isAndroid) {
        window.location.href = buildAndroidChromeIntentUrl(url) || url;
        return;
      }
      if (env.inApp && env.isIos) {
        setIosHandoffUrl(url);
        return;
      }
      window.location.href = url;
    },
    [env],
  );

  const onInAppEmailHandoff = useCallback(
    (mode: 'login' | 'signup') => {
      const e = bridgeExtras();
      const url = buildAuthHandoffAbsoluteUrl({
        method: 'email',
        mode,
        next: redirectTo,
        publicResultId: e.publicResultId,
        stage: e.stage,
        anonId: e.anonId,
        pilot: e.pilot,
      });
      if (!url) return;
      openHandoffUrl(url);
    },
    [bridgeExtras, openHandoffUrl, redirectTo],
  );

  return (
    <>
      <AuthCard
        mode="signup"
        errorParam={errorParam}
        redirectTo={redirectTo}
        inAppEmailHandoff={uaHydrated && env.inApp}
        onInAppEmailHandoff={onInAppEmailHandoff}
        handoffUaReady={uaHydrated}
      />
      {iosHandoffUrl ? (
        <InAppAuthHandoffSheet
          handoffUrl={iosHandoffUrl}
          onDismiss={() => setIosHandoffUrl(null)}
        />
      ) : null}
    </>
  );
}
