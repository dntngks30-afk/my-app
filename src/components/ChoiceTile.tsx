'use client';

/**
 * ChoiceTile - 큰 타일 형태 선택지 컴포넌트 (v2.1 refined)
 * - 1px border, soft shadow
 * - focus-visible only
 * - option text is always readable (not muted)
 */

import type { Option } from '@/types/movement-test';

interface ChoiceTileProps {
  option: Option;
  isSelected: boolean;
  isDisabled?: boolean;
  rank?: number;
  onClick: () => void;
}

export default function ChoiceTile({
  option,
  isSelected,
  isDisabled = false,
  rank,
  onClick,
}: ChoiceTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={isSelected}
      aria-label={`${option.text}${rank ? ` (${rank}순위)` : ''}`}
      className={[
        // layout
        'w-full text-left',
        'min-h-[var(--tile-h)] px-[var(--tile-px)] py-[var(--tile-py)]',
        'rounded-[var(--radius)]',
        'border border-[color:var(--border)]',
        'bg-[var(--surface)]',

        // motion
        'transition-[background-color,border-color,box-shadow,transform] duration-150',
        'active:scale-[0.99]',

        // focus (keyboard only)
        'focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',

        // states
        isDisabled
          ? 'opacity-50 cursor-not-allowed'
          : isSelected
            ? 'bg-[var(--brand-soft)] border-[color:var(--brand)] shadow-[var(--shadow-1)]'
            : 'hover:bg-[var(--surface-2)] hover:shadow-[var(--shadow-0)] hover:border-[color:var(--border-strong)]',
      ].join(' ')}
      data-selected={isSelected ? 'true' : 'false'}
    >
      <div className="flex items-start gap-3">
        {/* 왼쪽 상태 아이콘 영역 */}
        <div className="mt-0.5 flex-shrink-0">
          {/* rank 우선 */}
          {rank ? (
            <div
              className="
                w-7 h-7 rounded-full
                border border-[color:var(--border-strong)]
                bg-[var(--surface)]
                text-[var(--text)]
                text-xs font-semibold
                flex items-center justify-center
              "
              aria-hidden="true"
              title={`${rank}순위`}
            >
              {rank}
            </div>
          ) : (
            // selected indicator (soft)
            <div
              className={[
                'w-5 h-5 rounded-full border',
                isSelected
                  ? 'bg-[var(--brand)] border-[color:var(--brand)]'
                  : 'bg-[var(--surface)] border-[color:var(--border-strong)]',
              ].join(' ')}
              aria-hidden="true"
            >
              {isSelected && (
                <svg
                  className="w-3.5 h-3.5 text-white m-[3px]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* 텍스트 */}
        <div className="flex-1">
          <div
            className={[
              'text-[15px] leading-6',
              'text-[var(--text)]',
              isSelected ? 'font-semibold' : 'font-medium',
            ].join(' ')}
          >
            {option.text}
          </div>

          {/* (선택) 여기에 짧은 보조 설명이 필요하면 추가 가능 */}
          {/* <div className="mt-1 text-sm text-[var(--muted)]">설명</div> */}
        </div>
      </div>
    </button>
  );
}
