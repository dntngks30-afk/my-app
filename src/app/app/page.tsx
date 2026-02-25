'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppTopBar from './_components/AppTopBar';
import GrowthCard from './_components/GrowthCard';
import DayStepper from './_components/DayStepper';
import TodayRoutineCard from './_components/TodayRoutineCard';
import BottomNav from './_components/BottomNav';
import { supabase } from '@/lib/supabase';
import {
  GROWTH_CARD,
  DAY_STEPPER,
  TODAY_ROUTINE,
} from './_data/home';

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
} | null;

export default function AppHomePage() {
  const [routine, setRoutine] = useState<RoutineState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/workout-routine/get', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const { routine: r } = await res.json();
          setRoutine(r);
        } else {
          setRoutine(null);
        }
      } catch {
        setRoutine(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const notStarted = !routine || !routine.started_at;
  const todayDay = routine?.started_at ? computeTodayDay(routine.started_at) : null;
  const ctaLabel = notStarted ? 'Start' : `Continue (Day ${todayDay ?? 1})`;

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <GrowthCard
          week={GROWTH_CARD.week}
          title={GROWTH_CARD.title}
          progressPercent={routine ? (routine.progress ?? GROWTH_CARD.progressPercent) : GROWTH_CARD.progressPercent}
          fromLabel={GROWTH_CARD.fromLabel}
          toLabel={GROWTH_CARD.toLabel}
        />
        <section>
          <DayStepper days={DAY_STEPPER} />
        </section>
        <Link
          href="/app/routine/player"
          className="block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center font-semibold text-[var(--text)] shadow-[var(--shadow-0)] hover:bg-[var(--surface-2)]"
        >
          {loading ? '…' : ctaLabel}
        </Link>
        <TodayRoutineCard
          dayLabel={TODAY_ROUTINE.dayLabel}
          durationBadge={TODAY_ROUTINE.durationBadge}
          exercises={TODAY_ROUTINE.exercises}
        />
      </main>
      <BottomNav />
    </div>
  );
}
