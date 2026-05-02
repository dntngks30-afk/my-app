'use client';

/**
 * AuthCard — 로그인/회원가입 폼 (MOVE RE auth surface)
 * signup standalone: `/signup` — MoveReAuthScreen 래핑
 * signup embedded: `/app/auth` — 바깥 MoveReAuthScreen과 중첩 없음
 * login standalone: `/login` — MoveReAuthScreen 래핑
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { trackAuthenticatedEvent } from '@/lib/analytics/trackAuthenticatedEvent';
import type { AcquisitionSource } from '@/lib/analytics/kpi-demographics-types';
import {
  ACQUISITION_SOURCE_LABELS,
  ACQUISITION_SOURCES,
  signupBirthDateToAgeBand,
} from '@/lib/analytics/kpi-demographics-types';
import { supabaseBrowser } from '@/lib/supabase';
import { replaceRouteAfterAuthSession } from '@/lib/readiness/navigateAfterAuth';
import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import { getPilotCodeForCurrentFlow } from '@/lib/pilot/pilot-context';
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
  /** `/app/auth?intent=` 과 함께만 의미 있음 — 회원가입·로그인 전환 시 URL 유지용 */
  authIntent?: string | null;
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

const SIGNUP_ACQUISITION_OPTIONS = ACQUISITION_SOURCES.filter((s) => s !== 'unknown');

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export default function AuthCard({
  mode,
  errorParam,
  redirectTo = DEFAULT_POST_AUTH_PATH,
  authIntent,
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
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCompactHeader = compactHeader || signupLayout === 'standalone';

  const birthDateMax = useMemo(() => localIsoDate(new Date()), []);

  const intentQs =
    typeof authIntent === 'string' && authIntent.trim().length > 0
      ? `&intent=${encodeURIComponent(authIntent.trim())}`
      : '';

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
        if (!passwordConfirm.trim()) {
          setError('비밀번호 확인을 입력해 주세요.');
          return;
        }
        if (password !== passwordConfirm) {
          setError('비밀번호가 서로 일치하지 않습니다.');
          return;
        }
        const nickTrim = nickname.trim();
        if (!nickTrim) {
          setError('닉네임을 입력해 주세요.');
          return;
        }
        if (!birthDate.trim()) {
          setError('생년월일을 입력해 주세요.');
          return;
        }
        if (signupBirthDateToAgeBand(birthDate) === 'unknown') {
          setError('생년월일을 확인해 주세요. (만 10~100세, 미래 날짜 불가)');
          return;
        }

        const acqPayload: AcquisitionSource =
          acquisitionSource === '' ? 'unknown' : acquisitionSource;
        const anonId = getOrCreateAnonId();
        const pilotCode = getPilotCodeForCurrentFlow();

        const res = await fetch('/api/auth/pilot-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailTrim,
            password,
            nickname: nickTrim,
            birthDate,
            acquisitionSource: acqPayload,
            anonId,
            pilotCode,
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

        await trackAuthenticatedEvent(
          'auth_success',
          {
            provider: 'email_password',
            next_path: redirectTo,
            pilot_code_present: Boolean(pilotCode),
          },
          {
            route_group: 'auth',
            anon_id: anonId,
          }
        );
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
        await trackAuthenticatedEvent(
          'auth_success',
          {
            provider: 'email_password',
            next_path: redirectTo,
            pilot_code_present: Boolean(getPilotCodeForCurrentFlow()),
          },
          {
            route_group: 'auth',
          }
        );
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
              <label htmlFor="password-confirm" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                비밀번호 확인
              </label>
              <Input
                id="password-confirm"
                type="password"
                placeholder="비밀번호 재입력"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
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
              <label htmlFor="birth-date" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                생년월일
              </label>
              <Input
                id="birth-date"
                type="date"
                required
                max={birthDateMax}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className={AUTH_INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="acquisition-source" className="mb-1.5 block text-xs font-medium text-[#dce1fb]/75">
                MOVE RE를 알게 된 경로 <span className="font-normal text-[#dce1fb]/45">(선택)</span>
              </label>
              <select
                id="acquisition-source"
                value={acquisitionSource}
                onChange={(e) => setAcquisitionSource((e.target.value || '') as AcquisitionSource | '')}
                className={`${AUTH_INPUT_CLASS} cursor-pointer`}
              >
                <option value="">선택 안 함</option>
                {SIGNUP_ACQUISITION_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {ACQUISITION_SOURCE_LABELS[key]}
                  </option>
                ))}
              </select>
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
                href={`/signup?next=${encodeURIComponent(redirectTo)}${intentQs}`}
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
                href={`/app/auth?next=${encodeURIComponent(redirectTo || DEFAULT_POST_AUTH_PATH)}${intentQs}`}
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
