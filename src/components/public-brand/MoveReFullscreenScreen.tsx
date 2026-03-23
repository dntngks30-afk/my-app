'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MoveReFullscreenScreenProps {
  children: ReactNode;
  /** 상단 코스믹 글로우 레이어 (기본 true) */
  showCosmicGlow?: boolean;
  /** Starfield 등 추가 배경 — 글로우 아래·z-index 낮게 배치 */
  backgroundSlot?: ReactNode;
  className?: string;
  /** main 영역 래퍼 */
  contentClassName?: string;
}

/**
 * Public 퍼널 공통: 100svh 풀스크린, 단일 세로 스토리 슬롯.
 */
export function MoveReFullscreenScreen({
  children,
  showCosmicGlow = true,
  backgroundSlot,
  className,
  contentClassName,
}: MoveReFullscreenScreenProps) {
  return (
    <div
      className={cn(
        'relative min-h-[100svh] flex flex-col overflow-hidden mr-public-funnel-shell',
        className
      )}
    >
      {backgroundSlot}
      {showCosmicGlow ? <div className="mr-public-cosmic-glow" aria-hidden /> : null}
      <div className={cn('relative z-10 flex min-h-0 flex-1 flex-col', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
