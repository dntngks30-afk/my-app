'use client';

import { usePathname } from 'next/navigation';
import MapTab from '../_tabs/map/MapTab';
import StatsTab from '../_tabs/stats/StatsTab';
import MyTab from '../_tabs/my/MyTab';
import BottomNav from '../_components/BottomNav';

const TAB_PATHS = ['/app/home', '/app/checkin', '/app/profile'] as const;

function isTabPath(path: string | null): path is (typeof TAB_PATHS)[number] {
  if (!path) return false;
  if (path === '/app/home') return true;
  if (path.startsWith('/app/checkin')) return true;
  if (path === '/app/profile') return true;
  return false;
}

/**
 * Persistent app shell — 지도 / 통계 / 마이 tabs stay mounted.
 * Tab switch = visibility toggle only (no remount, no refetch).
 * Stats/My fetch only when first opened (isVisible).
 */
export default function AppShell() {
  const pathname = usePathname();
  const active = isTabPath(pathname) ? pathname : '/app/home';
  const showMap = active === '/app/home' || active.startsWith('/app/home');
  const showStats = active.startsWith('/app/checkin');
  const showMy = active === '/app/profile';

  /** donor 지도 기본 승격: /app/home 에서 donor theme */
  const useDonorTheme = pathname === '/app/home';

  return (
    <div
      className={`relative min-h-screen ${
        useDonorTheme ? 'bg-[oklch(0.22_0.03_245)]' : 'bg-white'
      }`}
    >
      {/* 지도 — persistent mount */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showMap ? 'block' : 'none',
          opacity: showMap ? 1 : 0,
        }}
        aria-hidden={!showMap}
      >
        <MapTab />
      </div>

      {/* 통계(여정) — persistent mount, visibility toggle */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showStats ? 'block' : 'none',
          opacity: showStats ? 1 : 0,
        }}
        aria-hidden={!showStats}
      >
        <StatsTab isVisible={showStats} />
      </div>

      {/* 마이 — persistent mount, visibility toggle */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showMy ? 'block' : 'none',
          opacity: showMy ? 1 : 0,
        }}
        aria-hidden={!showMy}
      >
        <MyTab isVisible={showMy} />
      </div>

      <BottomNav />
    </div>
  );
}
