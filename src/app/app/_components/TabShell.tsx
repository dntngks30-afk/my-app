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
 * Persistent tab shell — all tabs stay mounted, visibility toggle only.
 * Tab switch = instant (no remount, no refetch).
 * Stats/Profile fetch only when first opened (isVisible).
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

      {/* Stats (여정) — persistent mount, visibility toggle */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showStats ? 'block' : 'none',
          opacity: showStats ? 1 : 0,
        }}
        aria-hidden={!showStats}
      >
        <StatsTabContent hideBottomNav isVisible={showStats} />
      </div>

      {/* Profile (마이) — persistent mount, visibility toggle */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showProfile ? 'block' : 'none',
          opacity: showProfile ? 1 : 0,
        }}
        aria-hidden={!showProfile}
      >
        <ProfileTabContent hideBottomNav isVisible={showProfile} />
      </div>

      <BottomNav />
    </div>
  );
}
