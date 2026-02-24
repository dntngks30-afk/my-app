'use client';

/**
 * 심층분석 결제 모달
 * - plan_status=active면 "앱으로 이동" CTA만 표시 (결제 호출 없음)
 * - pay=1일 때 표시
 * - 비로그인: /app/auth?next=<current with pay=1>로 리다이렉트
 * - 로그인: productId/next로 Stripe checkout 생성 후 이동
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const PRIMARY = '#2563EB';

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 현재 URL (pay=1 포함) - auth next 및 cancel용 */
  returnUrl: string;
}

export default function PayModal({ isOpen, onClose, returnUrl }: PayModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlanActive, setIsPlanActive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) {
        if (!cancelled) setIsPlanActive(false);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('plan_status')
        .eq('id', session.user.id)
        .single();
      if (!cancelled) setIsPlanActive(data?.plan_status === 'active');
    }
    setIsPlanActive(null);
    check();
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleGoToApp = () => {
    router.push('/app');
  };

  const handleCheckout = async () => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/app/auth?next=${encodeURIComponent(returnUrl)}`);
        return;
      }

      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productId: 'move-re-7d',
          next: '/app',
        }),
      });

      const json = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setErrorMessage(json?.error || json?.message || '결제 세션 생성에 실패했습니다.');
        setIsLoading(false);
        return;
      }

      if (json?.url) {
        window.location.href = json.url;
      } else {
        setErrorMessage('결제 URL 생성에 실패했습니다.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage('결제 시작 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1E293B] p-6 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          7일 심층 분석 프로그램
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>• 움직임 정밀 체크 → 7일 맞춤 루틴 → 변화 리포트</li>
          <li>• 하루 5~10분, 전문 코치 코멘트 포함</li>
          <li>• 결제 즉시 루틴 시작</li>
        </ul>
        <p className="mt-4 text-2xl font-bold" style={{ color: PRIMARY }}>
          ₩19,900 / 7일
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          결제 즉시 루틴이 시작됩니다.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {isPlanActive ? (
            <button
              type="button"
              onClick={handleGoToApp}
              className="w-full rounded-xl py-4 font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              이미 활성화됨 / 앱으로 이동
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isLoading || isPlanActive === null}
              className="w-full rounded-xl py-4 font-bold text-white transition disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: PRIMARY }}
            >
              {isLoading ? '처리 중...' : isPlanActive === null ? '확인 중...' : '결제하고 시작하기'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 py-3 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
          >
            닫기
          </button>
        </div>
        {errorMessage && (
          <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
