'use client';

type DayStatus = 'done' | 'active' | 'locked';

interface DayStepperProps {
  days: { day: number; status: DayStatus }[];
}

function DayPill({ day, status }: { day: number; status: DayStatus }) {
  if (status === 'done') {
    return (
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
        aria-label={`Day ${day} 완료`}
      >
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--brand)] bg-[var(--brand-soft)] text-sm font-semibold text-[var(--brand)]"
        aria-label={`Day ${day} 진행 중`}
      >
        {day}
      </div>
    );
  }
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
      aria-label={`Day ${day} 잠금`}
    >
      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    </div>
  );
}

export default function DayStepper({ days }: DayStepperProps) {
  return (
    <div className="flex items-center justify-between gap-1">
      {days.map(({ day, status }) => (
        <DayPill key={day} day={day} status={status} />
      ))}
    </div>
  );
}
