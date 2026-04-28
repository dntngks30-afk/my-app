'use client';

import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import MoveReAuthScreen from '@/components/auth/MoveReAuthScreen';
import AuthSocialButtons from '@/components/auth/AuthSocialButtons';
import {
  startOAuthClient,
  sanitizeProvider,
  getOAuthErrorMessage,
  type OAuthProvider,
} from '@/lib/auth/startOAuthClient';

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
  const [otpMailSent, setOtpMailSent] = useState(false);

  useEffect(() => {
    if (errorParam === 'oauth') {
      const provider = sanitizeProvider(providerParam);
      setOauthError(getOAuthErrorMessage(provider));
    }
  }, [errorParam, providerParam]);

  useEffect(() => {
    setOtpMailSent(false);
  }, [mode]);

  const runOAuth = (provider: OAuthProvider) => startOAuthClient({ provider, next, setOauthError });

  const signupHeadline = '나를 위한 리셋 여정을 시작하세요';

  const headlineResolved = otpMailSent
    ? '메일 확인'
    : mode === 'login'
      ? '내 분석을 이어서 확인하세요'
      : signupHeadline;

  const subcopyResolved = otpMailSent ? '이메일 링크로 가입을 완료하세요.' : undefined;

  return (
    <MoveReAuthScreen headline={headlineResolved} subcopy={subcopyResolved ?? undefined}>
      {!otpMailSent ? (
        <div className="mb-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-gradient-to-r from-[#ffb77d] to-[#ffb68e] text-[#0c1324] shadow-md'
                : 'border border-white/15 bg-[#151b2d]/70 text-[#dce1fb]/85 hover:bg-[#1a2235]'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-[#ffb77d] to-[#ffb68e] text-[#0c1324] shadow-md'
                : 'border border-white/15 bg-[#151b2d]/70 text-[#dce1fb]/85 hover:bg-[#1a2235]'
            }`}
          >
            회원가입
          </button>
        </div>
      ) : null}

      <AuthCard
        mode={mode}
        errorParam={errorParam}
        redirectTo={next}
        compactHeader
        signupLayout={mode === 'signup' ? 'embedded' : undefined}
        onMailLinkScheduled={() => setOtpMailSent(true)}
        oauthSlot={
          otpMailSent ? null : (
            <AuthSocialButtons
              onGoogle={() => runOAuth('google')}
              onKakao={() => runOAuth('kakao')}
              oauthError={oauthError}
            />
          )
        }
      />
    </MoveReAuthScreen>
  );
}
