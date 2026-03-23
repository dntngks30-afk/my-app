'use client';

/**
 * FLOW-05 — Onboarding Complete (Claim Integration)
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearBridgeContext,
  loadBridgeContext,
} from '@/lib/public-results/public-result-bridge';
import { claimPublicResultClient } from '@/lib/public-results/useClaimPublicResult';
import { clearReadinessCheck } from '@/app/app/_components/ReadinessEntryGate';
import {
  MoveReFullscreenScreen,
  MoveReHeroBlock,
  MoveRePrimaryCTA,
  MoveReSecondaryCTA,
  MoveReSurfaceCard,
} from '@/components/public-brand';

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

    return () => { cancelled = true; };
  }, []);

  return (
    <MoveReFullscreenScreen>
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-8">
          <MoveReSurfaceCard className="flex flex-col items-center gap-4 px-6 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
              <span className="text-4xl">✓</span>
            </div>
            <MoveReHeroBlock
              className="text-center"
              showAccentDivider={false}
              title={
                <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  루틴에 연결됐어요
                </h1>
              }
              subtitle={
                <p className="text-sm leading-relaxed text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  홈에서 세션을 만들면 바로 실행 화면으로 이어집니다.
                </p>
              }
            />
          </MoveReSurfaceCard>

          <div className="space-y-3">
            <MoveRePrimaryCTA
              disabled={!claimDone}
              onClick={() => router.push('/app/home')}
            >
              앱으로 이동하기
            </MoveRePrimaryCTA>
            <MoveReSecondaryCTA href="/my-routine">내 루틴 보기</MoveReSecondaryCTA>
          </div>

          <span className="sr-only">{claimDone ? 'ready' : 'preparing'}</span>
        </div>
      </div>
    </MoveReFullscreenScreen>
  );
}
