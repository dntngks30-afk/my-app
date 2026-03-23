'use client';

import { cn } from '@/lib/utils';

export interface MoveReChoiceChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: React.ReactNode;
}

/**
 * 주간 횟수·경험 등 선택 칩 — 선택 시 액센트 fill.
 */
export function MoveReChoiceChip({
  selected,
  className,
  children,
  type = 'button',
  ...props
}: MoveReChoiceChipProps) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-[var(--mr-public-chip-radius)] px-3 py-2 text-sm font-medium transition-colors',
        selected
          ? 'bg-[var(--mr-public-accent)] text-[var(--mr-public-bg-base)]'
          : 'bg-white/[0.08] text-[var(--mr-public-fg-muted)]',
        className
      )}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
      {...props}
    >
      {children}
    </button>
  );
}
