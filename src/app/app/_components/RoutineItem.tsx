'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface RoutineItemProps {
  id: string;
  title: string;
  subtext: string;
  thumbnail?: string | null;
  href?: string;
  onPlay?: () => void;
}

export default function RoutineItem({
  id,
  title,
  subtext,
  thumbnail,
  href = '/app/routine/player',
  onPlay,
}: RoutineItemProps) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius)] bg-[var(--surface-2)] p-3">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--border)]">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-2xl text-[var(--muted)]">▶</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--text)]">{title}</p>
        <p className="truncate text-xs text-[var(--muted)]">{subtext}</p>
      </div>
      <Link
        href={href}
        onClick={onPlay}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white hover:brightness-95"
        aria-label="재생"
      >
        <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </Link>
    </div>
  );
}
