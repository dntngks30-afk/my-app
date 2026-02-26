'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

const BASE =
  'inline-flex items-center justify-center font-bold rounded-2xl border-2 border-slate-900 transition disabled:cursor-not-allowed disabled:opacity-70';

const VARIANTS = {
  primary:
    'bg-white text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]',
  orange:
    'bg-orange-400 text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]',
  secondary:
    'bg-slate-200 text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:bg-slate-300/80 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]',
  ghost:
    'border-slate-300 bg-white/80 text-slate-700 shadow-[2px_2px_0_0_rgba(15,23,42,0.5)] hover:bg-white active:translate-x-0.5 active:translate-y-0.5',
} as const;

type Variant = keyof typeof VARIANTS;

export interface NeoButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  ({ variant = 'primary', fullWidth, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          BASE,
          VARIANTS[variant],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

NeoButton.displayName = 'NeoButton';
