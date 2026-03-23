'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type Base = {
  children: React.ReactNode;
  className?: string;
};

type LinkProps = Base & {
  href: string;
} & Omit<React.ComponentProps<typeof Link>, 'className' | 'children'>;

type ButtonProps = Base & {
  href?: undefined;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export type MoveReSecondaryCTAProps = LinkProps | ButtonProps;

/**
 * 보조 CTA — 아웃라인/고스트 톤 통일.
 */
export function MoveReSecondaryCTA(props: MoveReSecondaryCTAProps) {
  const cls = cn(
    'flex min-h-[48px] w-full items-center justify-center rounded-[var(--mr-public-radius-cta)] border border-white/20 font-medium text-slate-300 transition-colors',
    'hover:bg-white/5',
    props.className
  );
  const style = { fontFamily: 'var(--font-sans-noto)' } as const;

  if ('href' in props && props.href) {
    const { href, children, className, ...rest } = props as LinkProps;
    return (
      <Link href={href} className={cls} style={style} {...rest}>
        {children}
      </Link>
    );
  }

  const { children, className, ...rest } = props as ButtonProps;
  return (
    <button type="button" className={cls} style={style} {...rest}>
      {children}
    </button>
  );
}
