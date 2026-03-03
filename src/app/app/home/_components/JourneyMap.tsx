'use client';

/**
 * JourneyMap — 세션 여정 경로 (1..N)
 * total_sessions, completed_sessions 기반.
 * 마커 위치: completed_sessions + 1 (다음 세션)
 */

type JourneyMapProps = {
  total: number;
  completed: number;
};

const TOTAL_TO_FREQUENCY: Record<number, number> = {
  8: 2,
  12: 3,
  16: 4,
  20: 5,
};

export default function JourneyMap({ total, completed }: JourneyMapProps) {
  const freq = TOTAL_TO_FREQUENCY[total] ?? 4;
  const markerPos = Math.min(completed + 1, total);
  const nodes = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        주당 {freq}회 · 4주 여정(총 {total}회)
      </p>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`,
        }}
      >
        {nodes.map((n) => {
          const isCompleted = n <= completed;
          const isMarker = n === markerPos;
          return (
            <div
              key={n}
              className={`
                flex aspect-square items-center justify-center rounded-lg text-xs font-bold
                ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}
                ${isMarker ? 'ring-2 ring-orange-400 ring-offset-1' : ''}
              `}
            >
              {n}
            </div>
          );
        })}
      </div>
    </div>
  );
}
