'use client';

/**
 * (main) 그룹: 랜딩 `/` 만 챕터 진입 전환 (다른 (main) 경로는 그대로).
 */
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { publicChapterEnterClass } from '@/lib/public/chapter/enterClass';

export default function MainPublicTemplate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname !== '/') {
    return <>{children}</>;
  }
  return <div className={publicChapterEnterClass('default')}>{children}</div>;
}
