'use client';

import { useState, useEffect } from 'react';
import AppEntryLoader, { isAppBooted } from '@/app/app/_components/AppEntryLoader';

export default function HomeLoading() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    setBooted(isAppBooted());
  }, []);

  // 탭 전환 시: 풀스크린 로더 재출현 금지. 최소 placeholder만.
  if (booted) {
    return (
      <div className="relative flex min-h-[50vh] items-center justify-center overflow-hidden bg-[#0c1324] text-[#dce1fb]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="relative h-6 w-6 rounded-full border-2 border-white/20 border-t-[#ffb77d] app-entry-spinner shadow-[0_0_14px_rgba(255,183,125,0.12)]"
          aria-busy="true"
          aria-label="로딩 중"
        />
      </div>
    );
  }

  return <AppEntryLoader status="홈 로딩 중" />;
}
