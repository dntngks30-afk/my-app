'use client';

/**
 * FLOW-05 — Onboarding Complete (Claim Integration)
 *
 * 온보딩 저장 완료 후 진입점.
 * - mount 시 bridge context의 publicResultId로 claim을 best-effort 시도
 * - claim 성공/실패 여부와 관계없이 UX 차단 없이 계속 진행
 * - claim 완료 후 bridge context 삭제
 * - FLOW-06 session create 준비가 되면 이 페이지에서 추가 연결
 *
 * ─── claim 통합 포인트 ────────────────────────────────────────────────────────
 * - bridge context에서 publicResultId, anonId 읽음
 * - claimPublicResultClient로 best-effort POST
 * - 성공: 'claimed' 또는 'already_owned' → 계속
 * - 실패: warn 로그만, UX 블로킹 없음
 * - clearBridgeContext는 claim 시도 후 호출
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

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [claimDone, setClaimDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function runClaim() {
      const ctx = loadBridgeContext();

      if (ctx?.publicResultId) {
        const result = await claimPublicResultClient(
          ctx.publicResultId,
          ctx.anonId ?? null
        );
        if (!cancelled) {
          if (!result.ok) {
            console.warn(
              '[onboarding-complete] claim best-effort failed:',
              result.reason,
              result.status ?? ''
            );
          }
        }
      }

      // bridge context 정리 (claim 성공/실패 무관)
      clearBridgeContext();
      // FLOW-08: 다음 /app/home 진입 시 readiness를 새로 체크하게 초기화
      clearReadinessCheck();
      if (!cancelled) setClaimDone(true);
    }

    runClaim().catch((err) => {
      console.warn('[onboarding-complete] claim unexpected error:', err);
      clearBridgeContext();
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

        {/* claim 상태는 사용자에게 노출하지 않음 (best-effort) */}
        <span className="sr-only">{claimDone ? 'ready' : 'preparing'}</span>
      </div>
    </div>
  );
}
