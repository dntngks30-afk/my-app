'use client';

/**
 * 결제 진입 UI (Client)
 * product, next는 서버에서 전달
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const PRODUCT_TO_TIER: Record<string, string> = {
  'move-re-7d': 'standard',
};

interface PaymentsClientProps {
  product: string;
  next: string;
}

export default function PaymentsClient({ product, next }: PaymentsClientProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('로그인이 필요합니다.');
        setLoading(false);
        return;
      }

      const tier = PRODUCT_TO_TIER[product] || 'standard';
      const planRes = await fetch(`/api/plans/get-by-tier?tier=${tier}`);
      const planData = await planRes.json();

      if (!planRes.ok || !planData?.plan?.id) {
        setError(planData?.error || '플랜을 불러올 수 없습니다.');
        setLoading(false);
        return;
      }

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const successUrl = `${baseUrl}/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/payments`;

      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          planId: planData.plan.id,
          successUrl,
          cancelUrl,
        }),
      });

      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        setError(checkoutData?.error || '결제 세션 생성에 실패했습니다.');
        setLoading(false);
        return;
      }

      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
      } else {
        setError('결제 URL을 받지 못했습니다.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('결제 시작 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[var(--text)]">
          7일 심층 분석 프로그램
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          결제 즉시 루틴이 시작됩니다.
        </p>
        <p className="mt-4 text-2xl font-semibold text-[var(--text)]">
          ₩19,900 / 7일
        </p>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[var(--brand)] px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '처리 중...' : '결제하고 시작하기'}
        </button>
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          로그인 후 결제가 진행됩니다.
        </p>
        {error && (
          <p className="mt-3 text-center text-sm text-[var(--warn-text)]">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
