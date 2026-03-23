'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MoveReTopBarProps {
  /** 왼쪽 (예: 뒤로가기) */
  left?: ReactNode;
  /** 중앙 타이틀 */
  title?: string;
  right?: ReactNode;
  className?: string;
}

/**
 * 얇은 상단 바 — 필요한 화면만 사용.
 */
export function MoveReTopBar({ left, title, right, className }: MoveReTopBarProps) {
  return (
    <header
      className={cn(
        'relative z-20 flex h-11 shrink-0 items-center border-b border-white/[0.06] px-3',
        className
      )}
    >
      <div className="flex w-10 shrink-0 justify-start">{left}</div>
      <div
        className="min-w-0 flex-1 truncate text-center text-[11px] font-medium uppercase tracking-widest text-slate-500"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {title}
      </div>
      <div className="flex w-10 shrink-0 justify-end">{right}</div>
    </header>
  );
}
