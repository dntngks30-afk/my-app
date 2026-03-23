'use client';

import type { ReactNode } from 'react';

export type BaselineResultStep3Props = {
  children: ReactNode;
  footer: ReactNode;
};

/**
 * step 3 스크롤 본문 + 하단 액션 영역 (footer는 부모가 truth CTA 구조 유지)
 */
export function BaselineResultStep3({ children, footer }: BaselineResultStep3Props) {
  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-1">{children}</div>
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        {footer}
      </div>
    </>
  );
}
