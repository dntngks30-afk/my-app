'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, PlayCircle, BarChart2, User } from 'lucide-react';

const ITEMS = [
  { href: '/app/home', label: '리셋', icon: Calendar },
  { href: '/app/routine/player', label: '루틴', icon: PlayCircle },
  { href: '/app/checkin', label: '기록', icon: BarChart2 },
  { href: '/app/profile', label: '마이', icon: User },
] as const;

function isTabActive(
  href: string,
  pathname: string | null
): boolean {
  if (!pathname) return false;
  if (href === '/app/home') return pathname === '/app/home';
  if (href === '/app') return pathname === '/app' || pathname.startsWith('/app/routine');
  if (href === '/app/checkin') return pathname.startsWith('/app/checkin');
  if (href === '/app/profile') return pathname.startsWith('/app/profile');
  return pathname === href;
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-2 safe-area-pb">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isTabActive(href, pathname);

        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
              active ? 'font-semibold text-slate-800' : 'text-slate-400'
            }`}
          >
            <Icon
              className="size-5"
              strokeWidth={active ? 2.5 : 2}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
