'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import { invalidateActiveCache } from '@/lib/session/active-cache';
import { getCache } from '@/lib/cache/tabDataCache';
import AppEntryLoader, { isAppBooted, setAppBooted } from '@/app/app/_components/AppEntryLoader';
import type { SessionPlan, ActivePlanSummary, ActiveSessionLiteResponse, HomeNodeDisplayBundle } from '@/lib/session/client';
import { fetchReadinessClient } from '@/lib/readiness/fetchReadinessClient';
import type { SessionReadinessNextAction } from '@/lib/readiness/types';
import {
  getAppBootstrapCacheSnapshot,
  getCachedAppBootstrap,
  invalidateAppBootstrapCache,
  revalidateAppBootstrap,
  type AppBootstrapResponse,
  type AppBootstrapStatsPreview,
} from '@/lib/app/bootstrapClient';
import {
  getLatestResetMapFlow,
  startResetMapFlow,
} from '@/lib/reset-map/client';
import {
  getResetMapClientState,
  setResetMapClientState,
  clearResetMapClientState,
} from '@/lib/reset-map/clientStorage';
import {
  getIdempotencyKey,
  clearAllKeysForNewFlow,
  clearApplyKey,
} from '@/lib/reset-map/clientIdempotency';
import { reconcileResetMapClientState } from '@/lib/reset-map/reconcile';
import BottomNav from '@/app/app/_components/BottomNav';
import ProgressReportCard from './ProgressReportCard';
import ResetMapCard from './ResetMapCard';
import { ResetMapV2 } from './reset-map-v2/ResetMapV2';
import type { DonorResetMapProps } from '@/features/map_ui_import/home_map_20260315/components/reset-map';

interface HomePageClientProps {
  hideBottomNav?: boolean;
  isVisible?: boolean;
}

type DonorMapRendererProps = Omit<DonorResetMapProps, 'onNodeTap'> & {
  onNodeTap: NonNullable<DonorResetMapProps['onNodeTap']>;
};

function DonorMapLoadingShell() {
  return (
    <div
      className="flex h-full min-h-[480px] w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[#07111f]"
      aria-busy="true"
      aria-label="리셋 지도 준비 중"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="relative h-24 w-28">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-orange-400/40 to-transparent" />
          <div className="absolute left-1/2 top-4 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-400/80 shadow-[0_0_18px_rgba(251,146,60,0.35)]" />
          <div className="absolute left-[38%] top-11 h-2 w-2 rounded-full bg-white/35" />
          <div className="absolute left-[56%] top-[68px] h-2 w-2 rounded-full bg-white/25" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">리셋 지도 준비 중</p>
          <p className="mt-1 text-xs text-white/55">오늘의 움직임 경로를 불러오고 있어요.</p>
        </div>
      </div>
    </div>
  );
}

const DonorResetMap = dynamic<DonorMapRendererProps>(
  () =>
    import('@/features/map_ui_import/home_map_20260315/components/reset-map')
      .then((mod) => mod.ResetMap),
  {
    ssr: false,
    loading: () => <DonorMapLoadingShell />,
  }
);

function hrefForReadinessNext(code: SessionReadinessNextAction | undefined): string {
  switch (code) {
    case 'GO_PAYMENT':
    case 'GO_RESULT':
      return '/movement-test/baseline';
    case 'GO_ONBOARDING':
      return '/onboarding';
    case 'GO_SESSION_CREATE':
      return '/session-preparing';
    case 'GO_AUTH':
      return '/app/auth';
    case 'GO_APP_HOME':
      return '/app/home';
    default:
      return '/onboarding';
  }
}

