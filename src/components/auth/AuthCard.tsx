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
import type { PilotSignupGender } from '@/lib/auth/pilotSignupValidation';
import { PILOT_SIGNUP_GENDERS } from '@/lib/auth/pilotSignupValidation';

const LOGIN_HEADLINE = '내 분석을 이어서 확인하세요';
const SIGNUP_HEADLINE = '나를 위한 리셋 여정을 시작하세요';

const GENDER_LABELS: Record<PilotSignupGender, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
  prefer_not_to_say: '선택하지 않음',
};

/** StitchLanding 「내 몸 상태 1분 체크하기」와 동일 gradient·그림자·반응 — 폼에서는 w-full px-8(PR-AUTH-UI-03C) */
const AUTH_PRIMARY_CTA_CLASS =
  'group inline-flex min-h-[64px] w-full items-center justify-center rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] px-8 py-5 text-base font-semibold text-[#4d2600] shadow-[0_18px_60px_rgba(0,0,0,0.35)] transition-all duration-500 hover:opacity-90 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 md:text-lg';

/** INTRO 배경 안 폼 입력 — 포커스는 public 액센트(PR-AUTH-UI-03B) */
const AUTH_INPUT_CLASS =
  'h-12 w-full rounded-2xl border border-white/[0.08] bg-[#0c1324]/55 px-4 text-[15px] text-[#dce1fb] placeholder:text-[#dce1fb]/35 outline-none transition focus-visible:border-[var(--mr-public-accent)] focus-visible:ring-2 focus-visible:ring-[var(--mr-public-accent)]/20';

const AUTH_SELECT_CLASS =
  AUTH_INPUT_CLASS + ' appearance-none bg-[#0c1324]/55';

interface AuthCardProps {
  mode: 'login' | 'signup';
  errorParam?: string | null;
  redirectTo?: string;
  compactHeader?: boolean;
  oauthSlot?: React.ReactNode;
  /** signup: 페이지 단독 vs /app/auth 탭 삽입 */
  signupLayout?: 'standalone' | 'embedded';
  /** @deprecated PR-AUTH-PILOT-PASSWORD-SIGNUP-02: 더 이상 호출되지 않음 (호환용 props 유지) */
  onMailLinkScheduled?: () => void;
  /** PR-AUTH-HANDOFF-01: 인앱에서 이메일 인증 분기 시 외부 브라우저 handoff */
  inAppEmailHandoff?: boolean;
  onInAppEmailHandoff?: (mode: 'login' | 'signup') => void;
  /** PR-AUTH-HANDOFF-01: 인앱 이메일 handoff 사용 시 UA 하이드레이션 전 버튼 비활성화 */
  handoffUaReady?: boolean;
}

const DEFAULT_POST_AUTH_PATH = '/app/home';

export default function AuthCard({
  mode,
  errorParam,
  redirectTo = DEFAULT_POST_AUTH_PATH,
  compactHeader = false,
  oauthSlot,
  signupLayout = 'standalone',
  inAppEmailHandoff,
  onInAppEmailHandoff,
  handoffUaReady = true,
}: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<PilotSignupGender | ''>('');
  const [ageInput, setAgeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCompactHeader = compactHeader || signupLayout === 'standalone';

  useEffect(() => {
    if (errorParam === 'auth_failed') {
      setError('이메일 링크가 만료되었거나 잘못되었습니다. 다시 시도해주세요.');
    }
  }, [errorParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inAppEmailHandoff && onInAppEmailHandoff) {
      onInAppEmailHandoff(mode === 'signup' ? 'signup' : 'login');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const emailTrim = email.trim();
        if (!emailTrim) {
          setError('이메일을 입력해 주세요.');
          return;
        }
        if (password.length < 8) {
          setError('비밀번호는 최소 8자 이상이어야 합니다.');
          return;
        }
        const nickTrim = nickname.trim();
        if (!nickTrim) {
          setError('닉네임을 입력해 주세요.');
          return;
        }
        if (!gender || !PILOT_SIGNUP_GENDERS.includes(gender as PilotSignupGender)) {
          setError('성별을 선택해 주세요.');
          return;
        }
        const ageNum = Number.parseInt(ageInput, 10);
        if (!Number.isFinite(ageNum) || ageNum < 14 || ageNum > 100) {
          setError('나이는 14~100 사이의 숫자로 입력해 주세요.');
          return;
        }

        const res = await fetch('/api/auth/pilot-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailTrim,
            password,
            nickname: nickTrim,
            gender,
            age: ageNum,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: { code?: string; message?: string };
        };

        if (!res.ok || !json.ok) {
          const msg =
            json.error?.message ??
            '가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
          setError(msg);
          return;
        }

        const { error: signInErr } = await supabaseBrowser.auth.signInWithPassword({
          email: emailTrim.toLowerCase(),
          password,
        });
        if (signInErr) {
          setError('가입은 완료되었습니다. 로그인 화면에서 다시 시도해 주세요.');
          return;
        }

        await replaceRouteAfterAuthSession(router, redirectTo);
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

        {isLogin ? (
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
              비밀번호
            </label>
            <Input
              id="password"
              type="password"
              placeholder="비밀번호"
              required={isLogin}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                placeholder="8자 이상"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="nickname" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                닉네임
              </label>
              <Input
                id="nickname"
                type="text"
                placeholder="1~20자"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={AUTH_INPUT_CLASS}
                maxLength={24}
              />
            </div>
            <div>
              <label htmlFor="gender" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                성별
              </label>
              <select
                id="gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value as PilotSignupGender | '')}
                className={AUTH_SELECT_CLASS}
              >
                <option value="">선택해 주세요</option>
                {PILOT_SIGNUP_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="age" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                나이
              </label>
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                min={14}
                max={100}
                placeholder="14~100"
                required
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
          </>
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
          disabled={loading || (Boolean(inAppEmailHandoff) && !handoffUaReady)}
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
                onClick={(e) => {
                  if (inAppEmailHandoff && onInAppEmailHandoff) {
                    e.preventDefault();
                    onInAppEmailHandoff('signup');
                  }
                }}
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
                onClick={(e) => {
                  if (inAppEmailHandoff && onInAppEmailHandoff) {
                    e.preventDefault();
                    onInAppEmailHandoff('login');
                  }
                }}
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
