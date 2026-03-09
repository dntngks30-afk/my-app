'use client';

import { useState, useEffect, useRef } from 'react';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedActiveSessionLite } from '@/lib/session/active-cache';
import { getCache, getCacheStale, isFresh } from '@/lib/cache/tabDataCache';
import { ProfileViewV2 } from './nav-v2/ProfileViewV2';

interface ProfileTabContentProps {
  hideBottomNav?: boolean;
  /** Lazy fetch: only fetch when tab is first visible */
  isVisible?: boolean;
}

export default function ProfileTabContent({ hideBottomNav, isVisible = false }: ProfileTabContentProps) {
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;

    if (fetchedRef.current) {
      const stale = getCacheStale<{ progress?: { completed_sessions?: number } }>('home.activeLite');
      if (stale?.progress && !isFresh('home.activeLite')) {
        void getSessionSafe().then(({ session }) => {
          if (session?.access_token && !cancelled) {
            void getCachedActiveSessionLite(session.access_token).then((result) => {
              if (!cancelled && result.ok && result.data.progress) {
                setCompleted(result.data.progress.completed_sessions ?? 0);
              }
            });
          }
        });
      }
      return () => { cancelled = true };
    }

    fetchedRef.current = true;
    const cached = getCache<{ progress?: { completed_sessions?: number } }>('home.activeLite')
      ?? getCacheStale<{ progress?: { completed_sessions?: number } }>('home.activeLite');
    if (cached?.progress) {
      setCompleted(cached.progress.completed_sessions ?? 0);
      setLoading(false);
      void getSessionSafe().then(({ session }) => {
        if (session?.access_token && !cancelled) {
          void getCachedActiveSessionLite(session.access_token).then((result) => {
            if (!cancelled && result.ok && result.data.progress) {
              setCompleted(result.data.progress.completed_sessions ?? 0);
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
        setCompleted(result.data.progress.completed_sessions ?? 0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true };
  }, [isVisible]);

  return (
    <div className="min-h-screen bg-white pb-20">
      <header className="px-4 pt-6 pb-4 border-b border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">마이</h1>
        <p className="mt-1 text-sm text-slate-500">프로필 및 설정</p>
      </header>
      <main>
        {loading && !completed ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner" aria-busy="true" />
          </div>
        ) : (
          <ProfileViewV2 completed={completed} />
        )}
      </main>
      {!hideBottomNav && (
        <div className="h-16" aria-hidden />
      )}
    </div>
  );
}
