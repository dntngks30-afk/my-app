'use client';

import { useState } from 'react';
import AppEntryLoader, { isAppBooted } from '../_components/AppEntryLoader';

export default function HomeLoading() {
  const [booted] = useState(() => isAppBooted());

  // 탭 전환 시: 풀스크린 로더 재출현 금지. 최소 placeholder만.
  if (booted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f8f6f0]">
        <div
          className="h-6 w-6 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner"
          aria-busy="true"
          aria-label="로딩 중"
        />
      </div>
    );
  }

  return <AppEntryLoader status="홈 로딩 중" />;
}
