'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Check, Lock } from 'lucide-react';
import Hls from 'hls.js';
import { supabase } from '@/lib/supabase';

/** media_payload shape (API response) */
type MediaPayload = {
  kind: 'embed' | 'hls' | 'placeholder';
  provider?: string;
  streamUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  durationSec?: number;
  autoplayAllowed: boolean;
  notes?: string[];
};

/** 세그먼트 shape (템플릿/DB 연결) */
type Segment = {
  id: string;
  templateId?: string;
  title: string;
  durationSec: number;
  kind: 'work' | 'rest';
  mediaPayload?: MediaPayload | null;
  mediaError?: boolean;
  templateName?: string;
};

/** plan 없는 경우 fallback 세그먼트 */
const FALLBACK_SEGMENTS: Segment[] = (() => {
  const out: Segment[] = [];
  for (let i = 0; i < 3; i++) {
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

type PlayerStatus = 'idle' | 'running' | 'paused' | 'done';

function MediaPlayer({
  segment,
  isActive,
}: {
  segment: Segment;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const payload = segment.mediaPayload;
    if (!video || !payload || segment.mediaError) return;

    if (payload.kind === 'hls' && payload.streamUrl) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(payload.streamUrl);
        hls.attachMedia(video);
        return () => {
          hls.destroy();
          hlsRef.current = null;
        };
      }
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = payload.streamUrl;
        return () => { video.src = ''; };
      }
    }
  }, [segment.id, segment.mediaPayload?.streamUrl, segment.mediaError]);

  if (segment.mediaError) {
    return (
      <div className="aspect-video w-full bg-slate-200 flex items-center justify-center p-6">
        <p className="text-sm text-slate-600 text-center">
          영상을 불러올 수 없습니다. 텍스트 가이드를 참고해 주세요.
        </p>
      </div>
    );
  }
  if (!segment.mediaPayload) {
    return (
      <div className="aspect-video w-full bg-slate-200 flex items-center justify-center p-6">
        <div className="animate-pulse h-20 w-24 rounded bg-slate-300" />
      </div>
    );
  }

  const p = segment.mediaPayload;
  if (p.kind === 'placeholder') {
    return (
      <div className="aspect-video w-full bg-slate-200 flex items-center justify-center p-6">
        <div className="text-center text-sm text-slate-600">
          {(p.notes ?? ['영상 준비 중입니다.']).map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      </div>
    );
  }

  if (p.kind === 'hls' && p.streamUrl) {
    return (
      <div className="aspect-video w-full bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted={!isActive}
          poster={p.posterUrl}
          controls
        />
      </div>
    );
  }

  if (p.kind === 'embed' && p.embedUrl) {
    return (
      <div className="aspect-video w-full bg-black">
        <iframe
          src={p.embedUrl}
          className="w-full h-full"
          allowFullScreen
          title={segment.title}
        />
      </div>
    );
  }

  return (
    <div className="aspect-video w-full bg-slate-200 flex items-center justify-center p-6">
      <p className="text-sm text-slate-600">미디어를 로드할 수 없습니다.</p>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function RoutinePlayerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routineId = searchParams.get('routineId') ?? '';
  const dayNumber = Math.max(
    1,
    Math.min(7, parseInt(searchParams.get('day') ?? '1', 10) || 1)
  );

  const [segments, setSegments] = useState<Segment[]>(FALLBACK_SEGMENTS);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planEmpty, setPlanEmpty] = useState(false);
  const [planErrorText, setPlanErrorText] = useState<string | null>(null);
  const [planRetryCount, setPlanRetryCount] = useState(0);
  const [ensureTimings, setEnsureTimings] = useState<Record<string, number> | null>(null);
  const authCheckedRef = useRef(false);
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
  const lastRoutineIdRef = useRef<string | null>(null);
  const statusLoading = useRef(false);
  const [currentDay, setCurrentDay] = useState(1);

  useEffect(() => {
    if (lastRoutineIdRef.current !== routineId) {
      lastRoutineIdRef.current = routineId;
      initSyncDone.current = false;
    }
  }, [routineId]);

  /** Auth 체크: token 없으면 /app/auth로 리다이렉트 */
  useEffect(() => {
    if (authCheckedRef.current) return;
    authCheckedRef.current = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        const next = `/app/routine/player?routineId=${encodeURIComponent(routineId)}&day=${dayNumber}`;
        router.replace(`/app/auth?next=${encodeURIComponent(next)}`);
      }
    });
  }, [router, routineId, dayNumber]);

  /** routineId/day 없으면 루틴 허브로 리다이렉트 */
  useEffect(() => {
    if (!routineId) {
      router.replace('/app/routine?reason=missing_params');
    }
  }, [routineId, router]);

  /** Day 전환 시 플레이어 상태 리셋 */
  useEffect(() => {
    setStatus('idle');
    setStartedAtUtcMs(null);
    setPausedAccumulatedMs(0);
    setPauseStartedPerfMs(null);
  }, [dayNumber]);

  /** Day plan fetch + segments 빌드 */
  useEffect(() => {
    if (!routineId) {
      setPlanLoading(false);
      return;
    }
    setPlanEmpty(false);
    setPlanError(null);
    setPlanErrorText(null);
    setEnsureTimings(null);
    let cancelled = false;
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;

      const opts: RequestInit = {
        cache: 'no-store' as RequestCache,
        headers: { Authorization: `Bearer ${session.access_token}` },
      };

      try {
        let ensureRes: Response;
        let data: Record<string, unknown>;
        const debugFlag = searchParams.get('debug') === '1';
        ensureRes = await fetch('/api/routine-plan/ensure', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            ...(opts.headers as Record<string, string>),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            routineId,
            dayNumber,
            debug: debugFlag,
            includeMedia: true,
          }),
        });
        data = await ensureRes.json().catch(() => ({})) as Record<string, unknown>;
        if (ensureRes.status === 403 && cancelled === false) {
          ensureRes = await fetch('/api/routine-plan/ensure', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              ...(opts.headers as Record<string, string>),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              routineId,
              dayNumber,
              debug: debugFlag,
              includeMedia: false,
            }),
          });
          data = await ensureRes.json().catch(() => ({})) as Record<string, unknown>;
        }

        if (cancelled) return;
        if (data?.timings) setEnsureTimings(data.timings as Record<string, number>);
        if (!ensureRes.ok) {
          setPlanError((data?.error as string) ?? 'Day Plan 조회/생성 실패');
          setPlanLoading(false);
          return;
        }

        const plan = data?.plan;
        if (!plan?.selected_template_ids?.length) {
          setPlanErrorText(data?.error ?? '플랜을 불러올 수 없습니다.');
          setPlanEmpty(true);
          setPlanLoading(false);
          return;
        }

        const segmentsWithMedia = data?.segments_with_media as Array<{
          templateId: string;
          templateName: string;
          mediaPayload?: MediaPayload | null;
        }> | undefined;

        if (segmentsWithMedia?.length) {
          const segs: Segment[] = [];
          for (let i = 0; i < segmentsWithMedia.length; i++) {
            const swm = segmentsWithMedia[i];
            const durationSec = swm.mediaPayload?.durationSec ?? 60;
            segs.push({
              id: `work-${swm.templateId}-${i}`,
              templateId: swm.templateId,
              title: swm.templateName ?? `운동 ${i + 1}`,
              durationSec,
              kind: 'work',
              mediaPayload: swm.mediaPayload ?? null,
              mediaError: false,
              templateName: swm.templateName,
            });
            if (i < segmentsWithMedia.length - 1) {
              segs.push({
                id: `rest-${i + 1}`,
                title: `휴식 ${i + 1}`,
                durationSec: 30,
                kind: 'rest',
              });
            }
          }
          setSegments(segs);
        } else {
          const ids = plan.selected_template_ids as string[];
          const segs: Segment[] = [];
          for (let i = 0; i < ids.length; i++) {
            segs.push({
              id: `work-${ids[i]}-${i}`,
              templateId: ids[i],
              title: `운동 ${i + 1}`,
              durationSec: 60,
              kind: 'work',
            });
            if (i < ids.length - 1) {
              segs.push({
                id: `rest-${i + 1}`,
                title: `휴식 ${i + 1}`,
                durationSec: 30,
                kind: 'rest',
              });
            }
          }
          setSegments(segs);

          const workSegs = segs.filter((s) => s.kind === 'work' && s.templateId);
          const mediaResults = await Promise.all(
            workSegs.map(async (s) => {
              if (cancelled) return { id: s.id, ok: false as const, mData: null, status: 0 };
              try {
                const mRes = await fetch(
                  `/api/exercise-template/media?templateId=${encodeURIComponent(s.templateId!)}`,
                  opts
                );
                const mData = await mRes.json().catch(() => ({}));
                const ok = mRes.ok && !!mData?.media;
                return { id: s.id, ok, mData, status: mRes.status };
              } catch {
                return { id: s.id, ok: false as const, mData: null, status: 0 };
              }
            })
          );
          if (cancelled) return;
          setSegments((prev) =>
            prev.map((p) => {
              const r = mediaResults.find((x) => x.id === p.id);
              if (!r) return p;
              if (r.ok && r.mData?.media) {
                return {
                  ...p,
                  title: r.mData.templateName ?? p.title,
                  templateName: r.mData.templateName,
                  durationSec: r.mData.media?.durationSec ?? p.durationSec,
                  mediaPayload: r.mData.media,
                  mediaError: false,
                };
              }
              return { ...p, mediaPayload: null, mediaError: true };
            })
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('[PLAYER_PLAN_FETCH_FAIL]', { message: String(err) });
        setPlanError(err instanceof Error ? err.message : 'Day Plan 조회 실패');
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [routineId, dayNumber, planRetryCount]);

  const TOTAL_DURATION_MS = useMemo(
    () => segments.reduce((acc, s) => acc + s.durationSec, 0) * 1000,
    [segments]
  );

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

  /** mount 시 status 1회만 호출 (init sync + currentDay) */
  useEffect(() => {
    if (initSyncDone.current || !routineId) return;
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
      const cd = data?.state?.currentDay;
      if (typeof cd === 'number' && cd >= 1 && cd <= 7) {
        setCurrentDay(cd);
      }
    });
  }, [routineId, dayNumber, segmentCount, fetchStatus]);

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
      console.log('[PLAYER_COMPLETE_START]', { dayNumber, startedAtUtc });

      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) {
          console.warn('[PLAYER_COMPLETE_FAIL]', {
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
            routineId: routineId || undefined,
            dayNumber,
            startedAtUtc,
          }),
          cache: 'no-store',
        })
          .then((res) => {
            if (res.ok) {
              console.log('[PLAYER_COMPLETE_SUCCESS]');
              const to = `/app/checkin?postWorkout=1&next=${encodeURIComponent('/app/checkin')}`;
              console.log('[PLAYER_POSTWORKOUT_REDIRECT]', { to });
              router.push(to);
            } else {
              res.json().then((body) =>
                console.warn('[PLAYER_COMPLETE_FAIL]', {
                  status: res.status,
                  error: body?.error ?? 'Unknown',
                })
              );
            }
          })
          .catch((err) => {
            console.warn('[PLAYER_COMPLETE_FAIL]', {
              status: 0,
              error: err?.message ?? String(err),
            });
          });
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
    router,
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

  const handleDaySelect = useCallback(
    (targetDay: number) => {
      if (status === 'running' || status === 'paused') return;
      if (targetDay === dayNumber) return;
      router.replace(`/app/routine/player?routineId=${encodeURIComponent(routineId)}&day=${targetDay}`);
    },
    [router, routineId, dayNumber, status]
  );

  if (!routineId) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
        <p className="text-slate-600">루틴으로 이동 중...</p>
      </div>
    );
  }

  if (planLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
        <div className="animate-pulse rounded-2xl bg-slate-200 h-32 w-full max-w-sm mb-4" />
        <p className="text-slate-600">루틴을 불러오는 중...</p>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
        <p className="text-red-600 mb-4">{planError}</p>
        <button
          type="button"
          onClick={() => router.push('/app/home')}
          className="min-h-[44px] px-8 py-4 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
        >
          홈으로
        </button>
      </div>
    );
  }

  if (planEmpty) {
    const playerUrl = `/app/routine/player?routineId=${encodeURIComponent(routineId)}&day=${dayNumber}`;
    const checkinUrl = `/app/checkin?postWorkout=0&next=${encodeURIComponent(playerUrl)}`;
    const handleRetry = () => {
      setPlanEmpty(false);
      setPlanLoading(true);
      setPlanErrorText(null);
      setPlanRetryCount((c) => c + 1);
    };
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <h2 className="text-lg font-bold text-slate-800 mb-2">
            {planErrorText ? '플랜 생성에 실패했어요.' : '플랜을 불러오지 못했어요.'}
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            {planErrorText ?? '다시 시도해 주세요.'}
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="min-h-[44px] w-full px-6 py-3 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
            >
              플랜 다시 생성하기
            </button>
            <button
              type="button"
              onClick={() => router.push(checkinUrl)}
              className="min-h-[44px] w-full px-6 py-3 rounded-full border-2 border-slate-900 bg-white font-bold text-slate-800 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95"
            >
              컨디션 기록하기
            </button>
            <button
              type="button"
              onClick={() => router.push('/app/routine')}
              className="min-h-[44px] w-full px-6 py-3 rounded-full border-2 border-slate-300 bg-white font-bold text-slate-600 shadow-[2px_2px_0_0_rgba(15,23,42,0.3)] transition hover:opacity-95"
            >
              루틴 목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          onClick={() => router.push('/app/home')}
          className="min-h-[44px] px-8 py-4 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5"
        >
          홈으로
        </button>
      </div>
    );
  }

  const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

  const showDebugTimings = searchParams.get('debug') === '1' && ensureTimings;

  return (
    <div className="min-h-screen bg-[#F8F6F0] pb-24">
      {showDebugTimings && (
        <div className="bg-slate-800 text-white text-xs px-3 py-1 font-mono truncate">
          ensure {ensureTimings.total_ms}ms | {JSON.stringify(ensureTimings)}
        </div>
      )}
      <header className="sticky top-0 z-10 border-b-2 border-slate-900 bg-[#F8F6F0] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
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
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {DAYS.map((d) => {
            const isDone = d < currentDay;
            const isActive = d === currentDay;
            const isLocked = d > currentDay;
            const isSelected = d === dayNumber;
            const canSelect = status !== 'running' && status !== 'paused';
            return (
              <button
                key={d}
                type="button"
                onClick={() => canSelect && handleDaySelect(d)}
                disabled={!canSelect}
                aria-label={isLocked ? `Day ${d} 진입 (휴식 권장)` : isSelected ? `Day ${d} 선택됨` : `Day ${d} 다시 보기`}
                className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition ${
                  isLocked
                    ? 'border-stone-400 bg-stone-100 text-stone-600 hover:bg-stone-200 cursor-pointer'
                    : isSelected
                      ? 'border-slate-900 bg-orange-400 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)]'
                      : isDone
                        ? 'border-slate-700 bg-slate-700 text-white hover:bg-slate-600'
                        : 'border-slate-900 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {isLocked ? <Lock className="size-4" strokeWidth={2} /> : isDone ? <Check className="size-4" strokeWidth={2.5} /> : d}
              </button>
            );
          })}
        </div>
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
            <div className="rounded-2xl border-2 border-slate-900 bg-slate-100 overflow-hidden shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
              {currentSegment && (
                <>
                  <p className="text-sm font-semibold text-slate-600 mb-2 p-4 pb-0">
                    {currentSegment.title}
                  </p>
                  {currentSegment.kind === 'work' && (
                    <MediaPlayer
                      segment={currentSegment}
                      isActive={status === 'running' || status === 'paused'}
                    />
                  )}
                  <p className="text-5xl font-bold text-slate-800 tabular-nums p-4">
                    {formatRemaining(segmentRemainingSec * 1000)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-center items-center flex-wrap flex-col">
          {status === 'idle' && (
            <>
              {dayNumber > currentDay && (
                <p className="text-sm text-amber-600">
                  휴식 권장 · 24시간 후 진행을 권장해요
                </p>
              )}
              <button
                type="button"
                onClick={handlePlay}
                className="min-h-[44px] px-8 py-3 rounded-full border-2 border-slate-900 bg-orange-400 font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95 active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-2"
              >
                <Play className="size-5" fill="currentColor" strokeWidth={0} />
                Play
              </button>
            </>
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
