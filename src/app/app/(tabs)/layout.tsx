'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AppShell from '../_shell/AppShell';

function TabsLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const navV2 = process.env.NODE_ENV === 'production' ? true : searchParams.get('navV2') !== '0';

  if (navV2) {
    return <AppShell />;
  }
  return <>{children}</>;
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TabsLayoutInner>{children}</TabsLayoutInner>
    </Suspense>
  );
}
