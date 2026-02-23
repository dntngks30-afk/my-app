'use client';

interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = '앱' }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-center border-b border-[color:var(--border)] bg-[var(--surface)] px-4">
      <h1
        className="text-lg font-semibold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
    </header>
  );
}
