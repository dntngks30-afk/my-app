'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SlidersHorizontal,
  Check,
  Play,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { getSessionSafe } from '@/lib/supabase';
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

function formatCountdown(lockUntilUtc: string, serverNowUtc: string, clientElapsedMs: number): string {
  const lockMs = new Date(lockUntilUtc).getTime();
  const serverMs = new Date(serverNowUtc).getTime();
  const remainingMs = Math.max(0, lockMs - (serverMs + clientElapsedMs));
  const totalSeconds = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function ResetHomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debugFlag = searchParams.get('debug') === '1';

  const [state, setState] = useState<{ currentDay: number; status: string } | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [restRecommended, setRestRecommended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCompletedForDay, setTodayCompletedForDay] = useState(false);
  const [latestRoutineId, setLatestRoutineId] = useState<string | null>(null);
  const [serverNowUtc, setServerNowUtc] = useState<string | null>(null);
  const [lockUntilUtc, setLockUntilUtc] = useState<string | null>(null);
  const fetchTimeRef = useRef(0);

  const currentDay = state?.currentDay ?? 1;
  const isCompleted = state?.status === 'COMPLETED';
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const _t0 = performance.now();
      const { session } = await getSessionSafe();
      if (!session?.access_token || cancelled) return;
      try {
        const url = `/api/home/dashboard${debugFlag ? '?debug=1' : ''}`;
        const res = await fetch(url, {
          cache: 'no-store' as RequestCache,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const _tResp = performance.now();
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? '대시보드 조회 실패');
          setLoading(false);
          return;
        }
        const s = data.state;
        setState(s ? { currentDay: s.currentDay, status: s.status } : null);
        setTodayCompletedForDay(data.todayCompletedForDay === true);
        setRestRecommended(data.rest_recommended === true);
        setLatestRoutineId(data.routine?.latestRoutineId ?? null);
        setServerNowUtc(data.server_now_utc ?? null);
        setLockUntilUtc(data.lock_until_utc ?? null);
        fetchTimeRef.current = Date.now();

        if (data.rest_recommended && data.lock_until_utc && data.server_now_utc) {
          setCountdown(formatCountdown(data.lock_until_utc, data.server_now_utc, 0));
        } else if (data.rest_recommended && s?.lastActivatedAt) {
          const MS_24H = 24 * 60 * 60 * 1000;
          const unlockAt = new Date(s.lastActivatedAt).getTime() + MS_24H;
          const remainingMs = Math.max(0, unlockAt - Date.now());
          const totalSeconds = Math.floor(remainingMs / 1000);
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const sec = totalSeconds % 60;
          setCountdown([h, m, sec].map((n) => String(n).padStart(2, '0')).join(':'));
        } else {
          setCountdown(null);
        }
        setError(null);
        if (process.env.NODE_ENV === 'development') {
          const _tDone = performance.now();
          console.log('[PERF:home]', { ttfb: Math.round(_tResp - _t0), render: Math.round(_tDone - _tResp), server: data?.timings?.t_total });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '대시보드 조회 실패');
          setState(null);
          setCountdown(null);
          setRestRecommended(false);
          setTodayCompletedForDay(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debugFlag]);

  useEffect(() => {
    if (state?.status !== 'LOCKED') return;
    if (!lockUntilUtc || !serverNowUtc) return;
    const update = () => {
      const clientElapsedMs = Date.now() - fetchTimeRef.current;
      setCountdown(formatCountdown(lockUntilUtc, serverNowUtc, clientElapsedMs));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [state?.status, lockUntilUtc, serverNowUtc]);

  const handleDayPillClick = (day: number) => {
    if (latestRoutineId) {
      router.push(`/app/routine/player?routineId=${encodeURIComponent(latestRoutineId)}&day=${day}`);
    } else {
      router.push('/app/routine');
    }
  };

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
  const requestInFlightRef = useRef(false);

  const handleStartClick = async (day: number) => {
    const { session } = await getSessionSafe();
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
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      const res = await fetch('/api/routine-engine/start-day', {
        method: 'POST',
        ...opts,
        body: JSON.stringify({ dayNumber: day }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStartError(data?.error ?? '시작에 실패했습니다.');
        return;
      }
      const routineId = data?.routineId;
      if (!routineId) {
        setStartError('루틴 정보를 받지 못했습니다.');
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
                  restRecommended={day >= 2 && restRecommended}
                  onClick={() => handleDayPillClick(day)}
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

function DayPill({
  day,
  status,
  restRecommended,
  onClick,
}: {
  day: number;
  status: DayStatus;
  restRecommended?: boolean;
  onClick: () => void;
}) {
  const dayStr = String(day).padStart(2, '0');
  const isUpcoming = status === 'upcoming';
  const showRestBadge = isUpcoming && restRecommended;

  const baseClass = 'flex shrink-0 flex-col items-center gap-1 cursor-pointer transition hover:opacity-90 active:opacity-80';

  if (status === 'done') {
    return (
      <button type="button" onClick={onClick} className={baseClass} aria-label={`Day ${day} 보기`}>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-800">
          <Check className="size-6 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xs font-medium text-slate-800">DAY {day}</span>
      </button>
    );
  }

  if (status === 'active') {
    return (
      <button type="button" onClick={onClick} className={baseClass} aria-label={`Day ${day} 진입`}>
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-800 bg-white">
          <span className="text-xl font-bold text-slate-800">{dayStr}</span>
        </div>
        <span className="text-xs font-bold text-orange-500 underline decoration-orange-500 underline-offset-2">
          DAY {day}
        </span>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass} aria-label={`Day ${day} 진입`}>
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 bg-white">
        <span className="text-xl font-bold text-stone-400">{dayStr}</span>
      </div>
      <span className="text-xs font-medium text-stone-400">
        DAY {day}
        {showRestBadge && (
          <span className="ml-0.5 text-amber-600" title="휴식 권장"> · 휴식 권장</span>
        )}
      </span>
    </button>
  );
}
