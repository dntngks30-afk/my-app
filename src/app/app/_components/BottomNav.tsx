'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, PlayCircle, BarChart2, User, Map, BarChart3 } from 'lucide-react';

/* ── navV1 탭 (기존) ── */
const TABS_V1 = [
  { id: 'reset', href: '/app/home', label: '리셋', icon: Calendar },
  { id: 'routine', href: '/app/routine', label: '루틴', icon: PlayCircle },
  { id: 'checkin', href: '/app/checkin', label: '기록', icon: BarChart2 },
  { id: 'profile', href: '/app/profile', label: '마이', icon: User },
] as const;

/* ── navV2 탭 (3개) ── */
const TABS_V2 = [
  { id: 'map', baseHref: '/app/home', label: '지도', icon: Map },
  { id: 'stats', baseHref: '/app/checkin', label: '여정', icon: BarChart3 },
  { id: 'my', baseHref: '/app/profile', label: '마이', icon: User },
] as const;

function isTabActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/app/home') return pathname === '/app/home';
  if (href.startsWith('/app/routine')) return pathname?.startsWith('/app/routine');
  if (href.startsWith('/app/checkin')) return pathname?.startsWith('/app/checkin');
  if (href.startsWith('/app/profile')) return pathname?.startsWith('/app/profile');
  return pathname === href;
}

export default function BottomNav() {
  const pathname = usePathname();

  // prod: V2 강제 ON. dev: navV2=0 시에만 V1 (테스트용)
  const [navV2, setNavV2] = useState(true);
  useEffect(() => {
    try {
      if (process.env.NODE_ENV === 'production') {
        setNavV2(true);
        return;
      }
      const v = new URLSearchParams(window.location.search).get('navV2');
      setNavV2(v !== '0');
    } catch { /* noop */ }
  }, [pathname]);

  useEffect(() => {
    const activeTab = navV2
      ? TABS_V2.find(t => isTabActive(t.baseHref, pathname))?.id ?? null
      : TABS_V1.find(t => isTabActive(t.href, pathname))?.id ?? null;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[NAV_TAB_RENDER]', { pathname, activeTab, navV2 });
    }
  }, [pathname, navV2]);

  if (navV2) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t-2 border-slate-900 bg-white px-2 safe-area-pb shadow-[0_-2px_0_0_rgba(15,23,42,1)]">
        {TABS_V2.map(({ id, baseHref, label, icon: Icon }) => {
          const active = isTabActive(baseHref, pathname);
          const href = baseHref;
          return (
            <Link
              key={id}
              href={href}
              prefetch={false}
              onClick={() => { if (process.env.NODE_ENV !== 'production') console.log('[NAV_TAB_CLICK]', { tab: id, href }); }}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
                active ? 'font-semibold text-slate-800' : 'text-slate-400'
              }`}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  /* navV1 — opt-out 시에만 (navV2=0) */
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t-2 border-slate-900 bg-white px-2 safe-area-pb shadow-[0_-2px_0_0_rgba(15,23,42,1)]">
      {TABS_V1.map(({ id, href, label, icon: Icon }) => {
        const active = isTabActive(href, pathname);
        const hrefWithOptOut = `${href}${href.includes('?') ? '&' : '?'}navV2=0`;
        return (
          <Link
            key={id}
            href={hrefWithOptOut}
            prefetch={false}
            onClick={() => console.log('[NAV_TAB_CLICK]', { tab: id, href })}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
              active ? 'font-semibold text-slate-800' : 'text-slate-400'
            }`}
          >
            <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
