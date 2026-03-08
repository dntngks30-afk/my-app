'use client';

import { useState, useEffect } from 'react';
import AppEntryLoader, { isAppBooted } from './_components/AppEntryLoader';

export default function AppLoading() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    setBooted(isAppBooted());
  }, []);

  if (booted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#faf8f5]">
        <div
          className="h-6 w-6 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner"
          aria-busy="true"
          aria-label="로딩 중"
        />
      </div>
    );
  }

  return <AppEntryLoader status="앱 로딩 중" />;
}
