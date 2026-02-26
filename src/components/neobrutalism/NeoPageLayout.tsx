'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

const MAX_WIDTH = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
} as const;

type MaxWidth = keyof typeof MAX_WIDTH;

export interface NeoPageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: MaxWidth;
}

export const NeoPageLayout = forwardRef<HTMLDivElement, NeoPageLayoutProps>(
  ({ maxWidth = 'md', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'min-h-screen bg-[#F8F6F0] overflow-x-hidden',
          className
        )}
        {...props}
      >
        <div
          className={clsx(
            'mx-auto w-full px-4 py-6 sm:py-8',
            MAX_WIDTH[maxWidth]
          )}
        >
          {children}
        </div>
      </div>
    );
  }
);

NeoPageLayout.displayName = 'NeoPageLayout';
