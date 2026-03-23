/**
 * FLOW-03 — Post-Pay Bridge Destination
 *
 * 결제 성공 후 public-first 흐름의 다음 단계 진입점.
 * useSearchParams는 클라이언트 하위 컴포넌트에서만 사용하고 Suspense로 감싸
 * Next.js 정적 prerender 오류를 방지한다.
 *
 * @see src/app/onboarding-prep/_components/OnboardingPrepClient.tsx
 */

import { Suspense } from 'react';
import OnboardingPrepClient from './_components/OnboardingPrepClient';

function OnboardingPrepFallback() {
  return (
    <div className="mr-public-funnel-shell flex min-h-[100svh] items-center justify-center">
      <p className="text-slate-400 text-sm">준비 중...</p>
    </div>
  );
}

export default function OnboardingPrepPage() {
  return (
    <Suspense fallback={<OnboardingPrepFallback />}>
      <OnboardingPrepClient />
    </Suspense>
  );
}
