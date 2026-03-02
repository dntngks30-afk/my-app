'use client';

/**
 * 결과 내러티브: symptoms, goals7d, caution
 * 네오브루탈: border-2 border-slate-950, shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]
 */

import type { DeepResultCopy } from '@/lib/deep-result/copy';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

interface ResultNarrativeProps {
  copy: DeepResultCopy;
}

export default function ResultNarrative({ copy }: ResultNarrativeProps) {
  const hasSymptoms = copy.symptoms.length > 0;
  const hasGoals = copy.goals7d.length > 0;

  return (
    <div className={`${nbCard} space-y-4`}>
      {hasSymptoms && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">
            자주 보이는 경향
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
            {copy.symptoms.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {hasGoals && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">
            7일 목표
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
            {copy.goals7d.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t border-stone-200">
        <p className="text-xs font-medium text-stone-500 mb-1">주의사항</p>
        <p className="text-sm text-slate-800">{copy.caution}</p>
      </div>
    </div>
  );
}
