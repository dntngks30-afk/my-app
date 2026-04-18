'use client';

/**
 * FLOW-05 — Onboarding Complete
 *
 * Claim and session creation are now owned by session-preparing (orchestrator).
 * This page is the success surface only: readiness cache clear + app entry.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearReadinessCheck } from '@/app/app/_components/ReadinessEntryGate';
import StitchOnboardingCompleteScene from '@/components/stitch/postpay/StitchOnboardingCompleteScene';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [claimDone, setClaimDone] = useState(false);

  useEffect(() => {
    clearReadinessCheck();
    setClaimDone(true);
  }, []);

  return (
    <StitchOnboardingCompleteScene
      claimDone={claimDone}
      onGoApp={() => router.push('/app/home')}
    />
  );
}
