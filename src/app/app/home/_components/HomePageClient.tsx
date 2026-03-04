'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import { getActiveSession, type SessionPlan } from '@/lib/session/client';
import BottomNav from '../../_components/BottomNav';
import ResetMapCard from './ResetMapCard';
import { ResetMapV2 } from './reset-map-v2/ResetMapV2';

export default function HomePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debugFlag = searchParams.get('debug') === '1';
  const debugMap = searchParams.get('debugMap') === '1';
  const prod = process.env.NODE_ENV === 'production';
  const navV2 = searchParams.get('navV2') === '1';
  const mapV2 = prod ? true : (searchParams.get('mapV2') === '1' || navV2);
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

  const handleSessionCompleted = useCallback((completedSessions: number) => {
    setSessionProgress(prev =>
      prev ? { ...prev, completed_sessions: completedSessions } : prev
    );
    // active plan은 완료됐으므로 null 처리
    setActivePlan(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const url = `/api/home/dashboard${debugFlag ? '?debug=1' : ''}`;
        const res = await fetch(url, {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? '세션을 확인해 주세요');
          setLoading(false);
          return;
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '세션을 확인해 주세요');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debugFlag]);

  useEffect(() => {
    if (pathname !== '/app/home') return;
    let cancelled = false;
    (async () => {
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) return;
      const result = await getActiveSession(session.access_token);
      if (cancelled) return;
      if (result.ok && result.data.progress) {
        const p = result.data.progress;
        setSessionProgress({
          total_sessions: p.total_sessions,
          completed_sessions: p.completed_sessions ?? 0,
        });
        setActivePlan(result.data.active ?? null);
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
            return <ResetMapV2 total={total} completed={completed} activePlan={activePlan} onSessionCompleted={handleSessionCompleted} />;
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
