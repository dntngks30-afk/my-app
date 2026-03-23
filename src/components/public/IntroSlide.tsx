'use client';

/**
 * 공통 intro 스토리 슬라이드 래퍼
 * 100svh, 별 배경, 진행 표시, 하단 좌우 이전/다음
 * 브랜드: docs/BRAND_UI_SSOT_MOVE_RE.md — 토큰만 사용
 */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import {
  MoveReFullscreenScreen,
  MoveRePrimaryCTA,
  MoveReSecondaryCTA,
  MoveReStepNavRow,
} from '@/components/public-brand';
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
  /** true면 하단 이전/다음(또는 커스텀 푸터) 바를 렌더하지 않음 — profile 등 본문에 폼이 있을 때 */
  hideBottomBar?: boolean;
}

export function IntroSlide({
  currentPath,
  children,
  tapLabel = 'TAP TO CONTINUE',
  footer,
  hideBottomBar = false,
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
          <div className="flex max-w-[220px] flex-1 justify-center gap-1.5 px-2" aria-hidden>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 w-6 shrink-0 rounded-full transition-colors ${
                  i <= stepIndex ? 'bg-[var(--mr-public-accent)]' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
          <div className="w-10" />
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-5">
          <main
            className={`relative z-10 flex min-h-0 flex-1 flex-col items-center px-1 ${
              hideBottomBar
                ? 'justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]'
                : 'justify-center'
            }`}
          >
            {children}
          </main>

          {!hideBottomBar &&
            (footer ? (
              <div className="shrink-0 w-full border-t border-white/[0.06] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                {/* 커스텀 푸터(예: profile 폼): max-w-md 블록이 화면 중앙에 오도록 */}
                <div className="mx-auto w-full max-w-md px-4">{footer}</div>
              </div>
            ) : (
              <div className="shrink-0 border-t border-white/[0.06] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                <MoveReStepNavRow
                  left={
                    prevPath ? (
                      <MoveReSecondaryCTA href={prevPath} className="min-h-[52px] w-full">
                        이전
                      </MoveReSecondaryCTA>
                    ) : undefined
                  }
                  right={
                    nextPath ? (
                      <MoveRePrimaryCTA href={nextPath} className="w-full">
                        {tapLabel}
                      </MoveRePrimaryCTA>
                    ) : undefined
                  }
                />
              </div>
            ))}
        </div>
      </div>
    </MoveReFullscreenScreen>
  );
}
