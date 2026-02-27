'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  Check,
  Play,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRoutineStatus } from '@/features/routine/hooks/useRoutineStatus';
import BottomNav from '../_components/BottomNav';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type DayStatus = 'done' | 'active' | 'upcoming';

function getDayStatus(
  day: number,
  currentDay: number,
  isCompleted: boolean
): DayStatus {
  if (isCompleted || day < currentDay) return 'done';
  if (day === currentDay) return 'active';
  return 'upcoming';
}

export default function ResetHomePage() {
  const router = useRouter();
  const { state, countdown, restRecommended, loading, error, todayCompletedForDay } =
    useRoutineStatus();
  const currentDay = state?.currentDay ?? 1;
  const isCompleted = state?.status === 'COMPLETED';
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const renderState =
    isCompleted
      ? 'COMPLETED'
      : todayCompletedForDay
        ? 'TODAY_COMPLETED'
        : restRecommended
          ? 'REST_RECOMMENDED'
          : state?.status === 'READY'
            ? 'READY'
            : 'ACTIVE';
  useEffect(() => {
    if (!loading && !error) {
      console.log('[HOME_RENDER_STATE]', renderState);
    }
  }, [loading, error, renderState]);

  const requestInFlightRef = useRef(false);

  const handleStartClick = async (day: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[HOME_NO_SESSION]');
      router.push(`/app/auth?next=${encodeURIComponent('/app/home')}`);
      return;
    }

    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsStarting(true);
    setStartError(null);

    const opts: RequestInit = {
      cache: 'no-store' as RequestCache,
      headers: { Authorization: `Bearer ${session.access_token}` },
    };

    try {
      const routineRes = await fetch('/api/workout-routine/get', opts);
      if (!routineRes.ok) {
        const body = await routineRes.json().catch(() => ({}));
        console.warn('[HOME_ROUTINE_FAIL]', { status: routineRes.status, error: body.error });
        setStartError(body?.error ?? '루틴을 불러오지 못했습니다.');
        return;
      }
      const routineData = await routineRes.json();
      const routineId = routineData?.routine?.id;
      if (!routineId) {
        console.warn('[HOME_ROUTINE_FAIL]', { error: 'No routineId' });
        setStartError('루틴을 찾을 수 없습니다.');
        return;
      }

      const ensureRes = await fetch('/api/routine-plan/ensure', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          ...(opts.headers as Record<string, string>),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ routineId, dayNumber: day }),
      });
      const ensureData = await ensureRes.json().catch(() => ({}));
      const plan = ensureData?.plan;

      if (!ensureRes.ok) {
        setStartError(ensureData?.error ?? '플랜 조회/생성에 실패했습니다.');
        return;
      }
      if (!plan?.selected_template_ids?.length) {
        setStartError(ensureData?.error ?? '플랜을 불러올 수 없습니다.');
        return;
      }

      const activateRes = await fetch('/api/routine-engine/activate', {
        method: 'POST',
        ...opts,
      });
      if (!activateRes.ok) {
        const body = await activateRes.json().catch(() => ({}));
        console.warn('[HOME_ACTIVATE_FAIL]', { message: body.error });
        return;
      }
      router.push(`/app/routine/player?routineId=${routineId}&day=${day}`);
    } catch (err) {
      console.warn('[HOME_START_FAIL]', {
        message: err instanceof Error ? err.message : String(err),
      });
      setStartError(err instanceof Error ? err.message : '시작에 실패했습니다.');
    } finally {
      requestInFlightRef.current = false;
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      {/* 1. Header Area */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-500">
            7-DAY RESET
          </span>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full text-slate-800 hover:bg-white/60"
            aria-label="필터"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2} />
          </button>
        </div>
        <h1 className="mt-2 text-4xl font-bold text-slate-800">Routine</h1>
        <p className="mt-2 text-base text-slate-800">
          김지수님, 오늘은 골반의 균형을 맞출 시간입니다.
        </p>
      </header>

      <main className="px-4 space-y-6">
        {/* 2. Day Selector (7일 여정, 가로 스크롤) */}
        <section>
          {loading ? (
            <DaySelectorSkeleton />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {DAYS.map((day) => (
                <DayPill
                  key={day}
                  day={day}
                  status={getDayStatus(day, currentDay, isCompleted)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 3. XP Progress Card */}
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              28일 완주 지도
            </span>
            <span className="text-sm font-bold text-slate-800">28% XP</span>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-300">
            <div className="h-full w-[28%] rounded-full bg-orange-400 transition-all" />
          </div>
          <p className="mt-2 text-xs font-medium text-orange-500">
            2주 차: 흉추 가동성
          </p>
        </section>

        {/* 4. Main CTA (상태별 동적 렌더링) */}
        <section>
          {startError && (
            <div className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
              <p className="text-sm text-red-700 mb-3">{startError}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartError(null);
                    handleStartClick(currentDay);
                  }}
                  className="rounded-full border-2 border-slate-900 bg-orange-400 px-4 py-2 text-sm font-bold text-white"
                >
                  다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => setStartError(null)}
                  className="text-sm font-medium text-red-700 underline"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <CtaSkeleton />
          ) : error ? (
            <div className="rounded-full border-2 border-red-300 bg-red-50 px-6 py-5 text-center text-sm text-red-700">
              {error}
            </div>
          ) : (
            <MainCta
              status={state?.status ?? 'READY'}
              currentDay={currentDay}
              countdown={countdown}
              restRecommended={restRecommended}
              todayCompletedForDay={todayCompletedForDay}
              onStartClick={handleStartClick}
              isStarting={isStarting}
            />
          )}
          {!loading && !error && (
            <p className="mt-2 text-center text-sm text-stone-400">
              12 MIN • FULL BODY
            </p>
          )}
        </section>

        {/* 5. Body Status Summary */}
        <section className="rounded-2xl bg-slate-100/50 p-5">
          <h3 className="text-sm font-semibold text-slate-800">
            내 몸의 상태 요약
          </h3>
          <div className="mt-3 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" strokeWidth={2} />
            <p className="text-sm text-slate-800">
              핵심 불균형: 오른쪽 어깨 타이트함
            </p>
          </div>
          <div className="mt-4">
            <span className="inline-block rounded-lg border border-slate-300 bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-800">
              이번 주 집중 타겟: 상체 후면 사슬
            </span>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

type MainCtaProps = {
  status: string;
  currentDay: number;
  countdown: string | null;
  restRecommended: boolean;
  todayCompletedForDay: boolean;
  onStartClick: (day: number) => void;
  isStarting: boolean;
};

function MainCta({
  status,
  currentDay,
  countdown,
  restRecommended,
  todayCompletedForDay,
  onStartClick,
  isStarting,
}: MainCtaProps) {
  const isCompleted = status === 'COMPLETED';

  if (isCompleted) {
    return (
      <Link
        href="/app/report/day7"
        className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-700">
          <Check className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <span className="flex-1 text-left text-lg font-bold text-white">
          7일 여정 완료 🎉 리포트 보기
        </span>
        <ArrowRight className="size-5 text-white" strokeWidth={2.5} />
      </Link>
    );
  }

  if (todayCompletedForDay) {
    return (
      <div
        className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-slate-200 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] cursor-not-allowed opacity-90"
        role="status"
        aria-label="오늘 완료"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-500">
          <Check className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <span className="flex-1 text-left text-lg font-bold text-slate-700">
          오늘 완료 ✅
        </span>
      </div>
    );
  }

  if (restRecommended) {
    return (
      <button
        type="button"
        onClick={() => onStartClick(currentDay)}
        disabled={isStarting}
        className="flex w-full gap-4 rounded-full border-2 border-slate-900 bg-amber-50 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-200">
          <Play className="size-6 text-amber-800" fill="currentColor" strokeWidth={0} />
        </div>
        <span className="flex-1 text-left">
          <span className="block text-lg font-bold text-slate-800">
            Day {currentDay} 리셋 시작하기
          </span>
          <span className="block text-sm font-medium text-amber-700">
            휴식 권장 ⏳ {countdown ?? '00:00:00'} 후 권장
          </span>
        </span>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-400">
          <ArrowRight className="size-5 text-white" strokeWidth={2.5} />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onStartClick(currentDay)}
      disabled={isStarting}
      className="flex w-full items-center gap-4 rounded-full border-2 border-slate-900 bg-white px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-800">
        <Play className="size-6 text-white" fill="currentColor" strokeWidth={0} />
      </div>
      <span className="flex-1 text-left text-lg font-bold text-slate-800">
        {isStarting ? '루틴 준비 중...' : `Day ${currentDay} 리셋 시작하기`}
      </span>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-400">
        <ArrowRight className="size-5 text-white" strokeWidth={2.5} />
      </div>
    </button>
  );
}

function DaySelectorSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
      {DAYS.map((day) => (
        <div
          key={day}
          className="flex shrink-0 flex-col items-center gap-1"
          aria-hidden
        >
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-stone-200" />
          <div className="h-3 w-12 animate-pulse rounded bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

function CtaSkeleton() {
  return (
    <div
      className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-white px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
      aria-hidden
    >
      <div className="size-12 shrink-0 animate-pulse rounded-full bg-stone-200" />
      <div className="h-6 flex-1 animate-pulse rounded bg-stone-200" />
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-stone-200" />
    </div>
  );
}

function DayPill({ day, status }: { day: number; status: DayStatus }) {
  const dayStr = String(day).padStart(2, '0');

  if (status === 'done') {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800">
          <Check className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xs font-medium text-slate-800">DAY {day}</span>
      </div>
    );
  }

  if (status === 'active') {
    return (
      <div className="flex shrink-0 flex-col items-center gap-1">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-800 bg-white">
          <span className="text-xl font-bold text-slate-800">{dayStr}</span>
        </div>
        <span className="text-xs font-bold text-orange-500 underline decoration-orange-500 underline-offset-2">
          DAY {day}
        </span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 bg-white">
        <span className="text-xl font-bold text-stone-400">{dayStr}</span>
      </div>
      <span className="text-xs font-medium text-stone-400">DAY {day}</span>
    </div>
  );
}
