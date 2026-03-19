'use client';

/**
 * FLOW-03 — Post-Pay Bridge Destination
 *
 * 결제 성공 후 public-first 흐름의 다음 단계 진입점.
 * deep-test 재진입이 아닌 onboarding/claim 준비 단계로 안내.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 페이지는 bridge entry만 담당 (FLOW-03)
 * - onboarding 폼/비즈니스 로직은 FLOW-04
 * - claim mutation은 FLOW-05
 *
 * ─── Context 소스 ────────────────────────────────────────────────────────────
 * 1. query: ?publicResultId=xxx&stage=baseline|refined
 * 2. localStorage: moveReBridgeContext:v1 (login/pay redirect 후)
 *
 * ─── Fallback ─────────────────────────────────────────────────────────────────
 * context 없어도 안전하게 /app/home으로 이동 가능.
 *
 * @see src/lib/public-results/public-result-bridge.ts
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loadBridgeContext, clearBridgeContext } from '@/lib/public-results/public-result-bridge';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

export default function OnboardingPrepPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasContext, setHasContext] = useState<boolean | null>(null);

  useEffect(() => {
    const id = searchParams.get('publicResultId');
    const stage = searchParams.get('stage');
    const fromQuery = !!(id && (stage === 'baseline' || stage === 'refined'));
    const fromStorage = !!loadBridgeContext();
    setHasContext(fromQuery || fromStorage);
  }, [searchParams]);

  const handleContinue = () => {
    clearBridgeContext();
    router.push('/app/home');
  };

  if (hasContext === null) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <p className="text-slate-400 text-sm">준비 중...</p>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[100svh] flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: BG }}
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          결제가 완료되었습니다
        </h1>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {hasContext
            ? '분석 결과가 저장되었습니다. 이제 맞춤 운동 루틴을 시작하세요.'
            : '맞춤 운동 루틴을 시작하세요.'}
        </p>

        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
            style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
          >
            앱으로 이동하기
          </button>
          <Link
            href="/my-routine"
            className="block w-full min-h-[48px] rounded-2xl font-medium text-slate-300 border border-white/20 hover:bg-white/5 transition-colors flex items-center justify-center"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            내 루틴 보기
          </Link>
        </div>

      </div>
    </div>
  );
}
