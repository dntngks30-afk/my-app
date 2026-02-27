'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/app/home', label: '리셋', icon: '🏠' },
  { href: '/app/home', label: '루틴', icon: '💪' },
  { href: '/app/checkin', label: '기록', icon: '📋' },
  { href: '/app/profile', label: '마이', icon: '👤' },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/app/home') return pathname === '/app/home';
    if (href === '/app/checkin') return pathname?.startsWith('/app/checkin');
    if (href === '/app/profile') return pathname?.startsWith('/app/profile');
    return pathname === href;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-[color:var(--border)] bg-[var(--surface)] safe-area-pb">
      <Link
        href="/app/home"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          isActive('/app/home') ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">🏠</span>
        <span>리셋</span>
      </Link>
      <Link
        href="/app/home"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname === '/app/home' || pathname?.startsWith('/app/routine') ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">💪</span>
        <span>루틴</span>
      </Link>
      <Link
        href="/app/checkin"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname?.startsWith('/app/checkin') ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">📋</span>
        <span>기록</span>
      </Link>
      <Link
        href="/app/profile"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname?.startsWith('/app/profile') ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">👤</span>
        <span>마이</span>
      </Link>
    </nav>
  );
}
