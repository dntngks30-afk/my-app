'use client';

/**
 * Card - 공용 카드 컴포넌트
 * 
 * CSS 변수 기반으로 일관된 스타일 제공
 */

import { ReactNode, forwardRef } from 'react';

interface CardProps {
  children: ReactNode;
  variant?: 'default' | 'highlight' | 'subtle';
  className?: string;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', className = '' }, ref) => {
    const variantStyles = {
      default: 'bg-[var(--surface)] border border-[color:var(--border)]',
      highlight: 'bg-[var(--brand-soft)] border border-[color:var(--brand)]',
      subtle: 'bg-[var(--surface-2)] border border-[color:var(--border)]',
    };

    return (
      <div
        ref={ref}
        className={`
          rounded-[var(--radius)]
          ${variantStyles[variant]}
          shadow-[var(--shadow-0)]
          ${className}
        `}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
