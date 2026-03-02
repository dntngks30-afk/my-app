'use client';

/**
 * 패턴 배너: badgeTitle + headline + subhead
 * 네오브루탈: border-2 border-slate-950, shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]
 */

import type { DeepResultCopy } from '@/lib/deep-result/copy';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

interface PatternBannerProps {
  copy: DeepResultCopy;
}

export default function PatternBanner({ copy }: PatternBannerProps) {
  return (
    <div className={nbCard}>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-400/90 text-slate-900 text-xs font-bold mb-3">
        {copy.badgeTitle}
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">{copy.headline}</h2>
      <p className="text-sm text-stone-600">{copy.subhead}</p>
    </div>
  );
}
