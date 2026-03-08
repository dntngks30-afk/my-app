'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import TabShell from '../_components/TabShell';

function TabsLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const navV2 = process.env.NODE_ENV === 'production' ? true : searchParams.get('navV2') !== '0';

  if (navV2) {
    return <TabShell />;
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
