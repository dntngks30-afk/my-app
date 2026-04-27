'use client';

import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { supabase } from '@/lib/supabase';
import { NeoButton, NeoPageLayout } from '@/components/neobrutalism';

/** OAuth/PKCE는 canonical origin에서만 시작. env 미설정 시 현재 origin 사용(로컬/프리뷰) */
const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? null;
const SKIP_CANONICAL_REDIRECT = process.env.NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT === '1';

type OAuthProvider = 'google' | 'kakao';

function sanitizeProvider(provider: string | null | undefined): OAuthProvider | null {
  return provider === 'google' || provider === 'kakao' ? provider : null;
}

function getOAuthErrorMessage(provider: OAuthProvider | null): string {
  if (provider === 'google') return 'Google 로그인에 실패했습니다. 다시 시도해 주세요.';
  if (provider === 'kakao') return '카카오 로그인에 실패했습니다. 다시 시도해 주세요.';
  return 'OAuth 로그인에 실패했습니다. 다시 시도해 주세요.';
}

interface AppAuthClientProps {
  next: string;
  errorParam?: string | null;
  providerParam?: string | null;
}

export default function AppAuthClient({
  next,
  errorParam,
  providerParam,
}: AppAuthClientProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [oauthError, setOauthError] = useState<string | null>(null);

  /** PR-PAY-CONTINUITY-05 — movement-test 결과에서 온 경우, 로그인이 “처음으로 리셋”이 아님을 짧게 안내 */
  const continuityFromPublicResult =
    typeof next === 'string' &&
    (next.includes('/movement-test/') || next.includes('continue=execution'));

  useEffect(() => {
    if (errorParam === 'oauth') {
      const provider = sanitizeProvider(providerParam);
      setOauthError(getOAuthErrorMessage(provider));
    }
  }, [errorParam, providerParam]);

  const handleOAuth = async (provider: OAuthProvider) => {
    setOauthError(null);

    console.info('[AUTH-OAUTH]', {
      event: 'oauth_start',
      provider,
      currentOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      canonicalOriginConfigured: Boolean(CANONICAL_ORIGIN),
      canonicalOrigin: CANONICAL_ORIGIN,
      skipCanonicalRedirect: SKIP_CANONICAL_REDIRECT,
      nextPath: next,
    });

    // 1) Canonical origin 강제: alias 도메인에서 OAuth 시 canonical으로 리다이렉트 후 재진입
    if (
      typeof window !== 'undefined' &&
      CANONICAL_ORIGIN &&
      !SKIP_CANONICAL_REDIRECT &&
      window.location.origin !== CANONICAL_ORIGIN
    ) {
      console.info('[AUTH-OAUTH]', {
        event: 'oauth_canonical_redirect',
        provider,
        fromOrigin: window.location.origin,
        toOrigin: CANONICAL_ORIGIN,
        targetPath: window.location.pathname,
      });
      const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}`;
      window.location.replace(target);
      return;
    }

    // 2) redirectTo는 항상 canonical origin 사용 (PKCE/localStorage 일치)
    const base = CANONICAL_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
    const callbackUrl = new URL('/auth/callback', base);
    callbackUrl.searchParams.set('next', next);
    callbackUrl.searchParams.set('provider', provider);
    const redirectTo = callbackUrl.toString();

    console.info('[AUTH-OAUTH]', {
      event: 'oauth_redirect_to_built',
      provider,
      redirectToOrigin: callbackUrl.origin,
      redirectToPathname: callbackUrl.pathname,
    });

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      const status =
        error && typeof error === 'object' && 'status' in error
          ? (error as { status?: number }).status
          : undefined;
      console.error('[AUTH-OAUTH]', {
        event: 'oauth_signin_error',
        provider,
        message: error.message,
        name: error.name,
        status,
      });
      setOauthError(getOAuthErrorMessage(provider));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] py-12">
      <NeoPageLayout maxWidth="md">
        <div className="space-y-6">
          {continuityFromPublicResult && (
            <p
              className="text-center text-sm text-slate-600 rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              방금 본 결과로 돌아가 실행을 이어갑니다. 로그인만 마치면 됩니다.
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <NeoButton
              variant={mode === 'login' ? 'orange' : 'secondary'}
              onClick={() => setMode('login')}
              className="px-5 py-2"
            >
              로그인
            </NeoButton>
            <NeoButton
              variant={mode === 'signup' ? 'orange' : 'secondary'}
              onClick={() => setMode('signup')}
              className="px-5 py-2"
            >
              회원가입
            </NeoButton>
          </div>

          <div className="space-y-3">
            <NeoButton
              variant="secondary"
              onClick={() => handleOAuth('google')}
              className="w-full px-4 py-3"
            >
              Google로 계속하기
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleOAuth('kakao')}
              className="w-full px-4 py-3"
            >
              카카오로 계속하기
            </NeoButton>
            {oauthError && (
              <p className="text-sm text-red-600 rounded-2xl border-2 border-slate-900 bg-red-50 p-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                {oauthError}
              </p>
            )}
          </div>

          <AuthCard
            mode={mode}
            errorParam={errorParam}
            redirectTo={next}
          />
        </div>
      </NeoPageLayout>
    </div>
  );
}
