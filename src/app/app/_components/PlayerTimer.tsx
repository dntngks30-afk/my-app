'use client';

interface PlayerTimerProps {
  minutes: number;
  seconds: number;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function PlayerTimer({ minutes, seconds }: PlayerTimerProps) {
  return (
    <div className="text-center">
      <div
        className="text-5xl font-bold tabular-nums text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {pad(minutes)}:{pad(seconds)}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">나머지 시간 (Remaining)</p>
    </div>
  );
}
