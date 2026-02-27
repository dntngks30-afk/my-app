'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlayCircle, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NeoCard, NeoButton } from '@/components/neobrutalism';
import BottomNav from '../_components/BottomNav';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/routine/list', {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
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
      } catch (e) {
        if (!cancelled) {
          setError('조회 실패');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
          <NeoCard className="p-5">
            <p className="text-sm text-slate-600">불러오는 중...</p>
          </NeoCard>
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
