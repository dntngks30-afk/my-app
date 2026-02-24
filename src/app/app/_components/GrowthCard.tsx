'use client';

import { Progress } from '@/components/ui/progress';

interface GrowthCardProps {
  week: number;
  title: string;
  progressPercent: number;
  fromLabel: string;
  toLabel: string;
}

export default function GrowthCard({
  week,
  title,
  progressPercent,
  fromLabel,
  toLabel,
}: GrowthCardProps) {
  return (
    <section className="rounded-[var(--radius)] border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-0)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        WEEK {week}
      </p>
      <h2
        className="mt-1 text-lg font-semibold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">성장을 {progressPercent}%</p>
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted)]">
        <span>{fromLabel}</span>
        <span>{toLabel}</span>
      </div>
      <Progress value={progressPercent} max={100} className="mt-2 h-2" />
    </section>
  );
}
