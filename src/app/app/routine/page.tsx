'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlayCircle, Play } from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import BottomNav from '../_components/BottomNav';

function RoutineListSkeleton() {
  return (
    <>
      <NeoCard className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 rounded bg-stone-200" />
          <div className="h-4 w-1/2 rounded bg-stone-200" />
          <div className="h-10 w-full rounded-full bg-stone-200" />
        </div>
      </NeoCard>
      <section>
        <div className="h-4 w-24 rounded bg-stone-200 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <NeoCard key={i} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-stone-200" />
                </div>
                <div className="size-10 shrink-0 animate-pulse rounded-full bg-stone-200" />
              </div>
            </NeoCard>
          ))}
        </div>
      </section>
    </>
  );
}

type RoutineItem = {
  id: string;
  created_at: string;
  status: string;
  started_at: string | null;
  completedDays: number;
  lastCompletedDay: number;
  nextDay: number;
};

function formatRoutineTitle(r: RoutineItem, index: number): string {
  const d = r.created_at ? new Date(r.created_at) : new Date();
  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  if (r.status === 'completed') return `7-Day Reset #${index + 1} (완료)`;
  if (r.status === 'active') return `7-Day Reset #${index + 1} (진행중)`;
  if (r.status === 'draft') return `7-Day Reset #${index + 1} (대기)`; 
  return `7-Day Reset #${index + 1} (${dateStr})`;
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '대기',
    active: '진행중',
    completed: '완료',
    paused: '일시정지',
    cancelled: '중단',
  };
  return map[status] ?? status;
}

export default function RoutineHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debugFlag = searchParams.get('debug') === '1';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const _t0 = performance.now();
      const { session } = await getSessionSafe();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const url = `/api/routine/list${debugFlag ? '?debug=1' : ''}`;
        const res = await fetch(url, {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const _tResp = performance.now();
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body?.error ?? '조회 실패');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setRoutines(data?.routines ?? []);
        setError(null);
        if (process.env.NODE_ENV === 'development') {
          const _tDone = performance.now();
          console.log('[PERF:routine]', { ttfb: Math.round(_tResp - _t0), server_total: data?.timings?.t_total, render: Math.round(_tDone - _tResp) });
        }
      } catch (e) {
        if (!cancelled) {
          setError('조회 실패');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debugFlag]);

  const latest = routines[0];
  const canContinue = latest && (latest.status === 'active' || latest.status === 'draft' || latest.status === 'completed');

  const handleContinue = () => {
    if (!latest) return;
    const day = latest.nextDay;
    router.push(`/app/routine/player?routineId=${encodeURIComponent(latest.id)}&day=${day}`);
  };

  const handleCardClick = (r: RoutineItem) => {
    const day = r.nextDay;
    router.push(`/app/routine/player?routineId=${encodeURIComponent(r.id)}&day=${day}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-4xl font-bold text-slate-800">루틴</h1>
        <p className="mt-2 text-base text-slate-600">
          나의 7-Day Reset 루틴 목록
        </p>
      </header>

      <main className="px-4 space-y-6">
        {loading ? (
          <RoutineListSkeleton />
        ) : error ? (
          <NeoCard className="p-5">
            <p className="text-sm text-red-600">{error}</p>
          </NeoCard>
        ) : routines.length === 0 ? (
          <NeoCard className="p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">루틴이 없습니다</h2>
            <p className="text-sm text-slate-600 mb-4">
              운동 검사 후 홈에서 7-Day Reset을 시작해 보세요.
            </p>
            <NeoButton
              variant="orange"
              onClick={() => router.push('/app/home')}
              className="py-3 px-4"
            >
              홈으로 이동
            </NeoButton>
          </NeoCard>
        ) : (
          <>
            {canContinue && (
              <NeoCard className="p-5">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">최신 루틴 이어하기</h2>
                <p className="text-sm text-slate-600 mb-4">
                  {formatRoutineTitle(latest!, 0)} • Day {latest!.nextDay}/7
                </p>
                <NeoButton
                  variant="orange"
                  fullWidth
                  onClick={handleContinue}
                  className="py-3 flex items-center justify-center gap-2"
                >
                  <Play className="size-5" fill="currentColor" strokeWidth={0} />
                  이어하기
                </NeoButton>
              </NeoCard>
            )}

            <section>
              <h2 className="text-sm font-semibold text-slate-800 mb-3">내 루틴 목록</h2>
              <div className="space-y-3">
                {routines.map((r, idx) => (
                  <NeoCard
                    key={r.id}
                    className="p-4 cursor-pointer hover:opacity-95 transition"
                    onClick={() => handleCardClick(r)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate">
                          {formatRoutineTitle(r, idx)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.completedDays}/7 완료 • {getStatusLabel(r.status)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(r);
                        }}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 bg-orange-400 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
                        aria-label="이 루틴 열기"
                      >
                        <PlayCircle className="size-5" fill="currentColor" strokeWidth={0} />
                      </button>
                    </div>
                  </NeoCard>
                ))}
              </div>
            </section>
          </>
        )}

        {reason === 'missing_params' && (
          <p className="text-xs text-slate-500 text-center">
            루틴 정보가 필요합니다. 위 목록에서 루틴을 선택해 주세요.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
