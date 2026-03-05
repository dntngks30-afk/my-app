'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedActiveSession, invalidateActiveCache } from '@/lib/session/active-cache';
import type { SessionPlan } from '@/lib/session/client';
import BottomNav from '../../_components/BottomNav';
import ResetMapCard from './ResetMapCard';
import { ResetMapV2 } from './reset-map-v2/ResetMapV2';

export default function HomePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debugFlag = searchParams.get('debug') === '1';
  const debugMap = searchParams.get('debugMap') === '1';
  const navV2 = searchParams.get('navV2') !== '0';
  const mapV2 = searchParams.get('mapV2') === '1' || navV2;
  const tsOverride = searchParams.get('ts');
  const csOverride = searchParams.get('cs');
  const hasTsCs = tsOverride != null && csOverride != null;
  const totalSessionsOverride = hasTsCs
    ? Math.max(1, parseInt(tsOverride!, 10) || 1)
    : debugMap
      ? 8
      : undefined;
  const completedSessionsOverride = hasTsCs
    ? Math.max(0, parseInt(csOverride!, 10) || 0)
    : debugMap
      ? 0
      : undefined;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<{
    total_sessions: number;
    completed_sessions: number;
  } | null>(null);
  const [activePlan, setActivePlan] = useState<SessionPlan | null>(null);
  const activeFetchedRef = useRef(false);

  const handleSessionCompleted = useCallback((completedSessions: number) => {
    setSessionProgress(prev =>
      prev ? { ...prev, completed_sessions: completedSessions } : prev
    );
    setActivePlan(null);
    invalidateActiveCache();
  }, []);

  const handleActivePlanCreated = useCallback((plan: SessionPlan) => {
    setActivePlan(plan);
    invalidateActiveCache();
  }, []);

  useEffect(() => {
    if (pathname !== '/app/home') return;
    if (activeFetchedRef.current) return;
    activeFetchedRef.current = true;

    const t0 = performance.now();
    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const result = await getCachedActiveSession(session.access_token);
        if (cancelled) return;
        const elapsed = Math.round(performance.now() - t0);
        if (typeof performance !== 'undefined' && performance.mark) {
          performance.mark('home_active_loaded');
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[perf] home_active_loaded', elapsed, 'ms');
        }
        if (!result.ok) {
          if (result.status === 401) {
            setError('세션을 확인해 주세요');
          } else {
            setError(result.error?.message ?? '세션을 확인해 주세요');
          }
          setLoading(false);
          return;
        }
        setError(null);
        const p = result.data.progress;
        if (p) {
          setSessionProgress({
            total_sessions: p.total_sessions,
            completed_sessions: p.completed_sessions ?? 0,
          });
          setActivePlan(result.data.active ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '세션을 확인해 주세요');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-20">
        <header className="px-4 pt-6 pb-4">
          <span className="text-sm font-semibold text-orange-500">Move Re</span>
          <h1 className="mt-2 text-4xl font-bold text-orange-500">Move Re</h1>
          <p className="mt-2 text-base text-slate-800">로딩 중...</p>
        </header>
        <main className="px-4 space-y-6">
          <div className="h-24 animate-pulse rounded-2xl bg-stone-200" />
          <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-20">
        <header className="px-4 pt-6 pb-4">
          <h1 className="text-4xl font-bold text-slate-800">Move Re</h1>
        </header>
        <main className="px-4">
          <div className="rounded-full border-2 border-red-300 bg-red-50 px-6 py-5 text-center text-sm text-red-700">
            {error}
          </div>
          <p className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/app/auth?next=/app/home')}
              className="text-sm font-medium text-orange-500 underline"
            >
              로그인하기
            </button>
          </p>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      {/* 1. Header */}
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-orange-500">Move Re</h1>
        <p className="mt-2 text-base text-slate-800">
          당신의, 당신에 의한, 당신을 위한 여정
        </p>
      </header>

      <main className="px-4 space-y-6">
        {/* 2. 리셋 지도 — mapV2=1이면 새 지도 UX, 그 외 기존 ResetMapCard */}
        {(() => {
          const total = totalSessionsOverride ?? sessionProgress?.total_sessions ?? 8;
          const completed = completedSessionsOverride ?? sessionProgress?.completed_sessions ?? 0;

          if (mapV2 && total <= 20) {
            return <ResetMapV2 total={total} completed={completed} activePlan={activePlan} onSessionCompleted={handleSessionCompleted} onActivePlanCreated={handleActivePlanCreated} />;
          }

          if (sessionProgress || debugMap) {
            return (
              <ResetMapCard
                totalSessions={sessionProgress?.total_sessions ?? 8}
                completedSessions={sessionProgress?.completed_sessions ?? 0}
                debugMap={debugMap}
                totalSessionsOverride={totalSessionsOverride}
                completedSessionsOverride={completedSessionsOverride}
              />
            );
          }

          return (
            <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
              <h3 className="text-sm font-semibold text-slate-800">리셋 지도</h3>
              <p className="mt-2 text-sm text-slate-600">
                루틴 탭에서 세션을 시작하고 진행도를 확인하세요.
              </p>
            </section>
          );
        })()}

      </main>

      <BottomNav />
    </div>
  );
}
