/**
 * Stripe 결제 성공 페이지
 * 
 * Stripe Checkout 성공 후 리다이렉트 처리
 * 세션 ID로 결제 정보 확인 및 구독 활성화 확인
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const dynamic = 'force-dynamic';

interface PaymentInfo {
  sessionId: string;
  planName: string;
  planTier: string;
  amount: number;
  subscriptionId?: string;
  isSubscription: boolean;
}

function StripeSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routineCreated, setRoutineCreated] = useState(false);
  const [routineCreating, setRoutineCreating] = useState(false);

  useEffect(() => {
    const verifyPaymentAndCreateRoutine = async () => {
      const sessionId = searchParams.get('session_id');

      if (!sessionId) {
        setError('결제 세션 정보가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        // 서버 API를 통해 세션 정보 확인
        const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`, {
          method: 'GET',
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '결제 정보 확인에 실패했습니다.');
          setLoading(false);
          return;
        }

        setPaymentInfo(data);

        // 구독 플랜인 경우 루틴 생성 시도
        if (data.isSubscription) {
          setRoutineCreating(true);
          
          try {
            // 사용자 세션 확인
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              console.warn('사용자 세션이 없어 루틴 생성을 건너뜁니다.');
              setRoutineCreating(false);
              return;
            }

            // 최신 운동 검사 결과 조회
            const testResultRes = await fetch('/api/movement-test/get-latest-by-user', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (testResultRes.ok) {
              const testResultData = await testResultRes.json();
              
              if (testResultData.success && testResultData.result) {
                // 루틴 생성 API 호출
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
                  setRoutineCreated(true);
                  console.log('✅ 운동 루틴이 자동으로 생성되었습니다.');
                } else {
                  const errorData = await routineRes.json();
                  console.warn('⚠️ 루틴 생성 실패:', errorData.error);
                  // 루틴 생성 실패해도 결제는 성공했으므로 계속 진행
                }
              } else {
                console.log('💡 운동 검사 결과가 없어 루틴 생성을 건너뜁니다.');
              }
            }
          } catch (routineError) {
            console.error('루틴 생성 중 오류:', routineError);
            // 루틴 생성 실패해도 결제는 성공했으므로 계속 진행
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
  }, [searchParams]);

  // 로딩 중
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand)] border-t-transparent" />
          <p className="text-lg font-medium text-[var(--text)]">결제 확인 중...</p>
          <p className="mt-2 text-sm text-[var(--muted)]">잠시만 기다려주세요.</p>
        </div>
      </main>
    );
  }

  // 에러 발생
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
          <h1 className="text-2xl font-bold text-[var(--text)]">결제 확인 실패</h1>
          <p className="text-sm text-[var(--muted)]">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-block rounded-lg bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
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

  // 결제 성공
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
        {/* 성공 아이콘 */}
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

        {/* 구독 정보 */}
        {paymentInfo.isSubscription && (
          <div className="rounded-xl border-2 border-[var(--brand)] bg-[var(--brand-soft)]/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <div>
                <h2 className="text-xl font-bold text-[var(--text)]">구독이 활성화되었습니다</h2>
                <p className="text-sm text-[var(--muted)]">
                  매월 자동으로 결제되며 언제든지 취소할 수 있습니다
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 루틴 생성 상태 */}
        {paymentInfo.isSubscription && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
            {routineCreating ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand)] border-t-transparent" />
                <p className="text-sm text-[var(--muted)]">운동 루틴 생성 중...</p>
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

        {/* 다음 단계 안내 */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-3xl">🚀</span>
            <div>
              <h2 className="text-xl font-bold text-[var(--text)]">다음 단계</h2>
              <p className="text-sm text-[var(--muted)]">
                {paymentInfo.isSubscription
                  ? routineCreated
                    ? '생성된 운동 루틴을 확인하고 시작하세요'
                    : '운동 검사를 완료하고 맞춤 루틴을 받으세요'
                  : '운동 검사를 완료하고 맞춤 루틴을 받으세요'}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {paymentInfo.isSubscription && routineCreated ? (
              <Link
                href="/my-routine"
                className="block w-full rounded-xl bg-[var(--brand)] py-4 text-center text-lg font-bold text-white hover:opacity-90"
              >
                운동 루틴 시작하기
              </Link>
            ) : (
              <Link
                href="/"
                className="block w-full rounded-xl bg-[var(--brand)] py-4 text-center text-lg font-bold text-white hover:opacity-90"
              >
                운동 검사 시작하기
              </Link>
            )}
            <Link
              href="/my-routine"
              className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-center font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
            >
              내 루틴 보기
            </Link>
          </div>
        </div>

        {/* 결제 정보 요약 */}
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

        {/* 하단 링크 */}
        <div className="flex justify-center gap-4 text-sm">
          <Link href="/my-routine" className="text-[var(--muted)] hover:text-[var(--text)]">
            내 루틴
          </Link>
          <span className="text-[var(--border)]">|</span>
          <Link href="/" className="text-[var(--muted)] hover:text-[var(--text)]">
            메인으로
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function StripeSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand)] border-t-transparent" />
            <p className="text-lg font-medium text-[var(--text)]">결제 확인 중...</p>
            <p className="mt-2 text-sm text-[var(--muted)]">잠시만 기다려주세요.</p>
          </div>
        </main>
      }
    >
      <StripeSuccessContent />
    </Suspense>
  );
}
