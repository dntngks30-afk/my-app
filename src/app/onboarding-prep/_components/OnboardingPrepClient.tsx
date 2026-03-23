'use client';

/**
 * FLOW-03 — Post-Pay Bridge Destination (client)
 * 표면: StitchOnboardingPrepScene — 로직·쿼리·handoff 동일
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadBridgeContext } from '@/lib/public-results/public-result-bridge';
import StitchOnboardingPrepScene from '@/components/stitch/postpay/StitchOnboardingPrepScene';

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

  return (
    <StitchOnboardingPrepScene
      loading={hasContext === null}
      hasContext={hasContext === true}
      onContinue={handleContinue}
    />
  );
}
