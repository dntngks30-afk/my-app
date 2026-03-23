'use client';

import { cn } from '@/lib/utils';

export interface MoveReProgressRailProps {
  /** 1-based */
  current: number;
  total: number;
  className?: string;
  /** 시각적 두께: thin(기본) | micro */
  weight?: 'thin' | 'micro';
}

/**
 * 절제된 상단 진행 레일 (퍼블릭 스텝용).
 */
export function MoveReProgressRail({
  current,
  total,
  className,
  weight = 'thin',
}: MoveReProgressRailProps) {
  const safeTotal = Math.max(1, total);
  const safeCurrent = Math.min(Math.max(1, current), safeTotal);
  const pct = (safeCurrent / safeTotal) * 100;
  const h = weight === 'micro' ? 'h-px' : 'h-[2px]';

  return (
    <div className={cn('w-full px-6 pt-3 pb-1', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-white/[0.08]',
          h
        )}
        role="progressbar"
        aria-valuenow={safeCurrent}
        aria-valuemin={1}
        aria-valuemax={safeTotal}
      >
        <div
          className={cn('h-full rounded-full bg-[var(--mr-public-accent)] transition-[width] duration-300 ease-out', h)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
