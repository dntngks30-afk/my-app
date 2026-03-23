'use client';

/**
 * FLOW-05 — Onboarding Complete (Claim Integration)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearBridgeContext,
  loadBridgeContext,
} from '@/lib/public-results/public-result-bridge';
import { claimPublicResultClient } from '@/lib/public-results/useClaimPublicResult';
import { clearReadinessCheck } from '@/app/app/_components/ReadinessEntryGate';
import StitchOnboardingCompleteScene from '@/components/stitch/postpay/StitchOnboardingCompleteScene';

const PAGE_LOG = '[onboarding-complete]';

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [claimDone, setClaimDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function runClaim() {
      const ctx = loadBridgeContext();

      if (!ctx?.publicResultId) {
        console.info(PAGE_LOG, {
          phase: 'claim_skipped',
          reason: 'no_public_result_id_in_bridge',
        });
      } else {
        const result = await claimPublicResultClient(
          ctx.publicResultId,
          ctx.anonId ?? null
        );
        if (!cancelled) {
          if (result.ok) {
            clearBridgeContext();
            console.info(PAGE_LOG, {
              phase: 'bridge_cleared_after_claim',
              outcome: result.outcome,
              id: result.id,
            });
          } else {
            console.warn(PAGE_LOG, {
              phase: 'bridge_retained_after_claim_failure',
              reason: result.reason,
              status: result.status,
              attempts: result.attempts,
            });
          }
        }
      }

      if (cancelled) return;
      clearReadinessCheck();
      setClaimDone(true);
    }

    runClaim().catch((err) => {
      console.warn(PAGE_LOG, { phase: 'claim_unexpected_error', err });
      clearReadinessCheck();
      if (!cancelled) setClaimDone(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <StitchOnboardingCompleteScene
      claimDone={claimDone}
      onGoApp={() => router.push('/app/home')}
    />
  );
}
