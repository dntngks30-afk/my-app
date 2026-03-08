'use client';

import { usePathname } from 'next/navigation';
import HomePageClient from '../(tabs)/home/_components/HomePageClient';
import StatsTabContent from './StatsTabContent';
import ProfileTabContent from './ProfileTabContent';
import BottomNav from './BottomNav';

const TAB_PATHS = ['/app/home', '/app/checkin', '/app/profile'] as const;

function isTabPath(path: string | null): path is (typeof TAB_PATHS)[number] {
  if (!path) return false;
  if (path === '/app/home') return true;
  if (path.startsWith('/app/checkin')) return true;
  if (path === '/app/profile') return true;
  return false;
}

/**
 * weekly/history prefetch 제거 — first paint 방해.
 * stats 탭은 사용자가 탭 진입 시 checkin 페이지에서 fetch.
 */
export default function TabShell() {
  const pathname = usePathname();
  const active = isTabPath(pathname) ? pathname : '/app/home';
  const showHome = active === '/app/home' || active.startsWith('/app/home');
  const showStats = active.startsWith('/app/checkin');
  const showProfile = active === '/app/profile';

  return (
    <div className="relative min-h-screen bg-white">
      {/* Home — persistent mount */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showHome ? 'block' : 'none',
          opacity: showHome ? 1 : 0,
        }}
        aria-hidden={!showHome}
      >
        <HomePageClient hideBottomNav />
      </div>

      {/* Stats (여정) — lazy mount: 탭 진입 시에만 마운트 */}
      {showStats && (
        <div className="tab-panel transition-opacity duration-150 ease-out" aria-hidden={false}>
          <StatsTabContent hideBottomNav />
        </div>
      )}

      {/* Profile (마이) — lazy mount: 탭 진입 시에만 마운트 */}
      {showProfile && (
        <div className="tab-panel transition-opacity duration-150 ease-out" aria-hidden={false}>
          <ProfileTabContent hideBottomNav />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
