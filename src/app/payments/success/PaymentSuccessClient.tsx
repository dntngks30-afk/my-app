'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionSafe } from '@/lib/supabase';

interface PaymentSuccessClientProps {
  paymentKeyParam?: string | null;
  orderIdParam?: string | null;
  amountParam?: string | null;
}

export default function PaymentSuccessClient({
  paymentKeyParam,
  orderIdParam,
  amountParam,
}: PaymentSuccessClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = paymentKeyParam ?? null;
      const orderId = orderIdParam ?? null;
      const amount = amountParam ?? null;

      const requestId = localStorage.getItem('pending_request_id');

      if (!paymentKey || !orderId || !amount) {
        setError('결제 정보가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      try {
        const { session } = await getSessionSafe();
        if (!session) {
          setError('로그인이 필요합니다.');
          setLoading(false);
          return;
        }

        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
            requestId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '결제 승인에 실패했습니다.');
          setLoading(false);
          return;
        }

        setSuccess(true);
        localStorage.removeItem('pending_request_id');
      } catch (err) {
        console.error('결제 승인 에러:', err);
        setError('결제 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [paymentKeyParam, orderIdParam, amountParam]);

  const orderId = orderIdParam ?? '';
  const amount = Number(amountParam || 0);
  const isBasicPlan =
    orderId.includes('basic') || orderId.includes('BASIC');
  const isStandardPlan =
    orderId.includes('standard') || orderId.includes('STANDARD');
  const isPremiumPlan =
    orderId.includes('premium') ||
    orderId.includes('PREMIUM') ||
    orderId.includes('vip') ||
    orderId.includes('VIP');

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#f97316] border-t-transparent" />
          <p className="text-lg font-medium text-slate-100">결제 처리 중...</p>
          <p className="mt-2 text-sm text-slate-400">잠시만 기다려주세요.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center">
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
          <h1 className="text-2xl font-bold text-slate-100">결제 실패</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950"
            >
              메인으로 돌아가기
            </Link>
            <button
              onClick={() => router.back()}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              다시 시도하기
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8">
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
          <h1 className="text-3xl font-bold text-slate-100">결제 완료!</h1>
          <p className="mt-2 text-lg font-semibold text-green-400">
            🎉 플랜이 활성화되었습니다
          </p>
        </div>

        {isBasicPlan && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">결제가 완료되었어요</h2>
                <p className="text-sm text-slate-400">
                  MOVE RE 공개 퍼널에서 바로 실행 흐름을 이어가려면 아래를 눌러 주세요.
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]"
            >
              MOVE RE 시작하기
            </Link>
          </div>
        )}

        {(isStandardPlan || isPremiumPlan) && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">다음 단계</h2>
                <p className="text-sm text-slate-400">
                  리셋맵에서 오늘의 실행을 이어가세요.
                </p>
              </div>
            </div>
            {isPremiumPlan && (
              <div className="mb-4 rounded-lg border border-purple-500/50 bg-purple-500/10 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">👑</span>
                  <span className="font-bold text-purple-400">VIP 전용</span>
                </div>
                <p className="text-sm text-slate-300">
                  1:1 Zoom 상담 일정을 예약하세요
                </p>
                <button type="button" className="mt-3 w-full rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                  Zoom 상담 예약하기
                </button>
              </div>
            )}
            <Link
              href="/app/home"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white shadow-[0_0_30px_rgba(249,115,22,0.5)] transition hover:shadow-[0_0_40px_rgba(249,115,22,0.6)]"
            >
              내 리셋맵으로 이동하기
            </Link>
          </div>
        )}

        {!isBasicPlan && !isStandardPlan && !isPremiumPlan && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">다음 단계</h2>
                <p className="text-sm text-slate-400">MOVE RE를 시작해 주세요</p>
              </div>
            </div>
            <Link
              href="/"
              className="block w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-center text-lg font-bold text-white"
            >
              MOVE RE 시작하기
            </Link>
          </div>
        )}

        <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-4">
          <p className="mb-2 text-xs text-slate-500">결제 정보</p>
          <div className="space-y-1 text-sm text-slate-300">
            <div className="flex justify-between">
              <span>주문번호</span>
              <span className="font-mono text-xs text-slate-400">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span>결제금액</span>
              <span className="font-semibold text-[#f97316]">
                ₩{amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <Link href="/app/home" className="text-slate-400 hover:text-slate-200">
            내 리셋맵
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/" className="text-slate-400 hover:text-slate-200">
            메인으로
          </Link>
        </div>
      </div>
    </main>
  );
}
