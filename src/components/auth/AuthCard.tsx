'use client';

/**
 * AuthCard — 로그인/회원가입 폼 (MOVE RE auth surface)
 * signup (standalone): /signup 페이지 — 내부에서 MoveReAuthScreen 포함
 * signup (embedded): /app/auth 에서 회원가입 탭 — 바깥 MoveReAuthScreen과 중첩되지 않음
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { replaceRouteAfterAuthSession } from '@/lib/readiness/navigateAfterAuth';
import { Input } from '@/components/ui/input';
import AuthShell from '@/components/auth/AuthShell';
import MoveReAuthScreen from '@/components/auth/MoveReAuthScreen';

const GLASS_INPUT =
  'h-11 rounded-xl border border-white/10 bg-[#070d1f]/90 px-3 text-sm text-[#dce1fb] shadow-inner placeholder:text-[#dce1fb]/45 focus-visible:border-[#ffb77d]/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ffb77d]/30';

const SIGNUP_HEADLINE = '나를 위한 리셋 여정을 시작하세요';

interface AuthCardProps {
  mode: 'login' | 'signup';
  errorParam?: string | null;
  redirectTo?: string;
  compactHeader?: boolean;
  oauthSlot?: React.ReactNode;
  /** signup: 페이지 단독(기본) vs /app/auth 탭 삽입(embedded, 바깥 MoveRe가 레이아웃 담당) */
  signupLayout?: 'standalone' | 'embedded';
  /** 프로덕션 OTP 발송 후 상위 헤드라인 전환(embedded 전용 hooks) */
  onMailLinkScheduled?: () => void;
}

const isDevSignup = process.env.NODE_ENV === 'development';

const DEFAULT_POST_AUTH_PATH = '/app/home';

function SignupStandaloneWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MoveReAuthScreen headline={SIGNUP_HEADLINE}>{children}</MoveReAuthScreen>
  );
}

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

  const primaryCta = (
    <button
      type="submit"
      disabled={loading}
      className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ffb77d] to-[#ffb68e] text-sm font-semibold text-[#0c1324] shadow-md transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-60"
    >
      {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
    </button>
  );

  const formInner = (
    <AuthShell
      badgeText={isLogin ? '로그인' : isDevSignup ? '개발자용 회원가입' : '회원가입'}
      title={isLogin ? '로그인' : '회원가입'}
      description={
        isLogin
          ? '계정에 로그인하여 맞춤 교정 솔루션을 이용하세요.'
          : isDevSignup
            ? '이메일 인증 없이 바로 가입 (개발 환경 전용)'
            : '계정을 만들고 맞춤 교정 솔루션을 받아보세요.'
      }
      compactHeader={compactHeader}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-900/40 bg-red-950/40 px-3 py-2.5 backdrop-blur-sm"
          >
            <p className="text-sm text-red-200/95">{error}</p>
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/80">
            이메일
          </label>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={GLASS_INPUT}
          />
        </div>

        {(isLogin || (mode === 'signup' && isDevSignup)) && (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/80">
              비밀번호
              {mode === 'signup' && isDevSignup && (
                <span className="ml-2 text-[0.7rem] text-amber-200/80">(개발용: 인증 없이 바로 가입)</span>
              )}
            </label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'signup' && isDevSignup ? '비밀번호 (미입력 시 dev1234)' : '비밀번호'}
              required={isLogin}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={GLASS_INPUT}
            />
          </div>
        )}

        {mode === 'signup' && (
          <p className="text-[0.7rem] leading-relaxed text-[#dce1fb]/55">
            회원가입 시{' '}
            <Link href="/terms" className="font-medium text-[#ffb77d] underline-offset-2 hover:underline">
              이용약관
            </Link>
            {' 및 '}
            <Link href="/privacy" className="font-medium text-[#ffb77d] underline-offset-2 hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </p>
        )}

        {primaryCta}
      </form>

      {oauthSlot ? <div className="mt-8 space-y-3">{oauthSlot}</div> : null}

      <div className="mt-8 space-y-3 text-center">
        <p className="text-sm text-[#dce1fb]/70">
          {isLogin ? (
            <>
              계정이 없으신가요?{' '}
              <Link
                href={`/signup?next=${encodeURIComponent(redirectTo)}`}
                className="font-semibold text-[#ffb77d] underline-offset-4 hover:underline"
              >
                회원가입
              </Link>
            </>
          ) : (
            <>
              이미 계정이 있으신가요?{' '}
              <Link
                href={`/app/auth?next=${encodeURIComponent(redirectTo || DEFAULT_POST_AUTH_PATH)}`}
                className="font-semibold text-[#ffb77d] underline-offset-4 hover:underline"
              >
                로그인
              </Link>
            </>
          )}
        </p>
        <p className="text-sm">
          <Link href="/" className="text-[#dce1fb]/55 underline-offset-4 hover:text-[#dce1fb]/85 hover:underline">
            ← 메인으로 돌아가기
          </Link>
        </p>
      </div>
    </AuthShell>
  );

  const mailConfirmationBody = (
    <>
      <p className="mb-8 text-center text-sm leading-relaxed text-[#dce1fb]/85">
        해당 이메일 주소로 링크를 발송했습니다. 링크를 클릭하면 추가 정보 입력 단계로 이동합니다.
      </p>
      <div className="space-y-3 text-center">
        <p className="text-sm text-[#dce1fb]/75">
          이미 계정이 있으신가요?{' '}
          <Link
            href={`/app/auth?next=${encodeURIComponent(redirectTo || DEFAULT_POST_AUTH_PATH)}`}
            className="font-semibold text-[#ffb77d] underline-offset-4 hover:underline"
          >
            로그인
          </Link>
        </p>
        <p className="text-sm">
          <Link href="/" className="text-[#dce1fb]/60 underline-offset-4 hover:text-[#dce1fb]/90 hover:underline">
            ← 메인으로 돌아가기
          </Link>
        </p>
      </div>
    </>
  );

  if (mode === 'signup' && signupSuccess) {
    if (signupLayout === 'embedded') {
      return (
        <AuthShell badgeText="" title="" description="" compactHeader={true}>
          {mailConfirmationBody}
        </AuthShell>
      );
    }
    return (
      <MoveReAuthScreen headline="메일 확인" subcopy="이메일 링크로 가입을 완료하세요.">
        <AuthShell badgeText="" title="" description="" compactHeader={true}>
          {mailConfirmationBody}
        </AuthShell>
      </MoveReAuthScreen>
    );
  }

  if (mode === 'signup' && signupLayout === 'standalone') {
    return <SignupStandaloneWrapper>{formInner}</SignupStandaloneWrapper>;
  }

  return formInner;
}
