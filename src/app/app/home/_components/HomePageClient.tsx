'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, ArrowRight, FlaskConical } from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import { getActiveSession } from '@/lib/session/client';
import BottomNav from '../../_components/BottomNav';
import JourneyMap from './JourneyMap';

export default function HomePageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debugFlag = searchParams.get('debug') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<{
    total_sessions: number;
    completed_sessions: number;
  } | null>(null);

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
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f6f0] pb-20">
        <header className="px-4 pt-6 pb-4">
          <span className="text-sm font-semibold text-orange-500">Routine</span>
          <h1 className="mt-2 text-4xl font-bold text-slate-800">Routine</h1>
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
          <h1 className="text-4xl font-bold text-slate-800">Routine</h1>
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-500">Routine</span>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full text-slate-800 hover:bg-white/60"
            aria-label="설정"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2} />
          </button>
        </div>
        <h1 className="mt-2 text-4xl font-bold text-slate-800">Routine</h1>
        <p className="mt-2 text-base text-slate-800">
          오늘처럼, 내일은 정확의 상태를 스스로 점검하세요.
        </p>
      </header>

      <main className="px-4 space-y-6">
        {/* 2. 여정도 — session progress 기반 */}
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <h3 className="text-sm font-semibold text-slate-800">현재 여정도</h3>
          {sessionProgress ? (
            <div className="mt-3">
              <JourneyMap
                total={sessionProgress.total_sessions}
                completed={sessionProgress.completed_sessions}
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              루틴 탭에서 세션을 시작하고 진행도를 확인하세요.
            </p>
          )}
        </section>

        {/* 3. 나의 상태 요약 — Deep 미완료 시 CTA만 */}
        <section className="rounded-2xl bg-slate-100/50 p-5">
          <h3 className="text-sm font-semibold text-slate-800">나의 상태 요약</h3>
          <p className="mt-2 text-sm text-slate-800">
            심층 테스트를 완료하면 맞춤 루틴이 시작됩니다.
          </p>
          <div className="mt-4">
            <Link
              href="/app/deep-test"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white/80 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white transition"
            >
              <FlaskConical className="size-4" strokeWidth={2} />
              심층 테스트 하러가기
            </Link>
          </div>
        </section>

        {/* 4. 단일 CTA */}
        <section>
          <Link
            href="/app/routine"
            className="flex w-full items-center justify-between gap-4 rounded-full border-2 border-slate-900 bg-orange-400 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
          >
            <span className="text-lg font-bold text-white">루틴으로 이동</span>
            <ArrowRight className="size-5 shrink-0 text-white" strokeWidth={2.5} />
          </Link>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
