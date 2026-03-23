'use client';

/**
 * FLOW-03 bridge — stitch zip: check + vertical rail + copper primary + ghost secondary
 * 카피는 기존 OnboardingPrepClient truth 유지
 */
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { PostpayChapterShell, PostpayBrandHeader, PostpayVerticalRail } from './shared';

export type StitchOnboardingPrepSceneProps = {
  loading: boolean;
  hasContext: boolean;
  onContinue: () => void;
};

export default function StitchOnboardingPrepScene({ loading, hasContext, onContinue }: StitchOnboardingPrepSceneProps) {
  if (loading) {
    return (
      <PostpayChapterShell>
        <div className="flex min-h-[100svh] flex-1 items-center justify-center px-6">
          <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            준비 중...
          </p>
        </div>
      </PostpayChapterShell>
    );
  }

  const body = hasContext
    ? '설문·결과는 이미 반영됐어요. 다음 화면에서는 주당 횟수와 안전에 필요한 것만 고르고 바로 루틴으로 이어져요.'
    : '다음에서 주당 횟수와 실행에 필요한 최소 정보만 확인합니다.';

  return (
    <PostpayChapterShell>
      <div className="flex min-h-[100svh] flex-col">
        <PostpayBrandHeader />

        <main className="relative flex min-h-0 flex-1 flex-col items-center justify-between px-8 pb-10 pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,183,125,0.06)_0%,transparent_65%)]"
          />

          <div className="relative z-10 mt-4 flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/15 bg-[#2e3447]/30 shadow-[0_0_24px_rgba(52,211,153,0.18)]">
              <CheckCircle2 className="size-9 text-emerald-400" strokeWidth={1.5} aria-hidden />
            </div>
            <PostpayVerticalRail fraction={0.5} />
          </div>

          <div className="relative z-10 w-full max-w-md flex-1 space-y-8 text-center">
            <h1 className="text-3xl font-light leading-snug tracking-tight text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
              이제 짧게만 확인할게요
            </h1>
            <p
              className="px-2 text-base font-light leading-relaxed text-[#c6c6cd]/90 md:text-lg"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {body}
            </p>
          </div>

          <div className="relative z-10 mt-auto flex w-full max-w-sm flex-col gap-4">
            <button
              type="button"
              onClick={onContinue}
              className="flex h-14 w-full items-center justify-center rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-base font-semibold tracking-wide text-[#4d2600] shadow-[0_20px_50px_rgba(2,6,23,0.25)] transition-transform active:scale-[0.98]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              실행 설정으로
            </button>
            <Link
              href="/app/home"
              className="group flex h-12 w-full items-center justify-center transition-colors"
            >
              <span
                className="relative text-lg italic text-[#c6c6cd]/75 transition-colors after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-[#ffb77d]/30 after:content-[''] [font-family:var(--font-display)] group-hover:text-[#dce1fb]"
              >
                나중에 하기
              </span>
            </Link>
          </div>
        </main>
      </div>
    </PostpayChapterShell>
  );
}
