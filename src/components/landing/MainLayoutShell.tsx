'use client';

/**
 * (main) 레이아웃용 클라이언트 래퍼
 * pathname === '/' 일 때 Header/TopTabs 숨김 (public landing 전용)
 */

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import TopTabs from '@/components/TopTabs';
import ThemeSwitcher from '@/components/ThemeSwitcher';

export default function MainLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLanding = pathname === '/';

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {!isLanding && (
        <>
          <Header />
          <TopTabs />
        </>
      )}
      <ThemeSwitcher />
      <main>{children}</main>
    </div>
  );
}
