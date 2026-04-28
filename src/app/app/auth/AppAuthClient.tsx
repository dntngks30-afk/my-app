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

const LOGIN_HEADLINE = '내 분석을 이어서 확인하세요';
const signupHeadline = '나를 위한 리셋 여정을 시작하세요';

/** StitchLanding 로그인 submit과 같은 gradient 패밀리 — 카드형 CTA보다 그림자만 약화 */
const modeChipActive =
  'rounded-full px-5 py-2 text-sm font-semibold text-[#4d2600] transition-all duration-500 bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] shadow-[0_10px_32px_rgba(0,0,0,0.28)] hover:opacity-90 active:scale-[0.985]';

const modeChipIdle =
  'rounded-full px-5 py-2 text-sm font-semibold text-[#dce1fb] transition-all duration-500 border border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.06] hover:opacity-90';

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

  const runOAuth = (provider: OAuthProvider) =>
    startOAuthClient({ provider, next, setOauthError });

  const headlineResolved = otpMailSent
    ? '메일 확인'
    : mode === 'login'
      ? LOGIN_HEADLINE
      : signupHeadline;

  const otpNotice =
    otpMailSent ? (
      <p className="mx-auto max-w-sm rounded-xl border border-white/[0.08] bg-[#0c1324]/55 px-3 py-2 text-[13px] leading-snug text-[#dce1fb]/65">
        이메일 링크로 가입을 완료하세요.
      </p>
    ) : null;

  return (
    <MoveReAuthScreen headline={headlineResolved} noticeSlot={otpNotice ?? undefined}>
      {!otpMailSent ? (
        <div
          className="flex justify-center gap-2"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          <button
            type="button"
            onClick={() => setMode('login')}
            className={mode === 'login' ? modeChipActive : modeChipIdle}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={mode === 'signup' ? modeChipActive : modeChipIdle}
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
        signupLayout="embedded"
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
