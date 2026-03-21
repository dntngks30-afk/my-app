'use client';

/**
 * PR-GENERATION-STAGE-07 — 온보딩 직후 짧은 실행 준비(세션 구성) 스테이징
 *
 * - 실제 세션 생성 API를 새로 호출하지 않음(표현·전환만).
 * - 약 2초 내 3문장 순차 표시 후 /onboarding-complete 로 이어져 기존 claim 흐름 유지.
 * - 오류 숨김 없음: 본 페이지는 네트워크 작업 없음.
 *
 * @see src/app/onboarding-complete/page.tsx (FLOW-05 claim)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
const BG = '#0d161f';
const ACCENT = '#ff7b00';

/** 총 체감 ~1.8~2.2초 — 단계 전환 간격(ms) */
const STEP_MS = 650;
const FINAL_HOLD_MS = 550;

const STAGE_LINES = [
  '지금 정리된 상태를 반영해, 운동 시작점을 맞추고 있어요.',
  '조심해야 할 움직임과 난이도에 맞춰 세션을 잡고 있어요.',
  '리셋맵에 이어질 전체 세션 구성을 준비하고 있어요.',
] as const;

export default function SessionPreparingPage() {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);

  const goNext = useCallback(() => {
    router.replace('/onboarding-complete');
  }, [router]);

  useEffect(() => {
    const t1 = window.setTimeout(() => setStageIndex(1), STEP_MS);
    const t2 = window.setTimeout(() => setStageIndex(2), STEP_MS * 2);
    const t3 = window.setTimeout(() => {
      router.replace('/onboarding-complete');
    }, STEP_MS * 2 + FINAL_HOLD_MS);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [router]);

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: BG }}
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <p
            className="text-[11px] uppercase tracking-wide text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            실행 직전
          </p>
          <h1 className="text-lg font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            세션을 맞추는 중이에요
          </h1>
        </div>

        <div
          className="min-h-[100px] flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6"
          aria-live="polite"
        >
          <p
            key={stageIndex}
            className="text-sm text-slate-200 leading-relaxed animate-in fade-in duration-300"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {STAGE_LINES[stageIndex]}
          </p>
          <div className="flex gap-1.5 mt-5 justify-center" aria-hidden>
            {STAGE_LINES.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= stageIndex ? ACCENT : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          분석 결과를 다시 묻는 단계가 아니라, 방금 맞춘 실행 설정을 세션에 반영하는 짧은 준비예요.
        </p>

        <button
          type="button"
          onClick={goNext}
          className="text-sm text-slate-400 underline underline-offset-2 hover:text-slate-200 transition-colors"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          바로 다음으로
        </button>
      </div>
    </div>
  );
}
