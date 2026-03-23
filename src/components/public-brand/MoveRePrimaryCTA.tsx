'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type MoveRePrimaryCTAProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

/**
 * 하단 프리미엄 primary CTA — 단일 액센트.
 */
export function MoveRePrimaryCTA({ className, children, style, ...props }: MoveRePrimaryCTAProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full min-h-[52px] rounded-[var(--mr-public-radius-cta)] font-bold text-slate-900 shadow-lg shadow-black/25 transition-colors',
        'bg-[var(--mr-public-accent)] hover:bg-[var(--mr-public-accent-hover)]',
        'focus:outline-none focus:ring-2 focus:ring-[var(--mr-public-accent)] focus:ring-offset-2 focus:ring-offset-[var(--mr-public-bg-base)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
      style={{ fontFamily: 'var(--font-sans-noto)', ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
