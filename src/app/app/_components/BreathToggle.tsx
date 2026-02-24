'use client';

type BreathMode = 'inhale' | 'exhale';

interface BreathToggleProps {
  value: BreathMode;
  onChange: (v: BreathMode) => void;
}

export default function BreathToggle({ value, onChange }: BreathToggleProps) {
  return (
    <div className="flex rounded-lg bg-[var(--surface-2)] p-1">
      <button
        type="button"
        onClick={() => onChange('inhale')}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
          value === 'inhale'
            ? 'bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-0)]'
            : 'text-[var(--muted)]'
        }`}
      >
        들숨
      </button>
      <button
        type="button"
        onClick={() => onChange('exhale')}
        className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
          value === 'exhale'
            ? 'bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-0)]'
            : 'text-[var(--muted)]'
        }`}
      >
        날숨
      </button>
    </div>
  );
}
