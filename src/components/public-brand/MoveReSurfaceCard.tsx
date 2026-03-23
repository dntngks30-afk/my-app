'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MoveReSurfaceCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * 묵직한 다크 서페이스 카드 (border + 반투명 fill).
 */
export function MoveReSurfaceCard({ children, className }: MoveReSurfaceCardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--mr-public-radius-card)] border border-white/10 bg-white/[0.04]',
        className
      )}
    >
      {children}
    </div>
  );
}
