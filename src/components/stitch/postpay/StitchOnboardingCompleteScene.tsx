'use client';

/**
 * FLOW-05 — 온보딩 완료 / 앱 진입 (stitch completion chapter)
 */
import { CheckCircle2 } from 'lucide-react';
import { PwaInstallGuideCard } from '@/components/pwa/PwaInstallGuideCard';
import { PostpayChapterShell, PostpayBrandHeader } from './shared';

export type StitchOnboardingCompleteSceneProps = {
  claimDone: boolean;
  onGoApp: () => void;
};

export default function StitchOnboardingCompleteScene({ claimDone, onGoApp }: StitchOnboardingCompleteSceneProps) {
  return (
    <PostpayChapterShell>
      <div className="flex min-h-[100svh] flex-col">
        <PostpayBrandHeader />

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
          <div className="w-full max-w-md space-y-5">
            <div className="flex flex-col items-center gap-5 rounded-xl bg-[rgba(46,52,71,0.4)] px-6 py-8 text-center backdrop-blur-xl md:px-8 md:py-10">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_32px_rgba(52,211,153,0.15)]">
                <CheckCircle2 className="size-12 text-emerald-400" strokeWidth={1.25} aria-hidden />
              </div>
              <div className="space-y-3">
                <h1
                  className="text-2xl font-light leading-snug text-[#dce1fb] md:text-3xl [font-family:var(--font-display)]"
                >
                  리셋맵이 준비됐어요
                </h1>
                <p
                  className="text-sm font-light leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  MOVE RE는 자주 들어와 몸 상태를 이어가는 실행 앱입니다.
                </p>
              </div>
            </div>

            <PwaInstallGuideCard />

            <div className="flex flex-col gap-3 pt-1">
              <button
                type="button"
                disabled={!claimDone}
                onClick={onGoApp}
                className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-base font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.12)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                앱으로 이동하기
              </button>
            </div>

            <span className="sr-only">{claimDone ? 'ready' : 'preparing'}</span>
          </div>
        </div>
      </div>
    </PostpayChapterShell>
  );
}
