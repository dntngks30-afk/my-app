'use client';

interface CueChipsProps {
  chips: string[];
}

export default function CueChips({ chips }: CueChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((label) => (
        <span
          key={label}
          className="rounded-full border border-[color:var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
