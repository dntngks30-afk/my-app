'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import { getCachedBootstrap, invalidateActiveCache } from '@/lib/session/active-cache';
import { getCache } from '@/lib/cache/tabDataCache';
import AppEntryLoader, { isAppBooted, setAppBooted } from '@/app/app/_components/AppEntryLoader';
import type { SessionPlan, ActivePlanSummary, ActiveSessionLiteResponse } from '@/lib/session/client';
import BottomNav from '@/app/app/_components/BottomNav';
import ProgressReportCard from './ProgressReportCard';
import ResetMapCard from './ResetMapCard';
import { ResetMapV2 } from './reset-map-v2/ResetMapV2';

interface HomePageClientProps {
  hideBottomNav?: boolean;
}

export default function HomePageClient({ hideBottomNav }: HomePageClientProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debugFlag = searchParams.get('debug') === '1';
  const debugMap = searchParams.get('debugMap') === '1';
  const navV2 = process.env.NODE_ENV === 'production' ? true : (searchParams.get('navV2') !== '0');
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
  const [skipLoader, setSkipLoader] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<{
    total_sessions: number;
    completed_sessions: number;
  } | null>(null);
  const [activePlan, setActivePlan] = useState<SessionPlan | ActivePlanSummary | null>(null);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [nextUnlockAt, setNextUnlockAt] = useState<string | null>(null);

  const activeFetchedRef = useRef(false);
  const authTokenRef = useRef<string | null>(null);
  const authTokenInflightRef = useRef<Promise<string | null> | null>(null);

  const getAuthToken = useCallback(async () => {
    if (authTokenRef.current) return authTokenRef.current;
    if (authTokenInflightRef.current) return authTokenInflightRef.current;

    const promise = getSessionSafe()
      .then(({ session }) => {
        const token = session?.access_token ?? null;
        authTokenRef.current = token;
        return token;
      })
      .finally(() => {
        authTokenInflightRef.current = null;
      });

    authTokenInflightRef.current = promise;
    return promise;
  }, []);

  const handleSessionCompleted = useCallback(async (completedSessions: number) => {
    setSessionProgress(prev =>
      prev ? { ...prev, completed_sessions: completedSessions } : prev
    );
    setActivePlan(null);
    // 낙관적 업데이트: 세션이 방금 완료되었으므로 오늘 cap 즉시 반영
    // refetch 완료 전 타이밍 윈도우에서 다음 세션이 'current'로 노출되는 것을 방지
    setTodayCompleted(true);
    invalidateActiveCache();
    // Refetch to get accurate todayCompleted/nextUnlockAt from server
    const token = await getAuthToken();
    if (token) {
      const result = await getCachedBootstrap(token);
      if (result.ok) {
        const d = result.data.activeLite;
        const p = d.progress;
        if (p) {
          setSessionProgress({
            total_sessions: p.total_sessions,
            completed_sessions: p.completed_sessions ?? 0,
          });
        }
        setTodayCompleted(d.today_completed === true);
        setNextUnlockAt(typeof d.next_unlock_at === 'string' ? d.next_unlock_at : null);
      }
    }
  }, [getAuthToken]);

  const handleActivePlanCreated = useCallback((plan: SessionPlan) => {
    setActivePlan(plan);
    invalidateActiveCache();
  }, []);

  useEffect(() => {
    if (activeFetchedRef.current) return;
    activeFetchedRef.current = true;

    const cached = getCache<ActiveSessionLiteResponse>('home.activeLite')
      ?? getCache<{ activeLite: ActiveSessionLiteResponse }>('home.bootstrap')?.activeLite;
    if (cached?.progress) {
      setSessionProgress({
        total_sessions: cached.progress.total_sessions,
        completed_sessions: cached.progress.completed_sessions ?? 0,
      });
      setActivePlan(cached.active ?? null);
      setTodayCompleted(cached.today_completed === true);
      setNextUnlockAt(typeof cached.next_unlock_at === 'string' ? cached.next_unlock_at : null);
      setLoading(false);
      setError(null);
      if (!isAppBooted()) setAppBooted();
      return () => {
        activeFetchedRef.current = false;
      };
    }

    const t0 = performance.now();
    let cancelled = false;
    (async () => {
      const token = await getAuthToken();
      if (!token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const result = await getCachedBootstrap(token);
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
        const d = result.data.activeLite;
        const p = d.progress;
        if (p) {
          setSessionProgress({
            total_sessions: p.total_sessions,
            completed_sessions: p.completed_sessions ?? 0,
          });
          setActivePlan(d.active ?? null);
        }
        setTodayCompleted(d.today_completed === true);
        setNextUnlockAt(typeof d.next_unlock_at === 'string' ? d.next_unlock_at : null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '세션을 확인해 주세요');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (!isAppBooted()) setAppBooted();
        }
      }
    })();
    return () => {
      cancelled = true;
      activeFetchedRef.current = false; // allow remount (e.g. Strict Mode) to refetch
    };
  }, [getAuthToken]);

  useEffect(() => {
    setSkipLoader(isAppBooted());
  }, []);

  if (loading) {
    // skipLoader는 useEffect에서만 설정 → Hydration mismatch 방지
    if (!skipLoader) {
      return <AppEntryLoader status="홈 로딩 중" />;
    }
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#f8f6f0]">
        <div
          className="h-6 w-6 rounded-full border-2 border-[#e2e8f0] border-t-[#0F172A] app-entry-spinner"
          aria-busy="true"
          aria-label="로딩 중"
        />
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
        {!hideBottomNav && <BottomNav />}
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
        {/* 1. 리셋 지도 — mapV2=1이면 새 지도 UX, 그 외 기존 ResetMapCard */}
        <div>
        {(() => {
          const total = totalSessionsOverride ?? sessionProgress?.total_sessions ?? 8;
          const completed = completedSessionsOverride ?? sessionProgress?.completed_sessions ?? 0;

          if (mapV2 && total <= 20) {
            return (
              <ResetMapV2
                total={total}
                completed={completed}
                activePlan={activePlan}
                todayCompleted={todayCompleted}
                nextUnlockAt={nextUnlockAt}
                getAuthToken={getAuthToken}
                onSessionCompleted={handleSessionCompleted}
                onActivePlanCreated={handleActivePlanCreated}
              />
            );
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
        </div>

        {/* PR-P2-2: 4세션 변화 리포트 foundation */}
        <ProgressReportCard getAuthToken={getAuthToken} />
      </main>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
