'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

const BASE =
  'rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]';

export interface NeoCardProps extends HTMLAttributes<HTMLDivElement> {}

export const NeoCard = forwardRef<HTMLDivElement, NeoCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={clsx(BASE, className)} {...props}>
        {children}
      </div>
    );
  }
);

NeoCard.displayName = 'NeoCard';
