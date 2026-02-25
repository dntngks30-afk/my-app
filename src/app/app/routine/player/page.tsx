'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PlayerHeader from '../../_components/PlayerHeader';
import TodayRoutineCard from '../../_components/TodayRoutineCard';
import BottomNav from '../../_components/BottomNav';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { TODAY_ROUTINE } from '../../_data/home';

function computeTodayDay(startedAt: string | Date, now: Date = new Date()): number {
  const start = typeof startedAt === 'string' ? new Date(startedAt) : startedAt;
  const ms = now.getTime() - start.getTime();
  const day = Math.floor(ms / 86400000) + 1;
  return Math.max(1, Math.min(7, day));
}

type RoutineState = {
  id: string;
  started_at: string | null;
  progress?: number;
  completedDays?: number;
  totalDays?: number;
};

type DayState = { day_number: number; completed_at: string | null };

export default function RoutinePlayerPage() {
  const router = useRouter();
  const [routine, setRoutine] = useState<RoutineState | null>(null);
  const [days, setDays] = useState<DayState[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutine = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      router.replace('/app/auth?next=' + encodeURIComponent('/app/routine/player'));
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/workout-routine/get', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoutine(data.routine);
        setDays(data.days ?? []);
      } else if (res.status === 404) {
        setRoutine(null);
        setDays([]);
      } else {
        setError('루틴을 불러올 수 없습니다.');
      }
    } catch {
      setError('루틴을 불러올 수 없습니다.');
      setRoutine(null);
      setDays([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutine();
  }, [router]);

  const handleStart = async () => {
    if (!routine?.id || actionPending) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    setActionPending(true);
    setError(null);
    try {
      const res = await fetch('/api/workout-routine/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ routineId: routine.id }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        await fetchRoutine();
      } else {
        setError(data?.error ?? '시작 처리에 실패했습니다.');
      }
    } catch {
      setError('시작 처리에 실패했습니다.');
    } finally {
      setActionPending(false);
    }
  };

  const handleComplete = async () => {
    if (!routine?.id || !routine.started_at || actionPending) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const todayDay = computeTodayDay(routine.started_at);
    setActionPending(true);
    setError(null);
    try {
      const res = await fetch('/api/workout-routine/complete-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          routineId: routine.id,
          dayNumber: todayDay,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await fetchRoutine();
      } else {
        setError(data?.error ?? '완료 처리에 실패했습니다.');
      }
    } catch {
      setError('완료 처리에 실패했습니다.');
    } finally {
      setActionPending(false);
    }
  };

  const notStarted = !routine || !routine.started_at;
  const todayDay = routine?.started_at ? computeTodayDay(routine.started_at) : null;
  const todayCompleted =
    todayDay != null &&
    days.some((d) => d.day_number === todayDay && d.completed_at != null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">로딩 중...</p>
      </div>
    );
  }

  if (!routine) {
    return (
      <div className="min-h-screen bg-[var(--bg)] pb-24">
        <PlayerHeader />
        <main className="container mx-auto px-4 py-6">
          <p className="text-center text-[var(--muted)]">루틴이 없습니다.</p>
          <Link
            href="/app"
            className="mt-4 block text-center text-sm text-[var(--brand)] underline"
          >
            홈으로
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <PlayerHeader />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-0)]">
          <h2
            className="mb-2 text-lg font-semibold text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {notStarted ? '7일 루틴 시작하기' : `Day ${todayDay ?? 1}`}
          </h2>
          <p className="mb-6 text-sm text-[var(--muted)]">
            {notStarted
              ? '아래 버튼을 눌러 오늘부터 7일 루틴을 시작하세요.'
              : '오늘의 운동을 완료하고 출석을 체크하세요.'}
          </p>

          <TodayRoutineCard
            dayLabel={notStarted ? 'Day 1' : `Day ${todayDay ?? 1}`}
            durationBadge={TODAY_ROUTINE.durationBadge}
            exercises={TODAY_ROUTINE.exercises}
          />

          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}

          {notStarted ? (
            <Button
              onClick={handleStart}
              disabled={actionPending}
              className="mt-6 w-full rounded-[var(--radius)] py-6 text-base font-semibold bg-[var(--brand)]"
            >
              {actionPending ? '처리 중...' : 'Start 7-day routine'}
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={actionPending || todayCompleted}
              className="mt-6 w-full rounded-[var(--radius)] py-6 text-base font-semibold bg-[var(--brand)]"
            >
              {actionPending
                ? '처리 중...'
                : todayCompleted
                  ? 'Completed'
                  : 'Complete today'}
            </Button>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
