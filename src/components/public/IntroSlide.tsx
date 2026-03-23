'use client';

/**
 * 공통 intro 스토리 슬라이드 래퍼
 * 100svh, 별 배경, 진행 표시, prev/next 내비게이션
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md — 토큰만 사용
 */
import Link from 'next/link';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import { MoveReFullscreenScreen } from '@/components/public-brand';
import {
  TOTAL_STEPS,
  getStepIndex,
  getPrevPath,
  getNextPath,
} from '@/lib/public/intro-funnel';

interface IntroSlideProps {
  currentPath: string;
  children: React.ReactNode;
  tapLabel?: string;
  footer?: React.ReactNode;
}

export function IntroSlide({
  currentPath,
  children,
  tapLabel = 'TAP TO CONTINUE',
  footer,
}: IntroSlideProps) {
  const stepIndex = getStepIndex(currentPath);
  const prevPath = getPrevPath(currentPath);
  const nextPath = getNextPath(currentPath);

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center justify-between px-4 pb-2 pt-4">
          <div className="w-10">
            {prevPath ? (
              <Link
                href={prevPath}
                className="inline-flex size-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                aria-label="이전"
              >
                <ChevronLeft className="size-6 text-[var(--mr-public-accent)]" />
              </Link>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 w-6 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-[var(--mr-public-accent)]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
          <div className="w-10" />
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
          {children}
        </main>

        <footer className="relative z-20 flex flex-col items-center gap-2 pb-8">
          {footer ?? (
            nextPath && (
              <Link
                href={nextPath}
                className="flex flex-col items-center gap-1 text-slate-400 transition-colors hover:text-slate-300"
              >
                <span className="text-[11px] font-medium uppercase tracking-widest">
                  {tapLabel}
                </span>
                <ChevronDown className="size-4" />
              </Link>
            )
          )}
        </footer>
      </div>
    </MoveReFullscreenScreen>
  );
}
