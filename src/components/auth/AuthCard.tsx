'use client';

/**
 * AuthCard — 로그인/회원가입 폼 (MOVE RE auth surface)
 * signup standalone: `/signup` — MoveReAuthScreen 래핑
 * signup embedded: `/app/auth` — 바깥 MoveReAuthScreen과 중첩 없음
 * login standalone: `/login` — MoveReAuthScreen 래핑
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { replaceRouteAfterAuthSession } from '@/lib/readiness/navigateAfterAuth';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/auth/AuthShell';
import MoveReAuthScreen from '@/components/auth/MoveReAuthScreen';

const LOGIN_HEADLINE = '내 분석을 이어서 확인하세요';
const SIGNUP_HEADLINE = '나를 위한 리셋 여정을 시작하세요';

/** StitchLanding 「내 몸 상태 1분 체크하기」와 동일 gradient·그림자·반응 — 폼에서는 w-full px-8(PR-AUTH-UI-03C) */
const AUTH_PRIMARY_CTA_CLASS =
  'group inline-flex min-h-[64px] w-full items-center justify-center rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] px-8 py-5 text-base font-semibold text-[#4d2600] shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition-all duration-500 hover:opacity-90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 md:text-lg';

/** INTRO 배경 안 폼 입력 — 포커스는 public 액센트(PR-AUTH-UI-03B) */
const AUTH_INPUT_CLASS =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-[#0c1324]/55 px-4 text-[15px] text-[#dce1fb] placeholder:text-[#dce1fb]/35 outline-none transition focus-visible:border-[var(--mr-public-accent)] focus-visible:ring-2 focus-visible:ring-[var(--mr-public-accent)]/20';


interface AuthCardProps {
  mode: 'login' | 'signup';
  errorParam?: string | null;
  redirectTo?: string;
  compactHeader?: boolean;
  oauthSlot?: React.ReactNode;
  /** signup: 페이지 단독 vs /app/auth 탭 삽입 */
  signupLayout?: 'standalone' | 'embedded';
  onMailLinkScheduled?: () => void;
}

const isDevSignup = process.env.NODE_ENV === 'development';

const DEFAULT_POST_AUTH_PATH = '/app/home';

export default function AuthCard({
  mode,
  errorParam,
  redirectTo = DEFAULT_POST_AUTH_PATH,
  compactHeader = false,
  oauthSlot,
  signupLayout = 'standalone',
  onMailLinkScheduled,
}: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const effectiveCompactHeader = compactHeader || signupLayout === 'standalone';

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
        if (isDevSignup) {
          const completeUrl = `${window.location.origin}/signup/complete?next=${encodeURIComponent(redirectTo)}`;
          const { data, error: err } = await supabaseBrowser.auth.signUp({
            email: email.trim(),
            password: password || 'dev1234',
            options: { emailRedirectTo: completeUrl },
          });
          if (err) {
            setError(err.message);
            return;
          }
          if (data.session) {
            await replaceRouteAfterAuthSession(router, redirectTo);
            return;
          }
          setError(
            'Supabase 이메일 확인이 켜져 있습니다. 대시보드 > Auth > Providers > Email에서 "Confirm email" 비활성화 후 재시도하세요.'
          );
          return;
        }
        const completeUrl = `${window.location.origin}/signup/complete?next=${encodeURIComponent(redirectTo)}`;
        const { error: err } = await supabaseBrowser.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: completeUrl,
            shouldCreateUser: true,
          },
        });
        if (err) {
          setError(err.message);
          return;
        }
        onMailLinkScheduled?.();
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
        await replaceRouteAfterAuthSession(router, redirectTo);
      }
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';

  const formInner = (
    <AuthShell compactHeader={effectiveCompactHeader}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-900/35 bg-red-950/35 px-3 py-2.5"
          >
            <p className="text-sm text-red-100/95">{error}</p>
          </div>
        ) : null}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        {(isLogin || (mode === 'signup' && isDevSignup)) && (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
              비밀번호
              {mode === 'signup' && isDevSignup ? (
                <span className="ml-2 text-[0.7rem] text-[#dce1fb]/55">(개발용: 인증 없이 바로 가입)</span>
              ) : null}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'signup' && isDevSignup ? '비밀번호 (미입력 시 dev1234)' : '비밀번호'}
              required={isLogin}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        )}

        {mode === 'signup' ? (
          <p className="text-[0.7rem] leading-relaxed text-[#dce1fb]/55">
            회원가입 시{' '}
            <Link href="/terms" className="font-medium underline-offset-2 mr-public-text-accent hover:underline">
              이용약관
            </Link>
            {' 및 '}
            <Link href="/privacy" className="font-medium underline-offset-2 mr-public-text-accent hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className={AUTH_PRIMARY_CTA_CLASS}
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
        </button>
      </form>

      {oauthSlot ? <div className="mt-8 space-y-3">{oauthSlot}</div> : null}

      <div className="mt-8 space-y-3 text-center">
        <p className="text-sm text-[#dce1fb]/70">
          {isLogin ? (
            <>
              계정이 없으신가요?{' '}
              <Link
                href={`/signup?next=${encodeURIComponent(redirectTo)}`}
                className="font-semibold underline-offset-4 mr-public-text-accent hover:underline"
              >
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <Link
                href={`/app/auth?next=${encodeURIComponent(redirectTo || DEFAULT_POST_AUTH_PATH)}`}
                className="font-semibold underline-offset-4 mr-public-text-accent hover:underline"
              >
                로그인
              </Link>
            </>
          )}
        </p>
        <p className="text-sm">
          <Link href="/" className="text-[#dce1fb]/55 underline-offset-4 transition hover:text-[#dce1fb]/85 hover:underline">
            ← 메인으로 돌아가기
          </Link>
        </p>
      </div>
    </AuthShell>
  );

  const mailConfirmationBody = (
    <>
      <p className="mb-8 text-center text-sm leading-relaxed text-[#dce1fb]">
        해당 이메일 주소로 링크를 발송했습니다. 링크를 클릭하면 추가 정보 입력 단계로 이동합니다.
      </p>
      <div className="space-y-3 text-center">
        <p className="text-sm text-[#dce1fb]/70">
          이미 계정이 있으신가요?{' '}
          <Link
            href={`/app/auth?next=${encodeURIComponent(redirectTo || DEFAULT_POST_AUTH_PATH)}`}
            className="font-semibold underline-offset-4 mr-public-text-accent hover:underline"
          >
            로그인
          </Link>
        </p>
        <p className="text-sm">
          <Link href="/" className="text-[#dce1fb]/55 underline-offset-4 transition hover:text-[#dce1fb]/85 hover:underline">
            ← 메인으로 돌아가기
          </Link>
        </p>
      </div>
    </>
  );

  if (mode === 'signup' && signupSuccess) {
    if (signupLayout === 'embedded') {
      return (
        <AuthShell compactHeader>
          {mailConfirmationBody}
        </AuthShell>
      );
    }
    return (
      <MoveReAuthScreen headline="메일 확인">
        <AuthShell compactHeader>{mailConfirmationBody}</AuthShell>
      </MoveReAuthScreen>
    );
  }

  if (mode === 'signup' && signupLayout === 'standalone') {
    return (
      <MoveReAuthScreen headline={SIGNUP_HEADLINE}>
        {formInner}
      </MoveReAuthScreen>
    );
  }

  if (mode === 'login' && signupLayout === 'standalone') {
    return (
      <MoveReAuthScreen headline={LOGIN_HEADLINE}>
        {formInner}
      </MoveReAuthScreen>
    );
  }

  return formInner;
}
