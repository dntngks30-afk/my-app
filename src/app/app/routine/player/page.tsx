'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

/** 세그먼트 shape (템플릿/DB 연결 확장용) */
type Segment = {
  id: string;
  title: string;
  durationSec: number;
  kind: 'work' | 'rest';
};

/** 15분 = 900초: work 60s × 10 + rest 30s × 10 */
const DEFAULT_SEGMENTS: Segment[] = (() => {
  const out: Segment[] = [];
  for (let i = 0; i < 10; i++) {
    out.push({
      id: `work-${i + 1}`,
      title: `운동 ${i + 1}`,
      durationSec: 60,
      kind: 'work',
    });
    out.push({
      id: `rest-${i + 1}`,
      title: `휴식 ${i + 1}`,
      durationSec: 30,
      kind: 'rest',
    });
  }
  return out;
})();

const TOTAL_DURATION_MS =
  DEFAULT_SEGMENTS.reduce((acc, s) => acc + s.durationSec, 0) * 1000;

type PlayerStatus = 'idle' | 'running' | 'paused' | 'done';

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RoutinePlayerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dayNumber = Math.max(
    1,
    Math.min(7, parseInt(searchParams.get('day') ?? '1', 10) || 1)
  );

  const segments = DEFAULT_SEGMENTS;
  const segmentCount = segments.length;

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [startedAtUtcMs, setStartedAtUtcMs] = useState<number | null>(null);
  const [pausedAccumulatedMs, setPausedAccumulatedMs] = useState(0);
  const [pauseStartedPerfMs, setPauseStartedPerfMs] = useState<number | null>(
    null
  );
  const [serverNowUtcAtSyncMs, setServerNowUtcAtSyncMs] = useState<
    number | null
  >(null);
  const [perfNowAtSyncMs, setPerfNowAtSyncMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const completeRequestedRef = useRef(false);
  const lastTransitionKeyRef = useRef<string>('');

  const initSyncDone = useRef(false);
  const statusLoading = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (statusLoading.current) return;
    statusLoading.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch('/api/routine-engine/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json;
    } finally {
      statusLoading.current = false;
    }
  }, []);

  useEffect(() => {
    if (initSyncDone.current) return;
    initSyncDone.current = true;
    console.log('[player] init', {
      dayNumber,
      segmentCount,
      totalSec: TOTAL_DURATION_MS / 1000,
    });
    fetchStatus().then((data) => {
      if (data?.server_now_utc) {
        console.log('[player] init-sync', { server_now_utc: data.server_now_utc });
        const ms = new Date(data.server_now_utc).getTime();
        setServerNowUtcAtSyncMs(ms);
        setPerfNowAtSyncMs(performance.now());
      }
    });
  }, [dayNumber, segmentCount, fetchStatus]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      console.warn('[player] visibility sync', { visible: true });
      fetchStatus().then((data) => {
        if (data?.server_now_utc) {
          const newServerMs = new Date(data.server_now_utc).getTime();
          const newPerfMs = performance.now();
          if (serverNowUtcAtSyncMs !== null && status === 'running') {
            const expectedElapsed =
              newServerMs - (startedAtUtcMs ?? 0) - pausedAccumulatedMs;
            const perfElapsed = newPerfMs - (perfNowAtSyncMs ?? newPerfMs);
            const driftMs = Math.abs(
              (newServerMs - serverNowUtcAtSyncMs) -
                (newPerfMs - (perfNowAtSyncMs ?? newPerfMs))
            );
            if (driftMs > 500) {
              console.warn('[player] drift corrected', { driftMs });
            }
          }
          setServerNowUtcAtSyncMs(newServerMs);
          setPerfNowAtSyncMs(newPerfMs);
        }
      });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [
    fetchStatus,
    serverNowUtcAtSyncMs,
    perfNowAtSyncMs,
    status,
    startedAtUtcMs,
    pausedAccumulatedMs,
  ]);

  const elapsedMs = useMemo(() => {
    if (status === 'idle' || startedAtUtcMs === null) return 0;
    if (status === 'done') return TOTAL_DURATION_MS;
    const serverElapsedAtSync = serverNowUtcAtSyncMs
      ? serverNowUtcAtSyncMs - startedAtUtcMs
      : 0;
    const perfRef = perfNowAtSyncMs ?? performance.now();
    if (status === 'paused') {
      const perfDelta =
        pauseStartedPerfMs !== null ? pauseStartedPerfMs - perfRef : 0;
      return Math.max(
        0,
        serverElapsedAtSync + perfDelta - pausedAccumulatedMs
      );
    }
    const perfDelta = performance.now() - perfRef;
    return Math.max(
      0,
      serverElapsedAtSync + perfDelta - pausedAccumulatedMs
    );
  }, [
    status,
    startedAtUtcMs,
    pausedAccumulatedMs,
    serverNowUtcAtSyncMs,
    perfNowAtSyncMs,
    pauseStartedPerfMs,
    tick,
  ]);

  const totalRemainingMs = Math.max(0, TOTAL_DURATION_MS - elapsedMs);
  const totalProgress =
    TOTAL_DURATION_MS > 0
      ? Math.min(1, elapsedMs / TOTAL_DURATION_MS)
      : 0;

  const { derivedIndex, segmentRemainingSec } = useMemo(() => {
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const segEnd = acc + segments[i].durationSec * 1000;
      if (elapsedMs < segEnd) {
        const segmentElapsed = elapsedMs - acc;
        const segmentTotal = segments[i].durationSec * 1000;
        return {
          derivedIndex: i,
          segmentRemainingSec: Math.max(
            0,
            Math.ceil((segmentTotal - segmentElapsed) / 1000)
          ),
        };
      }
      acc = segEnd;
    }
    return {
      derivedIndex: segments.length - 1,
      segmentRemainingSec: 0,
    };
  }, [elapsedMs, segments]);

  const currentSegment = segments[derivedIndex] ?? null;
  const isLastSegment = derivedIndex === segments.length - 1;

  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 400);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (segmentRemainingSec > 0) return;
    const key = `${derivedIndex}-${elapsedMs}`;
    if (lastTransitionKeyRef.current === key) return;
    lastTransitionKeyRef.current = key;

    if (isLastSegment) {
      setStatus('done');
      if (completeRequestedRef.current) return;
      completeRequestedRef.current = true;

      const startedAtUtc =
        startedAtUtcMs !== null ? new Date(startedAtUtcMs).toISOString() : '';
      console.log('[player] complete request', { dayNumber, startedAtUtc });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) {
          console.warn('[player] complete fail', {
            status: 401,
            error: 'No session',
          });
          return;
        }
        fetch('/api/routine-engine/complete-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            dayNumber,
            startedAtUtc,
          }),
          cache: 'no-store',
        })
          .then((res) => {
            if (res.ok) {
              console.log('[player] complete success');
            } else {
              res.json().then((body) =>
                console.warn('[player] complete fail', {
                  status: res.status,
                  error: body?.error ?? 'Unknown',
                })
              );
            }
          })
          .catch((err) =>
            console.warn('[player] complete fail', {
              status: 0,
              error: err?.message ?? String(err),
            })
          );
      });
    } else {
      console.log('[player] transition', {
        fromIndex: derivedIndex,
        toIndex: derivedIndex + 1,
      });
    }
  }, [
    segmentRemainingSec,
    derivedIndex,
    isLastSegment,
    startedAtUtcMs,
    elapsedMs,
    dayNumber,
  ]);

  const handlePlay = useCallback(() => {
    console.log('[player] play');
    fetchStatus().then((data) => {
      if (!data?.server_now_utc) return;
      const serverMs = new Date(data.server_now_utc).getTime();
      console.log('[player] start-sync', {
        startedAtUtc: data.server_now_utc,
        server_now_utc: data.server_now_utc,
      });
      setStartedAtUtcMs(serverMs);
      setServerNowUtcAtSyncMs(serverMs);
      setPerfNowAtSyncMs(performance.now());
      setStatus('running');
    });
  }, [fetchStatus]);

  const handlePause = useCallback(() => {
    console.log('[player] pause', { pausedAccumulatedMs });
    setPauseStartedPerfMs(performance.now());
    setStatus('paused');
  }, [pausedAccumulatedMs]);

  const handleResume = useCallback(() => {
    const now = performance.now();
    const pauseDur = pauseStartedPerfMs !== null ? now - pauseStartedPerfMs : 0;
    const next = pausedAccumulatedMs + pauseDur;
    console.log('[player] resume', { pausedAccumulatedMs: next });
    setPausedAccumulatedMs(next);
    setPauseStartedPerfMs(null);
    setStatus('running');
  }, [pausedAccumulatedMs, pauseStartedPerfMs]);

  if (status === 'done') {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-slate-800">완료!</h1>
          <p className="text-slate-600 mt-2">오늘의 루틴을 마쳤어요.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/app')}
          className="min-h-[44px] px-8 py-4 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5"
        >
          홈으로
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0] pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-2 border-slate-900 bg-[#F8F6F0] px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition hover:opacity-90"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="size-5 text-slate-800" strokeWidth={2.5} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            DAY {dayNumber}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-800">
            15분 루틴
          </h1>
        </div>
        <div className="w-10" />
      </header>

      <main className="px-4 py-6">
        <div className="relative mb-6 overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <div className="h-2 w-full bg-stone-300">
            <div
              className="h-full bg-orange-400 transition-all duration-300"
              style={{ width: `${totalProgress * 100}%` }}
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              전체 남은 시간
            </span>
            <span className="text-xl font-bold text-slate-800 tabular-nums">
              {formatRemaining(totalRemainingMs)}
            </span>
          </div>

          <div className="px-4 pb-6">
            <div className="rounded-2xl border-2 border-slate-900 bg-slate-100 p-8 text-center shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
              {currentSegment && (
                <>
                  <p className="text-sm font-semibold text-slate-600 mb-2">
                    {currentSegment.title}
                  </p>
                  <p className="text-5xl font-bold text-slate-800 tabular-nums">
                    {formatRemaining(segmentRemainingSec * 1000)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          {status === 'idle' && (
            <button
              type="button"
              onClick={handlePlay}
              className="min-h-[44px] px-8 py-3 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
            >
              <Play className="size-5" fill="currentColor" strokeWidth={0} />
              Play
            </button>
          )}
          {status === 'running' && (
            <button
              type="button"
              onClick={handlePause}
              className="min-h-[44px] px-8 py-3 rounded-full border-2 border-slate-900 bg-slate-200 font-bold text-slate-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
            >
              <Pause className="size-5" fill="currentColor" strokeWidth={0} />
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button
              type="button"
              onClick={handleResume}
              className="min-h-[44px] px-8 py-3 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
            >
              <Play className="size-5" fill="currentColor" strokeWidth={0} />
              Resume
            </button>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-2">
            세그먼트
          </h2>
          <ul className="space-y-2">
            {segments.map((seg, idx) => {
              const done = idx < derivedIndex;
              const active = idx === derivedIndex;
              return (
                <li
                  key={seg.id}
                  className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
                    active
                      ? 'border-slate-900 bg-orange-50 shadow-[3px_3px_0_0_rgba(15,23,42,1)]'
                      : done
                        ? 'border-slate-300 bg-stone-100 opacity-60'
                        : 'border-slate-300 bg-white'
                  }`}
                >
                  {done && (
                    <div className="flex size-6 items-center justify-center rounded-full bg-slate-700">
                      <Check className="size-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                  <span
                    className={`font-medium ${
                      done ? 'text-slate-500 line-through' : 'text-slate-800'
                    }`}
                  >
                    {seg.title}
                  </span>
                  <span className="ml-auto text-sm text-slate-600">
                    {seg.durationSec}초
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
