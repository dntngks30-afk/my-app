'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import HomePageClient from '../(tabs)/home/_components/HomePageClient';
import StatsTabContent from './StatsTabContent';
import ProfileTabContent from './ProfileTabContent';
import BottomNav from './BottomNav';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedActiveSessionLite } from '@/lib/session/active-cache';
import { getCache, setCache } from '@/lib/cache/tabDataCache';
import { getSessionHistory } from '@/lib/session/client';

const TAB_PATHS = ['/app/home', '/app/checkin', '/app/profile'] as const;

function isTabPath(path: string | null): path is (typeof TAB_PATHS)[number] {
  if (!path) return false;
  if (path === '/app/home') return true;
  if (path.startsWith('/app/checkin')) return true;
  if (path === '/app/profile') return true;
  return false;
}

export default function TabShell() {
  const pathname = usePathname();
  const prefetchedRef = useRef(false);

  // Prefetch stats when on home (idle) — stats tab loads instantly on switch
  useEffect(() => {
    if (pathname !== '/app/home' || prefetchedRef.current) return;
    const cb = () => {
      prefetchedRef.current = true;
      getSessionSafe().then(async ({ session }) => {
        if (!session?.access_token) return;
        getCachedActiveSessionLite(session.access_token);
        if (getCache('stats.weekly') && getCache('stats.history')) return;
        try {
          const [weeklyRes, historyRes] = await Promise.all([
            fetch('/api/report/weekly', {
              cache: 'no-store' as RequestCache,
              headers: { Authorization: `Bearer ${session.access_token}` },
            }),
            getSessionHistory(session.access_token, 20),
          ]);
          if (weeklyRes.ok) {
            const data = await weeklyRes.json();
            setCache('stats.weekly', data);
          }
          if (historyRes.ok) setCache('stats.history', historyRes.data);
        } catch { /* noop */ }
      });
    };
    const useIdle = typeof requestIdleCallback !== 'undefined';
    const id = useIdle
      ? requestIdleCallback(cb, { timeout: 1500 })
      : window.setTimeout(cb, 500);
    return () => {
      if (useIdle && typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(id);
      } else if (!useIdle) {
        window.clearTimeout(id);
      }
    };
  }, [pathname]);

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

      {/* Stats (여정) — persistent mount */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showStats ? 'block' : 'none',
          opacity: showStats ? 1 : 0,
        }}
        aria-hidden={!showStats}
      >
        <StatsTabContent hideBottomNav />
      </div>

      {/* Profile (마이) — persistent mount */}
      <div
        className="tab-panel transition-opacity duration-150 ease-out"
        style={{
          display: showProfile ? 'block' : 'none',
          opacity: showProfile ? 1 : 0,
        }}
        aria-hidden={!showProfile}
      >
        <ProfileTabContent hideBottomNav />
      </div>

      <BottomNav />
    </div>
  );
}
