'use client';

import { Progress } from '@/components/ui/progress';

interface ProgressFooterProps {
  current: number;
  total: number;
}

export default function ProgressFooter({ current, total }: ProgressFooterProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>ROUTINE PROGRESS</span>
        <span>{current} / {total}</span>
      </div>
      <Progress value={percent} max={100} className="h-2" />
    </div>
  );
}
