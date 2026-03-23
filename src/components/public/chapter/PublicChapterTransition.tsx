import type { ReactNode } from 'react';

import type { PublicChapterVariant } from '@/lib/public/chapter/presets';
import { publicChapterEnterClass } from '@/lib/public/chapter/enterClass';
import { cn } from '@/lib/utils';

export type PublicChapterTransitionProps = {
  children: ReactNode;
  variant: PublicChapterVariant;
  className?: string;
};

/**
 * 공개 퍼널 라우트 진입 전환 (CSS + prefers-reduced-motion).
 * 서버 컴포넌트 — 클라이언트 전용 페이지에서 쓰려면 `publicChapterEnterClass`를 div에 직접 적용한다.
 */
export function PublicChapterTransition({
  children,
  variant,
  className,
}: PublicChapterTransitionProps) {
  return (
    <div className={cn(publicChapterEnterClass(variant), className)}>
      {children}
    </div>
  );
}
