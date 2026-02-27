'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Calendar, PlayCircle, BarChart2, User } from 'lucide-react';

const TABS = [
  { id: 'reset', href: '/app/home', label: '리셋', icon: Calendar },
  { id: 'routine', href: '/app/routine', label: '루틴', icon: PlayCircle },
  { id: 'checkin', href: '/app/checkin', label: '기록', icon: BarChart2 },
  { id: 'profile', href: '/app/profile', label: '마이', icon: User },
] as const;

function isTabActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/app/home') return pathname === '/app/home';
  if (href === '/app/routine') return pathname?.startsWith('/app/routine');
  if (href === '/app/checkin') return pathname?.startsWith('/app/checkin');
  if (href === '/app/profile') return pathname?.startsWith('/app/profile');
  return pathname === href;
}

export default function BottomNav() {
  const pathname = usePathname();

  const activeTab = TABS.find((t) => isTabActive(t.href, pathname))?.id ?? null;
  useEffect(() => {
    console.log('[NAV_TAB_RENDER]', { pathname, activeTab });
  }, [pathname, activeTab]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t-2 border-slate-900 bg-white px-2 safe-area-pb shadow-[0_-2px_0_0_rgba(15,23,42,1)]">
      {TABS.map(({ id, href, label, icon: Icon }) => {
        const active = isTabActive(href, pathname);
        return (
          <Link
            key={id}
            href={href}
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
