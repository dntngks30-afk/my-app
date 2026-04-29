'use client';

import { useState, useEffect } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedActiveSessionLite } from '@/lib/session/active-cache';
import {
  getCache,
  getCacheStale,
} from '@/lib/cache/tabDataCache';
import { JourneyTabViewV2 } from '@/app/app/_components/nav-v2/JourneyTabViewV2';
import { APP_TAB_BG } from '@/app/app/_components/nav-v2/appTabTheme';

type ActiveLiteCache = {
  progress?: { completed_sessions?: number; total_sessions?: number };
};

function initialCompletedSessions(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const c =
      getCacheStale<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<{ activeLite: ActiveLiteCache }>('home.bootstrap')?.activeLite;
    return c?.progress?.completed_sessions ?? 0;
  } catch {
    return 0;
  }
}

function initialTotalSessions(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const c =
      getCacheStale<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<{ activeLite: ActiveLiteCache }>('home.bootstrap')?.activeLite;
    const t = c?.progress?.total_sessions;
    return typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.floor(t) : null;
  } catch {
    return null;
  }
}

interface MyTabProps {
  isVisible: boolean;
}

/**
 * 여정 탭 — AppShell 경로(`/app/profile`). layout 이 page.tsx 를 렌더하지 않으므로
 * 여기서 JourneyTabViewV2 + 완료 세션 값을 제공한다 (@see `(tabs)/layout.tsx`).
 */
export default function MyTab({ isVisible }: MyTabProps) {
  const [completedSessions, setCompletedSessions] = useState<number>(initialCompletedSessions);
  const [totalSessions, setTotalSessions] = useState<number | null>(initialTotalSessions);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    const cached =
      getCache<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<{ activeLite: ActiveLiteCache }>('home.bootstrap')?.activeLite;
    if (cached?.progress) {
      if (cached.progress.completed_sessions != null) {
        setCompletedSessions(cached.progress.completed_sessions);
      }
      const t = cached.progress.total_sessions;
      setTotalSessions(typeof t === 'number' && Number.isFinite(t) && t > 0 ? Math.floor(t) : null);
    }

    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) return;
      const result = await getCachedActiveSessionLite(session.access_token);
      if (cancelled) return;
      if (result.ok && result.data.progress) {
        const p = result.data.progress;
        setCompletedSessions(p.completed_sessions ?? 0);
        const tt = p.total_sessions;
        setTotalSessions(typeof tt === 'number' && Number.isFinite(tt) && tt > 0 ? Math.floor(tt) : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: APP_TAB_BG }}>
      <main className="overflow-y-auto">
        <JourneyTabViewV2 completedSessions={completedSessions} totalSessions={totalSessions} />
      </main>
    </div>
  );
}
