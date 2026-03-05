'use client';

/**
 * Stripe 결제 성공 - 클라이언트 UI
 * sessionIdParam: 서버에서 searchParams.session_id 전달
 * nextParam: success_url의 next (active 확정 후 자동 이동, 이탈 복귀용 CTA)
 */
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';

/** 오픈 리다이렉트 방지 - 허용 prefix만 redirect에 사용 (레거시 7일 루틴 경로 제외) */
const ALLOWED_NEXT_PREFIXES = ['/app/home', '/app/reports', '/app'];

/** 레거시 7일 루틴/deep-test 경로 → /app/home로 치환 */
const LEGACY_PREFIXES = ['/app/routine', '/my-routine', '/app/deep-test'];

function isLegacyNext(next: string | undefined | null): boolean {
  if (!next || typeof next !== 'string') return false;
  return LEGACY_PREFIXES.some((p) => next === p || next.startsWith(`${p}/`));
}

function isValidNextForRedirect(next: string | undefined | null): boolean {
  if (!next || typeof next !== 'string') return false;
  if (!next.startsWith('/') || next.includes('//')) return false;
  return ALLOWED_NEXT_PREFIXES.some((p) => next === p || next.startsWith(`${p}/`));
}

/** 결제 성공 후 이동할 canonical 경로 (레거시면 /app/home) */
function resolveRedirectTarget(next: string | undefined | null): string {
  const canonical = '/app/home';
  if (!next || typeof next !== 'string') return canonical;
  if (isLegacyNext(next)) return canonical;
  if (isValidNextForRedirect(next)) return next;
  return canonical;
}

interface PaymentInfo {
  sessionId: string;
  planName: string;
  planTier: string;
  amount: number;
  subscriptionId?: string;
  isSubscription: boolean;
}

interface StripeSuccessClientProps {
  sessionIdParam?: string | null;
  nextParam?: string | null;
}

export default function StripeSuccessClient({
  sessionIdParam,
  nextParam,
}: StripeSuccessClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routineCreated, setRoutineCreated] = useState(false);
  const [routineCreating, setRoutineCreating] = useState(false);

  useEffect(() => {
    const verifyPaymentAndCreateRoutine = async () => {
      const sessionId = sessionIdParam ?? null;

      if (!sessionId) {
        setError('결제 세션 정보가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabaseBrowser.auth.getSession();
        const authSession = data?.session;
        const token = authSession?.access_token;

        if (!token) {
          const nextUrl = `${pathname || '/payments/stripe-success'}?session_id=${encodeURIComponent(sessionId)}`;
          router.push(`/app/auth?next=${encodeURIComponent(nextUrl)}`);
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const payload = await res.json();

        if (!res.ok) {
          console.error('verify-session failed', res.status, payload);
          const code = payload?.code ? `[${payload.code}] ` : '';
          setError(`${code}${payload?.error || '결제 정보 확인에 실패했습니다.'}`);
          setLoading(false);
          return;
        }

        setPaymentInfo(payload);

        const target = resolveRedirectTarget(nextParam ?? null);
        router.replace(target);
        setLoading(false);
        return;

        if (payload.isSubscription) {
          setRoutineCreating(true);

          try {
            const session = authSession;
            if (!session) {
              console.warn('사용자 세션이 없어 루틴 생성을 건너뜁니다.');
              setRoutineCreating(false);
              return;
            }

            const testResultRes = await fetch(
              '/api/movement-test/get-latest-by-user',
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            );

            if (testResultRes.ok) {
              const testResultData = await testResultRes.json();

              if (testResultData.success && testResultData.result) {
                const routineRes = await fetch('/api/workout-routine/create', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    testResultId: testResultData.result.id,
                  }),
                });

                if (routineRes.ok) {
                  const routineData = await routineRes.json();
                  setRoutineCreated(true);
                  if (routineData.created) {
                    console.log('✅ 운동 루틴이 자동으로 생성되었습니다.');
                  }
                  // created=false여도 routineId 있으면 정상 (멱등/중복 호출)
                } else {
                  const errorData = await routineRes.json();
                  console.warn('⚠️ 루틴 생성 실패:', errorData.error);
                }
              } else {
                console.log('💡 운동 검사 결과가 없어 루틴 생성을 건너뜁니다.');
              }
            }
          } catch (routineError) {
            console.error('루틴 생성 중 오류:', routineError);
          } finally {
            setRoutineCreating(false);
          }
        }
      } catch (err) {
        console.error('결제 확인 에러:', err);
        setError('결제 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    verifyPaymentAndCreateRoutine();
  }, [sessionIdParam, nextParam]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand)] border-t-transparent" />
          <p className="text-lg font-medium text-[var(--text)]">결제 확인 중...</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            잠시만 기다려주세요.
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <svg
              className="h-8 w-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            결제 확인 실패
          </h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/my-report"
              className="inline-block rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              내 리포트
            </Link>
            <Link
              href="/"
              className="inline-block rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-semibold"
            >
              메인으로 돌아가기
            </Link>
            <button
              onClick={() => router.back()}
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              다시 시도하기
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!paymentInfo) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-10 w-10 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--text)]">결제 완료!</h1>
          <p className="mt-2 text-lg font-semibold text-green-600">
            🎉 {paymentInfo.planName} 플랜이 활성화되었습니다
          </p>
        </div>

        {paymentInfo.isSubscription && (
          <div className="rounded-xl border-2 border-[var(--brand)] bg-[var(--brand-soft)]/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <div>
                <h2 className="text-xl font-bold text-[var(--text)]">
                  구독이 활성화되었습니다
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  매월 자동으로 결제되며 언제든지 취소할 수 있습니다
                </p>
              </div>
            </div>
          </div>
        )}

        {paymentInfo.isSubscription && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
            {routineCreating ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                <p className="text-sm text-[var(--muted)]">
                  운동 루틴 생성 중...
                </p>
              </div>
            ) : routineCreated ? (
              <div className="flex items-center gap-3">
                <span className="text-xl">✅</span>
                <p className="text-sm font-medium text-[var(--text)]">
                  운동 루틴이 자동으로 생성되었습니다!
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">🚀</span>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">
                다음 단계
              </h2>
              <p className="text-sm text-[var(--muted)]">
                지도에서 움직임 리셋을 시작하세요
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href={resolveRedirectTarget(nextParam ?? null)}
              className="block w-full rounded-xl bg-[var(--brand)] py-4 text-center text-lg font-bold text-white hover:opacity-90"
            >
              지도로 이동
            </Link>
            <Link
              href="/my-report"
              className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-center font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              내 리포트
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="mb-2 text-xs text-[var(--muted)]">결제 정보</p>
          <div className="space-y-1 text-sm text-[var(--text)]">
            <div className="flex justify-between">
              <span>플랜</span>
              <span className="font-semibold">{paymentInfo.planName}</span>
            </div>
            <div className="flex justify-between">
              <span>결제금액</span>
              <span className="font-semibold text-[var(--brand)]">
                ₩{paymentInfo.amount.toLocaleString()}
              </span>
            </div>
            {paymentInfo.subscriptionId && (
              <div className="flex justify-between">
                <span>구독 ID</span>
                <span className="font-mono text-xs text-[var(--muted)]">
                  {paymentInfo.subscriptionId.slice(0, 20)}...
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <Link
            href="/my-report"
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            내 리포트
          </Link>
          <span className="text-[var(--border)]">|</span>
          <Link
            href="/my-routine"
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            내 루틴
          </Link>
          <span className="text-[var(--border)]">|</span>
          <Link
            href="/"
            className="text-[var(--muted)] hover:text-[var(--text)]"
          >
            메인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
