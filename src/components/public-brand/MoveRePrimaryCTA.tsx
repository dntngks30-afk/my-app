'use client';

import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const baseClass =
  'inline-flex min-h-[52px] w-full items-center justify-center rounded-[var(--mr-public-radius-cta)] font-bold text-center text-slate-900 shadow-lg shadow-black/25 transition-colors bg-[var(--mr-public-accent)] hover:bg-[var(--mr-public-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--mr-public-accent)] focus:ring-offset-2 focus:ring-offset-[var(--mr-public-bg-base)] disabled:cursor-not-allowed disabled:opacity-60';

type Common = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export type MoveRePrimaryCTAProps =
  | (Common &
      ButtonHTMLAttributes<HTMLButtonElement> & {
        href?: undefined;
      })
  | (Common &
      Omit<ComponentProps<typeof Link>, 'className' | 'children' | 'style'> & {
        href: string;
      });

/**
 * 하단 프리미엄 primary CTA — 단일 액센트. `href`가 있으면 Next Link로 렌더(인트로 등).
 */
export function MoveRePrimaryCTA(props: MoveRePrimaryCTAProps) {
  const style = { fontFamily: 'var(--font-sans-noto)', ...props.style };

  if ('href' in props && props.href) {
    const { href, children, className, ...rest } = props;
    return (
      <Link href={href} className={cn(baseClass, className)} style={style} {...rest}>
        {children}
      </Link>
    );
  }

  const { children, className, ...rest } = props as Common &
    ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
  return (
    <button type="button" className={cn(baseClass, className)} style={style} {...rest}>
      {children}
    </button>
  );
}
