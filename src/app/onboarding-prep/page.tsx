'use client';

/**
 * FLOW-03 — Post-Pay Bridge Destination
 * PR-ONBOARDING-MIN-06 — 짧은 실행 준비 단계로 이어진다는 메시지 정리
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
import { loadBridgeContext } from '@/lib/public-results/public-result-bridge';

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
    router.push('/onboarding');
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
          이제 짧게만 확인할게요
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {hasContext
            ? '설문·결과는 이미 반영됐어요. 다음 화면에서는 주당 횟수와 안전에 필요한 것만 고르고 바로 루틴으로 이어져요.'
            : '다음에서 주당 횟수와 실행에 필요한 최소 정보만 확인합니다.'}
        </p>

        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={handleContinue}
            className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
            style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
          >
            실행 설정으로
          </button>
          <Link
            href="/app/home"
            className="block w-full min-h-[48px] rounded-2xl font-medium text-slate-300 border border-white/20 hover:bg-white/5 transition-colors flex items-center justify-center"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            나중에 하기
          </Link>
        </div>

      </div>
    </div>
  );
}
