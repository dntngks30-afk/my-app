'use client';

/**
 * 공통 intro 스토리 슬라이드 래퍼
 * 100svh, 별 배경, 진행 표시, prev/next 내비게이션
 */
import Link from 'next/link';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import {
  TOTAL_STEPS,
  getStepIndex,
  getPrevPath,
  getNextPath,
} from '@/lib/public/intro-funnel';

const BG = '#0d161f';
const ACCENT = '#ff7b00';

interface IntroSlideProps {
  /** 현재 경로 (예: /intro/welcome) */
  currentPath: string;
  children: React.ReactNode;
  /** 하단 CTA 문구 (기본: TAP TO CONTINUE) */
  tapLabel?: string;
  /** next 대신 커스텀 하단 영역 */
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
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      {/* 상단: 뒤로가기 + 진행 표시 */}
      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-10">
          {prevPath ? (
            <Link
              href={prevPath}
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </Link>
          ) : (
            <span />
          )}
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="h-0.5 w-6 rounded-full transition-colors"
              style={{
                backgroundColor: i <= stepIndex ? ACCENT : 'rgba(255,255,255,0.2)',
              }}
            />
          ))}
        </div>
        <div className="w-10" />
      </header>

      {/* 메인 콘텐츠 */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {children}
      </main>

      {/* 하단: tap to continue 또는 커스텀 footer */}
      <footer className="relative z-20 pb-8 flex flex-col items-center gap-2">
        {footer ?? (
          nextPath && (
            <Link
              href={nextPath}
              className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-300 transition-colors"
            >
              <span className="text-[11px] font-medium tracking-widest uppercase">
                {tapLabel}
              </span>
              <ChevronDown className="size-4" />
            </Link>
          )
        )}
      </footer>
    </div>
  );
}
