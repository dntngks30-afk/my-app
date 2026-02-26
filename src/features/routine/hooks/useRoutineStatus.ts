'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RoutineState } from '@/lib/routine-engine';

const MS_24H = 24 * 60 * 60 * 1000;

/**
 * last_activated_at 기준 +24h까지 남은 시간을 HH:MM:SS로 포맷
 * 기준점은 서버에서 받은 last_activated_at 타임스탬프
 */
function formatCountdown(lastActivatedAt: string): string {
  const unlockAt = new Date(lastActivatedAt).getTime() + MS_24H;
  const now = Date.now();
  const remainingMs = Math.max(0, unlockAt - now);

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
  refetch: () => Promise<void>;
}

export function useRoutineStatus(): UseRoutineStatusResult {
  const [state, setState] = useState<RoutineState | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/routine-engine/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '상태 조회 실패');
      }

      const { state: s } = await res.json();
      setState(s);

      if (s?.status === 'LOCKED' && s?.lastActivatedAt) {
        setCountdown(formatCountdown(s.lastActivatedAt));
      } else {
        setCountdown(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState(null);
      setCountdown(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (state?.status !== 'LOCKED' || !state?.lastActivatedAt) return;

    const updateCountdown = () => {
      const formatted = formatCountdown(state.lastActivatedAt!);
      setCountdown(formatted);

      const unlockAt = new Date(state.lastActivatedAt!).getTime() + MS_24H;
      if (Date.now() >= unlockAt) {
        fetchStatus();
      }
    };

    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, [state?.status, state?.lastActivatedAt, fetchStatus]);

  return { state, countdown, loading, error, refetch: fetchStatus };
}
