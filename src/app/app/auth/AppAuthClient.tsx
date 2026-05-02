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
  shouldUseInAppEmailAuthHandoff,
  shouldUseOAuthHandoffForProvider,
} from '@/lib/auth/authExternalBrowserPolicy';
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
import { getPilotCodeForCurrentFlow } from '@/lib/pilot/pilot-context';

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
    const pilot = fromNext.pilot ?? getPilotCodeForCurrentFlow();
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
   * PR-AUTH-IOS-INAPP-KAKAO-DIRECT-01:
   * - 비인앱(Safari 등): startOAuthClient 직행.
   * - Android 인앱: 기존과 동일하게 handoff URL + Chrome intent.
   * - iOS 인앱 + Google: 버튼 미노출·오류 메시지 유지(핸드오프 없음).
   * - iOS 인앱 + Kakao: 시트 없이 startOAuthClient 로 인앱에서 OAuth 진행.
   * - 그 외 인앱: 기존 핸드오프 폴백.
   */
  const runOAuth = (provider: OAuthProvider) => {
    if (!uaHydrated) return;

    if (!env.inApp) {
      void startOAuthClient({ provider, next: safeNext, setOauthError });
      return;
    }

    if (env.isIos && provider === 'google') {
      setOauthError('iOS에서는 카카오 또는 이메일로 계속해 주세요.');
      return;
    }

    if (shouldUseOAuthHandoffForProvider(env, provider)) {
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

    void startOAuthClient({ provider, next: safeNext, setOauthError });
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
          inAppEmailHandoff={uaHydrated && shouldUseInAppEmailAuthHandoff(env)}
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
