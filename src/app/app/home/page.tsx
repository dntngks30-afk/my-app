'use client';

import Link from 'next/link';
import {
  SlidersHorizontal,
  Check,
  Play,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { useRoutineStatus } from '@/features/routine/hooks/useRoutineStatus';

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
  const { state, countdown, loading, error } = useRoutineStatus();
  const currentDay = state?.currentDay ?? 1;
  const isCompleted = state?.status === 'COMPLETED';

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
    </div>
  );
}

type MainCtaProps = {
  status: string;
  currentDay: number;
  countdown: string | null;
};

function MainCta({ status, currentDay, countdown }: MainCtaProps) {
  const isLocked = status === 'LOCKED';
  const isCompleted = status === 'COMPLETED';

  if (isLocked) {
    return (
      <div
        className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-slate-200 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] cursor-not-allowed opacity-90"
        role="button"
        tabIndex={-1}
        aria-disabled
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-500">
          <Play className="size-6 text-white" fill="currentColor" strokeWidth={0} />
        </div>
        <span className="flex-1 text-left text-lg font-bold text-slate-600">
          휴식 중... ⏳ {countdown ?? '00:00:00'} 후 오픈
        </span>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-slate-800 px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-600 bg-slate-700">
          <Check className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <span className="flex-1 text-left text-lg font-bold text-white">
          7일 여정 완료 🎉
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/app/routine/player?day=${currentDay}`}
      className="flex items-center gap-4 rounded-full border-2 border-slate-900 bg-white px-6 py-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-800">
        <Play className="size-6 text-white" fill="currentColor" strokeWidth={0} />
      </div>
      <span className="flex-1 text-left text-lg font-bold text-slate-800">
        Day {currentDay} 리셋 시작하기
      </span>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-400">
        <ArrowRight className="size-5 text-white" strokeWidth={2.5} />
      </div>
    </Link>
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
