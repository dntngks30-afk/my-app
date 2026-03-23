'use client';

/**
 * FLOW-03 — Post-Pay Bridge Destination (client)
 * @see src/app/onboarding-prep/page.tsx
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadBridgeContext } from '@/lib/public-results/public-result-bridge';
import {
  MoveReFullscreenScreen,
  MoveRePrimaryCTA,
  MoveReSecondaryCTA,
} from '@/components/public-brand';

export default function OnboardingPrepClient() {
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
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">준비 중...</p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen>
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            이제 짧게만 확인할게요
          </h1>
          <p className="text-sm leading-relaxed text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {hasContext
              ? '설문·결과는 이미 반영됐어요. 다음 화면에서는 주당 횟수와 안전에 필요한 것만 고르고 바로 루틴으로 이어져요.'
              : '다음에서 주당 횟수와 실행에 필요한 최소 정보만 확인합니다.'}
          </p>

          <div className="space-y-3 pt-4">
            <MoveRePrimaryCTA onClick={handleContinue}>
              실행 설정으로
            </MoveRePrimaryCTA>
            <MoveReSecondaryCTA href="/app/home">나중에 하기</MoveReSecondaryCTA>
          </div>
        </div>
      </div>
    </MoveReFullscreenScreen>
  );
}
