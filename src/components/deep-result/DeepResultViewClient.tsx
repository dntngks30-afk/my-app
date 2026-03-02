'use client';

/**
 * Shared Deep Result view (paid + demo)
 * Reuses PatternBanner, RadarChart, ScoreCards, ResultNarrative, TagChips
 */

import { getCopy } from '@/lib/deep-result/copy';
import { toRadarScores } from '@/lib/deep-result/score-utils';
import PatternBanner from '@/app/app/deep-test/result/_components/PatternBanner';
import RadarChart from '@/app/app/deep-test/result/_components/RadarChart';
import ResultNarrative from '@/app/app/deep-test/result/_components/ResultNarrative';
import ScoreCards from '@/app/app/deep-test/result/_components/ScoreCards';
import TagChips from '@/app/app/deep-test/result/_components/TagChips';

export interface DeepResultDerived {
  result_type?: string;
  algorithm_scores?: {
    upper_score?: number;
    lower_score?: number;
    core_score?: number;
    balance_score?: number;
    pain_risk?: number;
  };
  focus_tags?: string[];
  avoid_tags?: string[];
  confidence?: number;
  [k: string]: unknown;
}

interface DeepResultViewClientProps {
  derived: DeepResultDerived;
  variant?: 'paid' | 'demo';
  maxScore?: number;
}

export default function DeepResultViewClient({
  derived,
  variant = 'paid',
  maxScore = 10,
}: DeepResultViewClientProps) {
  const resultType = derived?.result_type ?? null;
  const copy = getCopy(resultType);
  const radarScores = toRadarScores(derived?.algorithm_scores);
  const focusTags = derived?.focus_tags ?? [];
  const avoidTags = derived?.avoid_tags ?? [];

  return (
    <div className="space-y-6">
      {variant === 'demo' && (
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">
          DEMO (NO LOGIN)
        </div>
      )}

      <PatternBanner copy={copy} />

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <RadarChart scores={radarScores} maxScore={maxScore} size={240} />
        <ScoreCards scores={radarScores} maxScore={maxScore} />
      </section>

      <ResultNarrative copy={copy} />
      <TagChips focusTags={focusTags} avoidTags={avoidTags} />
    </div>
  );
}
