'use client';

/**
 * 루트 `/` 랜딩 — readiness가 /app/home 복귀를 허용할 때만 노출되는 리셋맵 복귀 CTA.
 * 메인 funnel CTA와 분리되어 하단에만 표시된다.
 * PR-WEB-PERF-02: fetch는 랜딩 page owner만 수행; 여기서는 props로만 판단.
 */

import Link from 'next/link';

type LandingReturnHomeCtaProps = {
  canReturnHome: boolean;
};

export default function LandingReturnHomeCta({ canReturnHome }: LandingReturnHomeCtaProps) {
  if (!canReturnHome) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[50] flex justify-center px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-reduce:animate-none motion-reduce:!opacity-100"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-[min(100%,24rem)] -translate-x-1/2 rounded-[100%] bg-[#ffb77d]/10 blur-2xl motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:opacity-90"
      />
      <Link
        href="/app/home"
        className="pointer-events-auto relative mx-auto flex w-full max-w-[20rem] items-center justify-center gap-1 rounded-xl border border-[#ffb77d]/40 bg-[#0c1324]/90 px-4 py-3 text-center text-[13px] font-semibold text-[#fce9df] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md transition-opacity hover:border-[#ffb77d]/55 hover:bg-[#121a2e]/95 hover:text-[#fff8f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb77d]/60 md:text-sm motion-reduce:transition-none"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        <span>내 리셋맵으로 돌아가기</span>
        <span aria-hidden className="text-[#ffb77d] opacity-90">
          →
        </span>
      </Link>
    </div>
  );
}
