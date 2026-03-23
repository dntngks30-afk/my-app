'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MoveReHeroBlockProps {
  eyebrow?: string;
  /** eyebrow 전용 클래스(액센트 톤 등) */
  eyebrowClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 앰버 얇은 구분선 */
  showAccentDivider?: boolean;
  className?: string;
}

/**
 * 큰 한글 헤드라인 + 조용한 서브 — 한 화면 한 메시지.
 */
export function MoveReHeroBlock({
  eyebrow,
  eyebrowClassName,
  title,
  subtitle,
  showAccentDivider = true,
  className,
}: MoveReHeroBlockProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      {eyebrow ? (
        <p
          className={cn(
            'mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-500',
            eyebrowClassName
          )}
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {eyebrow}
        </p>
      ) : null}
      <div
        className="text-slate-100"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {title}
      </div>
      {showAccentDivider ? (
        <div
          className="my-5 h-px w-14 bg-[var(--mr-public-accent)] opacity-90 md:my-6"
          aria-hidden
        />
      ) : null}
      {subtitle ? (
        <div
          className="max-w-prose text-sm leading-relaxed text-slate-400 md:text-base"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
