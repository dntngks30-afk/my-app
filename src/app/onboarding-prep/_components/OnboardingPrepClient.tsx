'use client';

/**
 * FLOW-03 — Post-Pay Bridge Destination (client)
 * 표면: StitchOnboardingPrepScene — 로직·쿼리·handoff 동일
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  loadBridgeContext,
  saveBridgeContext,
} from '@/lib/public-results/public-result-bridge';
import type { BridgeResultStage } from '@/lib/public-results/public-result-bridge';
import StitchOnboardingPrepScene from '@/components/stitch/postpay/StitchOnboardingPrepScene';

export default function OnboardingPrepClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasContext, setHasContext] = useState<boolean | null>(null);

  useEffect(() => {
    const id = searchParams.get('publicResultId');
    const stage = searchParams.get('stage');
    const anonId = searchParams.get('anonId');
    const fromQuery = !!(id && (stage === 'baseline' || stage === 'refined'));

    // PR-SESSION-PREPARING-BRIDGE-PERSIST-02:
    // URL query params are the current truth when present.
    // Persist them immediately so that /onboarding (which strips the URL)
    // and /session-preparing (which reads from bridge) can still find them.
    if (fromQuery) {
      saveBridgeContext({
        publicResultId: id!,
        resultStage: stage as BridgeResultStage,
        anonId: anonId ?? null,
      });
    }

    setHasContext(fromQuery || !!loadBridgeContext());
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
