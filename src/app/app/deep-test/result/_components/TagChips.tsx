'use client';

/**
 * focus/avoid 태그 칩
 * tag-labels.ts로 한글 라벨 변환
 */

import { getTagLabel } from '@/lib/deep-result/tag-labels';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

const chipBase =
  'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-slate-300';

interface TagChipsProps {
  focusTags: string[];
  avoidTags: string[];
}

export default function TagChips({ focusTags, avoidTags }: TagChipsProps) {
  const hasFocus = focusTags.length > 0;
  const hasAvoid = avoidTags.length > 0;
  if (!hasFocus && !hasAvoid) return null;

  return (
    <div className={`${nbCard} space-y-3`}>
      {hasFocus && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">
            집중 영역
          </p>
          <div className="flex flex-wrap gap-2">
            {focusTags.map((tag) => (
              <span
                key={tag}
                className={`${chipBase} bg-emerald-50 text-emerald-800 border-emerald-200`}
              >
                {getTagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasAvoid && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">
            당분간 피하기
          </p>
          <div className="flex flex-wrap gap-2">
            {avoidTags.map((tag) => (
              <span
                key={tag}
                className={`${chipBase} bg-amber-50 text-amber-800 border-amber-200`}
              >
                {getTagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
