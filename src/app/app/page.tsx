'use client';

import AppTopBar from './_components/AppTopBar';
import GrowthCard from './_components/GrowthCard';
import DayStepper from './_components/DayStepper';
import TodayRoutineCard from './_components/TodayRoutineCard';
import BottomNav from './_components/BottomNav';
import {
  GROWTH_CARD,
  DAY_STEPPER,
  TODAY_ROUTINE,
} from './_data/home';

export default function AppHomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppTopBar />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <GrowthCard
          week={GROWTH_CARD.week}
          title={GROWTH_CARD.title}
          progressPercent={GROWTH_CARD.progressPercent}
          fromLabel={GROWTH_CARD.fromLabel}
          toLabel={GROWTH_CARD.toLabel}
        />
        <section>
          <DayStepper days={DAY_STEPPER} />
        </section>
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
