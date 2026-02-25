'use client';

import { useEffect, useState } from 'react';
import AuthCard from '@/components/auth/AuthCard';
import { supabase } from '@/lib/supabase';

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
    <div className="space-y-4">
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'login'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--muted)]'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'signup'
              ? 'bg-[var(--brand)] text-white'
              : 'bg-[var(--surface-2)] text-[var(--muted)]'
          }`}
        >
          회원가입
        </button>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          className="w-full rounded-[var(--radius)] border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          Google로 계속하기
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('kakao')}
          className="w-full rounded-[var(--radius)] border border-[color:var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
        >
          카카오로 계속하기
        </button>
        {oauthError && (
          <p className="text-sm text-[var(--warn-text)]">{oauthError}</p>
        )}
      </div>

      <AuthCard
        mode={mode}
        errorParam={errorParam}
        redirectTo={mode === 'login' ? next : '/'}
      />
    </div>
  );
}
