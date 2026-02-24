'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/app', label: '홈', icon: '🏠' },
  { href: '/app', label: '루틴', icon: '💪', activeOnPath: '/app' },
  { href: '/app/checkin', label: '기록', icon: '📋' },
  { href: '/app', label: '마이', icon: '👤' },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-[color:var(--border)] bg-[var(--surface)] safe-area-pb">
      <Link
        href="/app"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname === '/app' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">🏠</span>
        <span>홈</span>
      </Link>
      <Link
        href="/app"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname === '/app' || pathname?.startsWith('/app/routine') ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
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
        href="/app"
        className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs ${
          pathname === '/app' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'
        }`}
      >
        <span className="text-lg">👤</span>
        <span>마이</span>
      </Link>
    </nav>
  );
}
