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

/** AppShell 진행 카드 문서와 프로필 경로 페이지와 동일 기본값 */
const DEFAULT_TOTAL_SESSIONS = 12;

type ActiveLiteCache = { progress?: { completed_sessions?: number } };

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

interface MyTabProps {
  isVisible: boolean;
}

/**
 * 여정 탭 — AppShell 경로(`/app/profile`). layout 이 page.tsx 를 렌더하지 않으므로
 * 여기서 JourneyTabViewV2 + 완료 세션 값을 제공한다 (@see `(tabs)/layout.tsx`).
 */
export default function MyTab({ isVisible }: MyTabProps) {
  const [completedSessions, setCompletedSessions] = useState<number>(initialCompletedSessions);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    const cached =
      getCache<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<ActiveLiteCache>('home.activeLite') ??
      getCacheStale<{ activeLite: ActiveLiteCache }>('home.bootstrap')?.activeLite;
    if (cached?.progress?.completed_sessions != null) {
      setCompletedSessions(cached.progress.completed_sessions);
    }

    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) return;
      const result = await getCachedActiveSessionLite(session.access_token);
      if (cancelled) return;
      if (result.ok && result.data.progress) {
        setCompletedSessions(result.data.progress.completed_sessions ?? 0);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: APP_TAB_BG }}>
      <main className="overflow-y-auto">
        <JourneyTabViewV2
          completedSessions={completedSessions}
          totalSessions={DEFAULT_TOTAL_SESSIONS}
        />
      </main>
    </div>
  );
}
