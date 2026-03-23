'use client';

/**
 * FLOW-05 — 온보딩 완료 / 앱 진입 (stitch completion chapter)
 */
import { TextMaskReveal } from '@/components/public/text-mask';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
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

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-md space-y-10">
            <div className="flex flex-col items-center gap-6 rounded-xl bg-[rgba(46,52,71,0.4)] px-8 py-10 text-center backdrop-blur-xl">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_32px_rgba(52,211,153,0.15)]">
                <CheckCircle2 className="size-12 text-emerald-400" strokeWidth={1.25} aria-hidden />
              </div>
              <div className="space-y-3">
                <h1
                  className="text-2xl font-light leading-snug text-[#dce1fb] md:text-3xl [font-family:var(--font-display)]"
                >
                  <TextMaskReveal delaySec={0.14} durationSec={0.72}>
                    루틴에 연결됐어요
                  </TextMaskReveal>
                </h1>
                <p
                  className="text-sm font-light leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  홈에서 세션을 만들면 바로 실행 화면으로 이어집니다.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={!claimDone}
                onClick={onGoApp}
                className="flex min-h-[52px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-base font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.12)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                앱으로 이동하기
              </button>
              <Link
                href="/my-routine"
                className="flex min-h-[48px] w-full items-center justify-center rounded-lg text-center text-sm font-medium text-[#c6c6cd]/80 transition-colors hover:text-[#ffb77d]"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                내 루틴 보기
              </Link>
            </div>

            <span className="sr-only">{claimDone ? 'ready' : 'preparing'}</span>
          </div>
        </div>
      </div>
    </PostpayChapterShell>
  );
}
