'use client';

import { useCallback, useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import MoveReAuthScreen from '@/components/auth/MoveReAuthScreen';
import AuthSocialButtons from '@/components/auth/AuthSocialButtons';
import { InAppAuthHandoffSheet } from '@/components/auth/InAppAuthHandoffSheet';
import {
  startOAuthClient,
  sanitizeProvider,
  getOAuthErrorMessage,
  type OAuthProvider,
} from '@/lib/auth/startOAuthClient';
import {
  getUaLower,
  isAuthHandoffInAppBrowser,
  detectIsAndroid,
  detectIsIos,
} from '@/lib/browser/detectInAppBrowser';
import { buildAuthHandoffAbsoluteUrl } from '@/lib/auth/buildAuthHandoffUrl';
import { buildAndroidChromeIntentUrl } from '@/lib/auth/androidChromeIntent';
import {
  extractBridgeQueryFromInternalPath,
  sanitizeAuthNextPath,
  DEFAULT_HANDOFF_NEXT,
} from '@/lib/auth/authHandoffContract';
import { getPilotCodeFromCurrentUrl } from '@/lib/pilot/pilot-context';

interface AppAuthClientProps {
  next: string;
  errorParam?: string | null;
  providerParam?: string | null;
}

const LOGIN_HEADLINE = '내 분석을 이어서 확인하세요';

export default function AppAuthClient({
  next,
  errorParam,
  providerParam,
}: AppAuthClientProps) {
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [env, setEnv] = useState({ inApp: false, isAndroid: false, isIos: false });
  const [iosHandoffUrl, setIosHandoffUrl] = useState<string | null>(null);
  const [uaHydrated, setUaHydrated] = useState(false);

  const safeNext = sanitizeAuthNextPath(next, DEFAULT_HANDOFF_NEXT);

  useEffect(() => {
    if (errorParam === 'oauth') {
      const provider = sanitizeProvider(providerParam);
      setOauthError(getOAuthErrorMessage(provider));
    }
  }, [errorParam, providerParam]);

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
    const fromNext = extractBridgeQueryFromInternalPath(safeNext);
    const pilot = fromNext.pilot ?? getPilotCodeFromCurrentUrl();
    return {
      publicResultId: fromNext.publicResultId,
      stage: fromNext.stage,
      anonId: fromNext.anonId,
      pilot,
    };
  }, [safeNext]);

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

  /**
   * PR-AUTH-IOS-LOGIN-POLICY-01 최종 선택:
   * - Android in-app: 변경 없이 항상 handoff → Chrome intent.
   * - iOS Safari/일반 브라우저: inApp=false 이라 아래 분기 전에 startOAuthClient 로 직접 OAuth.
   * - iOS in-app + Kakao: 예외 없이 handoff sheet(외부 Safari 유도) 사용.
   */
  const runOAuth = (provider: OAuthProvider) => {
    if (!uaHydrated) return;

    if (!env.inApp) {
      void startOAuthClient({ provider, next: safeNext, setOauthError });
      return;
    }

    if (env.isAndroid) {
      const e = bridgeExtras();
      const url = buildAuthHandoffAbsoluteUrl({
        method: provider === 'google' ? 'google' : 'kakao',
        next: safeNext,
        publicResultId: e.publicResultId,
        stage: e.stage,
        anonId: e.anonId,
        pilot: e.pilot,
      });
      if (!url) {
        void startOAuthClient({ provider, next: safeNext, setOauthError });
        return;
      }
      openHandoffUrl(url);
      return;
    }

    if (env.isIos) {
      if (provider === 'google') {
        setOauthError('iOS에서는 카카오 또는 이메일로 계속해 주세요.');
        return;
      }
      const e = bridgeExtras();
      const url = buildAuthHandoffAbsoluteUrl({
        method: 'kakao',
        next: safeNext,
        publicResultId: e.publicResultId,
        stage: e.stage,
        anonId: e.anonId,
        pilot: e.pilot,
      });
      if (!url) {
        void startOAuthClient({ provider: 'kakao', next: safeNext, setOauthError });
        return;
      }
      openHandoffUrl(url);
      return;
    }

    const e = bridgeExtras();
    const url = buildAuthHandoffAbsoluteUrl({
      method: provider === 'google' ? 'google' : 'kakao',
      next: safeNext,
      publicResultId: e.publicResultId,
      stage: e.stage,
      anonId: e.anonId,
      pilot: e.pilot,
    });
    if (!url) {
      void startOAuthClient({ provider, next: safeNext, setOauthError });
      return;
    }
    openHandoffUrl(url);
  };

  const onInAppEmailHandoff = useCallback(
    (mode: 'login' | 'signup') => {
      const e = bridgeExtras();
      const url = buildAuthHandoffAbsoluteUrl({
        method: 'email',
        mode,
        next: safeNext,
        publicResultId: e.publicResultId,
        stage: e.stage,
        anonId: e.anonId,
        pilot: e.pilot,
      });
      if (!url) return;
      openHandoffUrl(url);
    },
    [bridgeExtras, openHandoffUrl, safeNext],
  );

  return (
    <>
      <MoveReAuthScreen headline={LOGIN_HEADLINE}>
        <AuthCard
          mode="login"
          errorParam={errorParam}
          redirectTo={safeNext}
          compactHeader
          signupLayout="embedded"
          inAppEmailHandoff={uaHydrated && env.inApp}
          onInAppEmailHandoff={onInAppEmailHandoff}
          handoffUaReady={uaHydrated}
          oauthSlot={
            <AuthSocialButtons
              onGoogle={() => runOAuth('google')}
              onKakao={() => runOAuth('kakao')}
              showGoogle={uaHydrated ? !env.isIos : false}
              oauthError={oauthError}
              disabled={!uaHydrated}
            />
          }
        />
      </MoveReAuthScreen>
      {iosHandoffUrl ? (
        <InAppAuthHandoffSheet
          handoffUrl={iosHandoffUrl}
          onDismiss={() => setIosHandoffUrl(null)}
        />
      ) : null}
    </>
  );
}
