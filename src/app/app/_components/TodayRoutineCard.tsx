'use client';

import { Badge } from '@/components/ui/badge';
import RoutineItem from './RoutineItem';

interface TodayRoutineCardProps {
  dayLabel: string;
  durationBadge: string;
  exercises: { id: string; title: string; subtext: string; thumbnail: string | null }[];
}

export default function TodayRoutineCard({
  dayLabel,
  durationBadge,
  exercises,
}: TodayRoutineCardProps) {
  return (
    <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-0)]">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{dayLabel}</span>
        <Badge variant="secondary" className="rounded-full text-xs">
          {durationBadge}
        </Badge>
      </div>
      <h2
        className="mb-4 text-base font-semibold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        오늘의 루틴
      </h2>
      <ul className="space-y-3">
        {exercises.map((ex) => (
          <li key={ex.id}>
            <RoutineItem
              id={ex.id}
              title={ex.title}
              subtext={ex.subtext}
              thumbnail={ex.thumbnail}
              href="/app/routine/player"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