export default function HomePageClient({
  hideBottomNav,
  isVisible = true,
}: HomePageClientProps = {}) {
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
  const [statsPreview, setStatsPreview] = useState<AppBootstrapStatsPreview | null>(null);
  /** PR-UX-14: next session preview (bootstrap) */
  const [nextSession, setNextSession] = useState<AppBootstrapResponse['next_session']>(null);
  /** PR-ALG-15: adaptive explanation (bootstrap) */
  const [adaptiveExplanation, setAdaptiveExplanation] = useState<AppBootstrapResponse['adaptive_explanation']>(null);
  /** PR-RESET-05: reset-map flow for execution-entry tracking */
  const [resetMapFlowId, setResetMapFlowId] = useState<string | null>(null);
  /** PR4: canonical node display slice from app bootstrap (reduces map batch hydration fetch). */
  const [nodeDisplayBundle, setNodeDisplayBundle] = useState<HomeNodeDisplayBundle | null>(null);
  /** PR-HOME-RAIL-NOT-READY: DB progress 행 없을 때 가짜 16칸 맵 비표시 */
  const [railReady, setRailReady] = useState<boolean | null>(null);
  const [progressSource, setProgressSource] = useState<'db' | 'default_fallback' | null>(null);
  const [railRecoveryHref, setRailRecoveryHref] = useState('/onboarding');
  const railRecoveryFetchedRef = useRef(false);

  const isRailNotReady =
    railReady === false || progressSource === 'default_fallback';

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

  const applyBootstrapState = useCallback((data: AppBootstrapResponse) => {
    setSessionProgress({
      total_sessions: data.session.total_sessions,
      completed_sessions: data.session.completed_sessions ?? 0,
    });
    setActivePlan(data.session.active_session ?? null);
    setTodayCompleted(data.session.today_completed === true);
    setNextUnlockAt(typeof data.session.next_unlock_at === 'string' ? data.session.next_unlock_at : null);
    setStatsPreview(data.stats_preview);
    setNextSession(data.next_session ?? null);
    setAdaptiveExplanation(data.adaptive_explanation ?? null);
    setNodeDisplayBundle(data.node_display_bundle && data.node_display_bundle.items.length > 0 ? data.node_display_bundle : null);
    setRailReady(data.session.rail_ready ?? null);
    setProgressSource(data.session.progress_source ?? null);
  }, []);

  const applyActiveLiteState = useCallback((data: ActiveSessionLiteResponse) => {
    setSessionProgress({
      total_sessions: data.progress.total_sessions,
      completed_sessions: data.progress.completed_sessions ?? 0,
    });
    setActivePlan(data.active ?? null);
    setTodayCompleted(data.today_completed === true);
    setNextUnlockAt(typeof data.next_unlock_at === 'string' ? data.next_unlock_at : null);
    setRailReady(data.rail_ready ?? null);
    setProgressSource(data.progress_source ?? null);
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
    invalidateAppBootstrapCache();
    // Refetch to get accurate todayCompleted/nextUnlockAt from server
    const token = await getAuthToken();
    if (token) {
      const result = await getCachedAppBootstrap(token);
      if (result.ok) {
        setSessionProgress({
          total_sessions: result.data.session.total_sessions,
          completed_sessions: result.data.session.completed_sessions ?? 0,
        });
        setTodayCompleted(result.data.session.today_completed === true);
        setNextUnlockAt(typeof result.data.session.next_unlock_at === 'string' ? result.data.session.next_unlock_at : null);
        setStatsPreview(result.data.stats_preview);
        setNextSession(result.data.next_session ?? null);
        setAdaptiveExplanation(result.data.adaptive_explanation ?? null);
        setRailReady(result.data.session.rail_ready ?? null);
        setProgressSource(result.data.session.progress_source ?? null);
      }
    }
  }, [getAuthToken]);

  const handleActivePlanCreated = useCallback((plan: SessionPlan) => {
    setActivePlan(plan);
    invalidateActiveCache();
    invalidateAppBootstrapCache();
  }, []);

  useEffect(() => {
    if (activeFetchedRef.current) return;
    activeFetchedRef.current = true;

    let hydratedFromCache = false;
    const cachedBootstrap = getAppBootstrapCacheSnapshot();
    if (cachedBootstrap) {
      applyBootstrapState(cachedBootstrap);
      hydratedFromCache = true;
    }

    const cached = getCache<ActiveSessionLiteResponse>('home.activeLite')
      ?? getCache<{ activeLite: ActiveSessionLiteResponse }>('home.bootstrap')?.activeLite;
    if (!hydratedFromCache && cached?.progress) {
      applyActiveLiteState(cached);
      hydratedFromCache = true;
    }

    if (hydratedFromCache) {
      setLoading(false);
      setError(null);
      if (!isAppBooted()) setAppBooted();
    }

    const t0 = performance.now();
    let cancelled = false;
    (async () => {
      const token = await getAuthToken();
      if (!token || cancelled) {
        if (!cancelled && !hydratedFromCache) setLoading(false);
        return;
      }
      try {
        const result = hydratedFromCache
          ? await revalidateAppBootstrap(token, { debug: debugFlag })
          : await getCachedAppBootstrap(token, { debug: debugFlag });
        if (cancelled) return;
        const elapsed = Math.round(performance.now() - t0);
        if (typeof performance !== 'undefined' && performance.mark) {
          performance.mark('home_active_loaded');
        }
        if (process.env.NODE_ENV !== 'production') {
          console.info('[perf] home_active_loaded', elapsed, 'ms');
        }
        if (!result.ok) {
          if (!hydratedFromCache) {
            if (result.status === 401) {
              setError('세션을 확인해 주세요');
            } else {
              setError(result.error?.message ?? '세션을 확인해 주세요');
            }
          }
          return;
        }
        setError(null);
        applyBootstrapState(result.data);
      } catch (err) {
        if (!cancelled && !hydratedFromCache) {
          setError(err instanceof Error ? err.message : '세션을 확인해 주세요');
        }
      } finally {
        if (!cancelled) {
          if (!hydratedFromCache) {
            setLoading(false);
          }
          if (!isAppBooted()) setAppBooted();
        }
      }
    })();
    return () => {
      cancelled = true;
      activeFetchedRef.current = false; // allow remount (e.g. Strict Mode) to refetch
    };
  }, [applyActiveLiteState, applyBootstrapState, debugFlag, getAuthToken]);

  useEffect(() => {
    setSkipLoader(isAppBooted());
  }, []);

  /** PR-RESET-09: Re-check on visibility restore (multi-tab safety). */
  const [recheckTrigger, setRecheckTrigger] = useState(0);
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') setRecheckTrigger((n) => n + 1);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  /** PR-PERF-21: Bootstrap-driven reset-map. Recheck uses getLatest for multi-tab safety. */
  useEffect(() => {
    if (!mapV2 || loading || isRailNotReady) return;
    if (!isVisible) return;

    const bootstrap = getAppBootstrapCacheSnapshot();
    const hasBootstrapResetMap = bootstrap?.reset_map != null;
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (recheckTrigger === 0 && hasBootstrapResetMap) {
      const rm = bootstrap!.reset_map!;
      if (rm.active_flow && rm.active_flow.state === 'started') {
        setResetMapFlowId(rm.active_flow.id);
        setResetMapClientState({
          flow_id: rm.active_flow.id,
          start_key: getIdempotencyKey('start'),
          updated_at: Date.now(),
        });
        return;
      }
      if (rm.should_start) {
        const runStart = () => {
          if (cancelled) return;
          getAuthToken().then(async (token) => {
            if (cancelled || !token) return;
            clearResetMapClientState();
            clearAllKeysForNewFlow();
            const startKey = getIdempotencyKey('start');
            const startRes = await startResetMapFlow(token, startKey);
            if (cancelled) return;
            if (startRes.ok && startRes.data) {
              setResetMapFlowId(startRes.data.flow_id);
              setResetMapClientState({
                flow_id: startRes.data.flow_id,
                start_key: startKey,
                updated_at: Date.now(),
              });
            }
          });
        };
        if (typeof requestIdleCallback !== 'undefined') {
          idleId = requestIdleCallback(runStart, { timeout: 500 }) as unknown as number;
        } else {
          timeoutId = setTimeout(runStart, 0);
        }
        return () => {
          cancelled = true;
          if (idleId !== null && typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(idleId);
          }
          if (timeoutId !== null) clearTimeout(timeoutId);
        };
      }
    }

    (async () => {
      const token = await getAuthToken();
      if (!token || cancelled) return;

      const local = getResetMapClientState();
      const latestRes = await getLatestResetMapFlow(token);
      if (cancelled) return;

      const latestFlow =
        latestRes.ok && latestRes.data?.flow
          ? { id: latestRes.data.flow.id, state: latestRes.data.flow.state }
          : null;
      const result = reconcileResetMapClientState(latestFlow, local);

      if (result.action === 'repair' && latestFlow?.state === 'started') {
        setResetMapFlowId(result.flow_id);
        if (result.clearApplyKey) clearApplyKey();
        setResetMapClientState({
          flow_id: result.flow_id,
          start_key: local?.start_key ?? getIdempotencyKey('start'),
          updated_at: Date.now(),
        });
        return;
      }

      if (result.action === 'none' && latestFlow?.state === 'started') {
        setResetMapFlowId(result.flow_id);
        return;
      }

      clearResetMapClientState();
      clearAllKeysForNewFlow();
      const startKey = getIdempotencyKey('start');
      const startRes = await startResetMapFlow(token, startKey);
      if (cancelled) return;

      if (startRes.ok && startRes.data) {
        setResetMapFlowId(startRes.data.flow_id);
        setResetMapClientState({
          flow_id: startRes.data.flow_id,
          start_key: startKey,
          updated_at: Date.now(),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [mapV2, loading, getAuthToken, recheckTrigger, isRailNotReady, isVisible]);

  /** 레일 미준비 플레이스홀더: readiness 1회로 CTA 경로 결정 */
  useEffect(() => {
    if (!isVisible) return;
    if (!isRailNotReady) {
      railRecoveryFetchedRef.current = false;
      setRailRecoveryHref('/onboarding');
      return;
    }
    if (loading || error) return;
    if (railRecoveryFetchedRef.current) return;
    railRecoveryFetchedRef.current = true;
    let cancelled = false;
    void (async () => {
      const readiness = await fetchReadinessClient();
      if (cancelled) return;
      const code = readiness?.next_action?.code;
      setRailRecoveryHref(hrefForReadinessNext(code));
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, error, isRailNotReady, isVisible]);

  const handleFlowApplied = useCallback(() => {
    clearResetMapClientState();
    clearAllKeysForNewFlow();
    setResetMapFlowId(null);
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

  const total = totalSessionsOverride ?? sessionProgress?.total_sessions ?? 8;
  const completed = completedSessionsOverride ?? sessionProgress?.completed_sessions ?? 0;
  /** donor 지도 기본 승격: mapV2 + total<=20 시 donor theme (presentation=donor, behavior=production) */
  const useDonorTheme = mapV2 && total <= 20 && !isRailNotReady;

  return (
    <div
      className={`min-h-screen pb-20 ${useDonorTheme ? '' : 'bg-[#f8f6f0]'}`}
      style={useDonorTheme ? { backgroundColor: 'oklch(0.22 0.03 245)' } : undefined}
    >
      {/* 1. Header — donor theme 시 숨김 (지도 카드 헤더에 통합) */}
      {!useDonorTheme && (
        <header className="px-4 pt-6 pb-4">
          <h1 className="text-4xl font-bold text-orange-500">Move Re</h1>
          <p className="mt-2 text-base text-slate-800">
            당신의, 당신에 의한, 당신을 위한 여정
          </p>
        </header>
      )}

      <main className={`px-4 ${useDonorTheme ? 'pt-4 space-y-4' : 'space-y-6'}`}>
        {/* PR-UX-16a: home 상단 대형 preview 제거 — Reset Map first-view */}
        <div>
        {(() => {
          if (isRailNotReady) {
            return (
              <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <h3 className="text-sm font-semibold text-slate-800">
                  아직 실행 준비가 끝나지 않았어요
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  분석 결과와 주간 횟수 설정을 완료하면 리셋 지도가 열립니다.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(railRecoveryHref)}
                  className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                >
                  이어가기
                </button>
              </section>
            );
          }

          if (mapV2 && total <= 20) {
            const focusSession = searchParams.get('focusSession');
            const focusSessionNum = focusSession ? parseInt(focusSession, 10) : null;
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
                onFlowApplied={handleFlowApplied}
                resetMapFlowId={resetMapFlowId}
                adaptiveExplanation={adaptiveExplanation}
                nextSession={nextSession}
                initialNodeDisplayBundle={nodeDisplayBundle}
                isVisible={isVisible}
                initialSelectedSessionId={
                  focusSessionNum != null && focusSessionNum >= 1 && focusSessionNum <= total
                    ? focusSessionNum
                    : null
                }
                debug={debugFlag}
                mapRenderer={DonorResetMap}
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

        {/* PR-P2-2: 4세션 변화 리포트 foundation — donor theme·가짜 레일 시 숨김 */}
        {!useDonorTheme && !isRailNotReady && (
          <ProgressReportCard getAuthToken={getAuthToken} initialPreview={statsPreview} />
        )}
      </main>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
