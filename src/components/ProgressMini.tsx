'use client';

/**
 * ProgressMini - 축소 진행률 (refined)
 * - track은 border색이 아닌 surface 톤
 * - bar는 약한 shadow로 입체감 최소 부여
 * - 라벨에서 숫자만 강조
 */

interface ProgressMiniProps {
  current: number;
  total: number;
}

export default function ProgressMini({ current, total }: ProgressMiniProps) {
  const pct = Math.max(0, Math.min(100, Math.round((current / total) * 100)));

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--muted)]">
          질문{' '}
          <span className="text-[var(--text)] font-semibold">
            {current}
          </span>
          <span className="mx-1 text-[var(--muted)]">/</span>
          <span className="text-[var(--text)] font-semibold">
            {total}
          </span>
        </span>

        {/* (선택) 퍼센트 표기는 숨기는 게 더 고급스러움. 필요하면 아래 주석 해제 */}
        {/* <span className="text-xs text-[var(--muted)]">{pct}%</span> */}
      </div>

      <div
        className={[
          'w-full overflow-hidden rounded-full',
          'h-[var(--progress-h)]',
          'bg-[var(--surface-2)]',
          'border border-[color:var(--border)]',
        ].join(' ')}
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`질문 진행률 ${current}/${total}`}
      >
        <div
          className={[
            'h-full',
            'bg-[var(--brand)]',
            'transition-[width] duration-300',
            'shadow-[var(--shadow-inset)]',
            'rounded-full',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
