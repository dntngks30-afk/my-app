'use client';

/**
 * AuthCard - 로그인/회원가입 폼 (네오브루탈리즘)
 * mode="login" | "signup"
 * signup: signInWithOtp → 메일 확인 UI
 * login: signInWithPassword → / 리다이렉트
 * errorParam: searchParams.error (auth_failed 등) — 서버에서 props로 전달
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/auth/AuthShell';
import { NeoButton } from '@/components/neobrutalism';

const NEO_INPUT =
  'rounded-2xl border-2 border-slate-900 bg-white h-11 px-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)] focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-0 text-slate-800 placeholder:text-slate-400';

interface AuthCardProps {
  mode: 'login' | 'signup';
  /** searchParams.error — 서버에서 전달 (예: auth_failed) */
  errorParam?: string | null;
  /** 로그인 성공 시 리다이렉트 경로 (미지정 시 /) */
  redirectTo?: string;
}

export default function AuthCard({ mode, errorParam, redirectTo = '/' }: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  useEffect(() => {
    if (errorParam === 'auth_failed') {
      setError('이메일 링크가 만료되었거나 잘못되었습니다. 다시 시도해주세요.');
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: err } = await supabaseBrowser.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: `${window.location.origin}/signup/complete`,
            shouldCreateUser: true,
          },
        });
        if (err) {
          setError(err.message);
          return;
        }
        setSignupSuccess(true);
      } else {
        const { error: err } = await supabaseBrowser.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) {
          setError(err.message);
          return;
        }
        router.replace(redirectTo);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  if (mode === 'signup' && signupSuccess) {
    return (
      <AuthShell
        badgeText="회원가입"
        title="메일 확인"
        description="이메일로 보내드린 링크를 클릭하여 가입을 완료하세요."
      >
        <p className="text-sm text-slate-600 mb-6">
          해당 이메일 주소로 링크를 발송했습니다. 링크를 클릭하면 추가 정보 입력 단계로 이동합니다.
        </p>
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-slate-600">
            이미 계정이 있으신가요?{' '}
            <Link href={`/app/auth?next=${encodeURIComponent(redirectTo || '/')}`} className="text-orange-600 font-semibold underline-offset-4 hover:underline">
              로그인
            </Link>
          </p>
          <p className="text-sm">
            <Link href="/" className="text-slate-600 underline-offset-4 hover:underline">
              ← 메인으로 돌아가기
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badgeText={isLogin ? '로그인' : '회원가입'}
      title={isLogin ? '로그인' : '회원가입'}
      description={
        isLogin
          ? '계정에 로그인하여 맞춤 교정 솔루션을 이용하세요.'
          : '계정을 만들고 맞춤 교정 솔루션을 받아보세요.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-2xl border-2 border-slate-900 bg-red-50 p-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-800 mb-1">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={NEO_INPUT}
          />
        </div>

        {isLogin && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-800 mb-1">
              비밀번호
            </label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={NEO_INPUT}
            />
          </div>
        )}

        {mode === 'signup' && (
          <p className="text-xs text-slate-600">
            회원가입 시{' '}
            <Link href="/terms" className="text-orange-600 font-semibold underline-offset-4 hover:underline">
              이용약관
            </Link>
            {' 및 '}
            <Link href="/privacy" className="text-orange-600 font-semibold underline-offset-4 hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        )}

        <NeoButton
          type="submit"
          variant="orange"
          disabled={loading}
          className="w-full px-6 py-3"
        >
          {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
        </NeoButton>
      </form>

      <div className="mt-6 space-y-3 text-center">
        <p className="text-sm text-slate-600">
          {isLogin ? (
            <>
              계정이 없으신가요?{' '}
              <Link href="/signup" className="text-orange-600 font-semibold underline-offset-4 hover:underline">
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <Link href={`/app/auth?next=${encodeURIComponent(redirectTo || '/')}`} className="text-orange-600 font-semibold underline-offset-4 hover:underline">
                로그인
              </Link>
            </>
          )}
        </p>
        <p className="text-sm">
          <Link href="/" className="text-slate-600 underline-offset-4 hover:underline">
            ← 메인으로 돌아가기
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
