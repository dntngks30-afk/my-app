'use client';

/**
 * PR-GENERATION-STAGE-07 — 온보딩 직후 짧은 실행 준비(세션 구성) 스테이징
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md
 *
 * @see src/app/onboarding-complete/page.tsx (FLOW-05 claim)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoveReFullscreenScreen,
  MoveReProgressRail,
  MoveReSecondaryCTA,
  MoveReStepNavRow,
  MoveReSurfaceCard,
} from '@/components/public-brand';

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
    <MoveReFullscreenScreen>
      <MoveReProgressRail current={stageIndex + 1} total={STAGE_LINES.length} />
      <div className="flex min-h-0 flex-1 flex-col px-6">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <p
              className="text-[11px] font-medium uppercase tracking-widest text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              실행 직전
            </p>
            <h1 className="text-lg font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              세션을 맞추는 중이에요
            </h1>
          </div>

          <MoveReSurfaceCard className="flex min-h-[100px] flex-col items-center justify-center px-4 py-6">
            <p
              key={stageIndex}
              className="animate-in fade-in text-sm leading-relaxed text-slate-200 duration-300"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
              aria-live="polite"
            >
              {STAGE_LINES[stageIndex]}
            </p>
            <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
              {STAGE_LINES.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      i <= stageIndex ? 'var(--mr-public-accent)' : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
            </div>
          </MoveReSurfaceCard>

          <p className="text-[11px] leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            분석 결과를 다시 묻는 단계가 아니라, 방금 맞춘 실행 설정을 세션에 반영하는 짧은 준비예요.
          </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md shrink-0 border-t border-white/[0.06] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-5">
          <MoveReStepNavRow
            right={
              <MoveReSecondaryCTA type="button" onClick={goNext} className="min-h-[48px] w-full">
                바로 다음으로
              </MoveReSecondaryCTA>
            }
          />
        </div>
      </div>
    </MoveReFullscreenScreen>
  );
}
