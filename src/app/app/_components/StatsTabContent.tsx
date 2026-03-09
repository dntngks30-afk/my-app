'use client';

import { useState, useEffect, useRef } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedActiveSessionLite } from '@/lib/session/active-cache';
import { getCache, getCacheStale, isFresh } from '@/lib/cache/tabDataCache';
import { StatsViewV2 } from './nav-v2/StatsViewV2';

interface StatsTabContentProps {
  hideBottomNav?: boolean;
  /** Lazy fetch: only fetch when tab is first visible */
  isVisible?: boolean;
}

export default function StatsTabContent({ hideBottomNav, isVisible = false }: StatsTabContentProps) {
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(20);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    if (fetchedRef.current) {
      const stale = getCacheStale<{ progress?: { completed_sessions?: number; total_sessions?: number } }>('home.activeLite');
      if (stale?.progress && !isFresh('home.activeLite')) {
        void getSessionSafe().then(({ session }) => {
          if (session?.access_token && !cancelled) {
            void getCachedActiveSessionLite(session.access_token).then((result) => {
              if (!cancelled && result.ok && result.data.progress) {
                const p = result.data.progress;
                setCompleted(p.completed_sessions ?? 0);
                setTotal(p.total_sessions ?? 20);
              }
            });
          }
        });
      }
      return () => { cancelled = true };
    }

    fetchedRef.current = true;
    const cached = getCache<{ progress?: { completed_sessions?: number; total_sessions?: number } }>('home.activeLite')
      ?? getCacheStale<{ progress?: { completed_sessions?: number; total_sessions?: number } }>('home.activeLite');
    if (cached?.progress) {
      setCompleted(cached.progress.completed_sessions ?? 0);
      setTotal(cached.progress.total_sessions ?? 20);
      setLoading(false);
      void getSessionSafe().then(({ session }) => {
        if (session?.access_token && !cancelled) {
          void getCachedActiveSessionLite(session.access_token).then((result) => {
            if (!cancelled && result.ok && result.data.progress) {
              const p = result.data.progress;
              setCompleted(p.completed_sessions ?? 0);
              setTotal(p.total_sessions ?? 20);
            }
          });
        }
      });
      return () => { cancelled = true };
    }

    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      const result = await getCachedActiveSessionLite(session.access_token);
      if (cancelled) return;
      if (result.ok && result.data.progress) {
        const p = result.data.progress;
        setCompleted(p.completed_sessions ?? 0);
        setTotal(p.total_sessions ?? 20);
      }
      setLoading(false);
    })();
    return () => { cancelled = true };
  }, [isVisible]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="px-4 pt-6 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">여정</h1>
        <p className="mt-1 text-sm text-slate-500">나의 리셋 진행 현황</p>
      </header>
      <main className="overflow-y-auto">
        {loading && !completed && total === 20 ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner" aria-busy="true" />
          </div>
        ) : (
          <StatsViewV2 completed={completed} currentSession={completed + 1} totalSessions={total} />
        )}
      </main>
      {!hideBottomNav && (
        <div className="h-16" aria-hidden />
      )}
    </div>
  );
}
