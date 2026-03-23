'use client';

/**
 * FLOW-05 — Onboarding Complete (Claim Integration)
 *
 * 온보딩 저장 완료 후 진입점.
 * - mount 시 bridge context의 publicResultId로 claim 시도 (PR-CLAIM-FLOW-HARDENING-01: 일시 오류 재시도)
 * - claim이 confirmed 성공(claimed | already_owned)일 때만 bridge 삭제 — 실패 시 복구용 bridge 유지
 * - UX는 차단하지 않음 (앱으로 이동 가능)
 *
 * ─── claim 통합 포인트 ────────────────────────────────────────────────────────
 * - bridge context에서 publicResultId, anonId 읽음
 * - claimPublicResultClient (bounded retry 내장)
 * - 성공 시에만 clearBridgeContext
 * - FLOW-08: 진입 완료 시 clearReadinessCheck로 다음 /app/home에서 readiness 재조회
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  clearBridgeContext,
  loadBridgeContext,
} from '@/lib/public-results/public-result-bridge';
import { claimPublicResultClient } from '@/lib/public-results/useClaimPublicResult';
import { clearReadinessCheck } from '@/app/app/_components/ReadinessEntryGate';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
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
      // bridge 유지 여부와 무관하게 readiness 캐시는 초기화 (다음 앱 진입 시 서버 기준 재조회)
      clearReadinessCheck();
      setClaimDone(true);
    }

    runClaim().catch((err) => {
      console.warn(PAGE_LOG, { phase: 'claim_unexpected_error', err });
      // 복구 가능성을 위해 bridge는 지우지 않음 (PR-CLAIM-FLOW-HARDENING-01)
      clearReadinessCheck();
      if (!cancelled) setClaimDone(true);
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: BG }}
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          루틴에 연결됐어요
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          홈에서 세션을 만들면 바로 실행 화면으로 이어집니다.
        </p>

        <div className="space-y-3 pt-4">
          <button
            type="button"
            disabled={!claimDone}
            onClick={() => router.push('/app/home')}
            className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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

        <span className="sr-only">{claimDone ? 'ready' : 'preparing'}</span>
      </div>
    </div>
  );
}
