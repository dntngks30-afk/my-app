'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MoveReStepNavRowProps {
  /** 좌측 슬롯(이전 등) — 비우면 레이아웃만 유지 */
  left?: ReactNode;
  /** 우측 슬롯(다음 등) */
  right?: ReactNode;
  className?: string;
}

/**
 * 단계형 퍼널 하단: 좌측 이전 · 우측 다음 (각 flex-1).
 */
export function MoveReStepNavRow({ left, right, className }: MoveReStepNavRowProps) {
  return (
    <div className={cn('flex w-full shrink-0 items-stretch gap-3', className)}>
      <div className="flex min-h-[52px] min-w-0 flex-1 items-stretch justify-start">
        {left ?? <span className="block min-h-[52px] w-full" aria-hidden />}
      </div>
      <div className="flex min-h-[52px] min-w-0 flex-1 items-stretch justify-end">
        {right ?? <span className="block min-h-[52px] w-full" aria-hidden />}
      </div>
    </div>
  );
}
