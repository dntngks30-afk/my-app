'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RoutineState } from '@/lib/routine-engine';

/**
 * lock_until_utc - (server_now_utc + clientTickElapsedMs) 기준 남은 시간 포맷
 * clientTickElapsedMs: fetch 후 1초마다 누적 (클라이언트 Date는 tick 용도만)
 */
function formatCountdownFromUtc(
  lockUntilUtc: string,
  serverNowUtc: string,
  clientTickElapsedMs: number
): string {
  const lockMs = new Date(lockUntilUtc).getTime();
  const serverMs = new Date(serverNowUtc).getTime();
  const remainingMs = Math.max(0, lockMs - (serverMs + clientTickElapsedMs));

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}

export interface UseRoutineStatusResult {
  state: RoutineState | null;
  countdown: string | null;
  loading: boolean;
  error: string | null;
  todayCompletedForDay: boolean;
  serverNowUtc: string | null;
  refetch: () => Promise<void>;
}

export function useRoutineStatus(): UseRoutineStatusResult {
  const [state, setState] = useState<RoutineState | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCompletedForDay, setTodayCompletedForDay] = useState(false);
  const [serverNowUtc, setServerNowUtc] = useState<string | null>(null);
  const [lockUntilUtc, setLockUntilUtc] = useState<string | null>(null);
  const fetchTimeRef = useRef<number>(0);

  const fetchStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    console.log('[HOME_STATUS_FETCH_START]');
    try {
      setError(null);
      const res = await fetch('/api/routine-engine/status', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '상태 조회 실패');
      }

      const data = await res.json();
      const s = data.state;

      setState(s);
      setTodayCompletedForDay(data.todayCompletedForDay === true);
      setServerNowUtc(data.server_now_utc ?? null);
      setLockUntilUtc(data.lock_until_utc ?? null);
      fetchTimeRef.current = Date.now();

      if (s?.status === 'LOCKED') {
        if (data.lock_until_utc && data.server_now_utc) {
          setCountdown(
            formatCountdownFromUtc(data.lock_until_utc, data.server_now_utc, 0)
          );
        } else if (s?.lastActivatedAt) {
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
      } else {
        setCountdown(null);
      }

      console.log('[HOME_STATUS_FETCH_SUCCESS]', {
        status: s?.status,
        todayCompletedForDay: data.todayCompletedForDay,
      });
    } catch (err) {
      console.warn('[HOME_STATUS_FETCH_FAIL]', {
        message: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : String(err));
      setState(null);
      setCountdown(null);
      setTodayCompletedForDay(false);
      setServerNowUtc(null);
      setLockUntilUtc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (state?.status !== 'LOCKED') return;
    if (!lockUntilUtc || !serverNowUtc) {
      if (state?.lastActivatedAt) {
        const MS_24H = 24 * 60 * 60 * 1000;
        const id = setInterval(() => {
          const unlockAt = new Date(state.lastActivatedAt!).getTime() + MS_24H;
          const remainingMs = Math.max(0, unlockAt - Date.now());
          const totalSeconds = Math.floor(remainingMs / 1000);
          const h = Math.floor(totalSeconds / 3600);
          const m = Math.floor((totalSeconds % 3600) / 60);
          const sec = totalSeconds % 60;
          setCountdown([h, m, sec].map((n) => String(n).padStart(2, '0')).join(':'));
          if (remainingMs <= 0) fetchStatus();
        }, 1000);
        return () => clearInterval(id);
      }
      return;
    }

    const updateCountdown = () => {
      const clientTickElapsedMs = Date.now() - fetchTimeRef.current;
      const formatted = formatCountdownFromUtc(
        lockUntilUtc,
        serverNowUtc,
        clientTickElapsedMs
      );
      setCountdown(formatted);

      const lockMs = new Date(lockUntilUtc).getTime();
      const serverMs = new Date(serverNowUtc).getTime();
      const remainingMs = lockMs - (serverMs + clientTickElapsedMs);
      if (remainingMs <= 0) {
        fetchStatus();
      }
    };

    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [state?.status, lockUntilUtc, serverNowUtc, fetchStatus]);

  return {
    state,
    countdown,
    loading,
    error,
    todayCompletedForDay,
    serverNowUtc,
    refetch: fetchStatus,
  };
}
