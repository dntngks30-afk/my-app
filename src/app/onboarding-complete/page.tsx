'use client';

/**
 * FLOW-04 — Onboarding Complete (Placeholder)
 *
 * 온보딩 저장 완료 후 진입점.
 * FLOW-05 claim, FLOW-06 session create 준비가 되면 이 페이지에서 연결.
 *
 * 현재: /app/home으로 이동하는 bridge.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clearBridgeContext } from '@/lib/public-results/public-result-bridge';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

export default function OnboardingCompletePage() {
  const router = useRouter();

  useEffect(() => {
    clearBridgeContext();
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
          준비가 완료되었습니다
        </h1>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          맞춤 운동 루틴을 시작하세요.
        </p>

        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => router.push('/app/home')}
            className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
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
      </div>
    </div>
  );
}
