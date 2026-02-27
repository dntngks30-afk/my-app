'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { Calendar, PlayCircle, BarChart2, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const TABS = [
  { id: 'reset', href: '/app/home', label: '리셋', icon: Calendar },
  { id: 'routine', href: '/app/routine/player', label: '루틴', icon: PlayCircle, requiresRoutine: true },
  { id: 'checkin', href: '/app/checkin', label: '기록', icon: BarChart2 },
  { id: 'profile', href: '/app/profile', label: '마이', icon: User },
] as const;

function isTabActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/app/home') return pathname === '/app/home';
  if (href === '/app/routine/player') return pathname?.startsWith('/app/routine');
  if (href === '/app/checkin') return pathname?.startsWith('/app/checkin');
  if (href === '/app/profile') return pathname?.startsWith('/app/profile');
  return pathname === href;
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navInFlightRef = useRef(false);

  const activeTab = TABS.find((t) => isTabActive(t.href, pathname))?.id ?? null;
  useEffect(() => {
    console.log('[NAV_TAB_RENDER]', { pathname, activeTab });
  }, [pathname, activeTab]);

  const handleRoutineClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (navInFlightRef.current) return;
      navInFlightRef.current = true;
      console.log('[NAV_TAB_CLICK]', { tab: 'routine', href: '/app/routine/player' });
      console.log('[NAV_TAB_NAVIGATE_START]');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          router.push(`/app/auth?next=${encodeURIComponent('/app/routine/player')}`);
          return;
        }
        const res = await fetch('/api/workout-routine/get', {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        const routineId = data?.routine?.id;
        if (routineId) {
          const statusRes = await fetch('/api/routine-engine/status', {
            cache: 'no-store' as RequestCache,
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const statusData = await statusRes.json().catch(() => ({}));
          const day = statusData?.state?.currentDay ?? 1;
          const target = `/app/routine/player?routineId=${encodeURIComponent(routineId)}&day=${day}`;
          router.push(target);
          console.log('[NAV_TAB_NAVIGATE_SUCCESS]', { target });
        } else {
          router.push('/app/routine/player');
          console.log('[NAV_TAB_NAVIGATE]', { reason: 'no_routine', target: '/app/routine/player' });
        }
      } catch (err) {
        console.warn('[NAV_TAB_NAVIGATE_FAIL]', { error: String(err), fallback: '/app/routine/player' });
        router.push('/app/routine/player');
      } finally {
        navInFlightRef.current = false;
      }
    },
    [router]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t-2 border-slate-900 bg-white px-2 safe-area-pb shadow-[0_-2px_0_0_rgba(15,23,42,1)]">
      {TABS.map(({ id, href, label, icon: Icon, requiresRoutine }) => {
        const active = isTabActive(href, pathname);

        if (requiresRoutine) {
          return (
            <button
              key={id}
              type="button"
              onClick={handleRoutineClick}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition ${
                active ? 'font-semibold text-slate-800' : 'text-slate-400'
              }`}
              aria-label={label}
            >
              <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </button>
          );
        }

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
