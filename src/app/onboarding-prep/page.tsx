/**
 * FLOW-03 — Post-Pay Bridge Destination
 */

import { Suspense } from 'react';
import OnboardingPrepClient from './_components/OnboardingPrepClient';
import { PostpayChapterShell } from '@/components/stitch/postpay/shared';

function OnboardingPrepFallback() {
  return (
    <PostpayChapterShell>
      <div className="flex min-h-[100svh] flex-1 items-center justify-center px-6">
        <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          준비 중...
        </p>
      </div>
    </PostpayChapterShell>
  );
}

export default function OnboardingPrepPage() {
  return (
    <Suspense fallback={<OnboardingPrepFallback />}>
      <OnboardingPrepClient />
    </Suspense>
  );
}
