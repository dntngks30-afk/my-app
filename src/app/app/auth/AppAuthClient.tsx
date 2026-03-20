'use client';

import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { supabase } from '@/lib/supabase';
import { NeoButton, NeoPageLayout } from '@/components/neobrutalism';

/** OAuth/PKCE는 canonical origin에서만 시작. env 미설정 시 현재 origin 사용(로컬/프리뷰) */
const CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? null;
const SKIP_CANONICAL_REDIRECT = process.env.NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT === '1';

interface AppAuthClientProps {
  next: string;
  errorParam?: string | null;
}

export default function AppAuthClient({ next, errorParam }: AppAuthClientProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam === 'oauth') {
      setOauthError('OAuth 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [errorParam]);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setOauthError(null);

    // 1) Canonical origin 강제: alias 도메인에서 OAuth 시 canonical으로 리다이렉트 후 재진입
    if (
      typeof window !== 'undefined' &&
      CANONICAL_ORIGIN &&
      !SKIP_CANONICAL_REDIRECT &&
      window.location.origin !== CANONICAL_ORIGIN
    ) {
      const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}`;
      window.location.replace(target);
      return;
    }

    // 2) redirectTo는 항상 canonical origin 사용 (PKCE/localStorage 일치)
    const base = CANONICAL_ORIGIN || (typeof window !== 'undefined' ? window.location.origin : '');
    const redirectTo = `${base}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setOauthError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] py-12">
      <NeoPageLayout maxWidth="md">
        <div className="space-y-6">
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
