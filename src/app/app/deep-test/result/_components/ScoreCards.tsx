'use client';

/**
 * 3축 스코어 카드 (가동성 / 안정성 / 통증 위험)
 */

import type { RadarScores } from '@/lib/deep-result/score-utils';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';

interface ScoreCardsProps {
  scores: RadarScores | null;
  maxScore?: number;
}

const CARDS: Array<{
  key: keyof RadarScores;
  title: string;
  description: string;
}> = [
  { key: 'mobility', title: '가동성', description: '상·하체 움직임 범위' },
  { key: 'stability', title: '안정성', description: '코어·균형 안정성' },
  { key: 'painRisk', title: '통증 위험', description: '통증 기반 위험도' },
];

function formatScore(val: number, maxScore: number): string {
  const rounded = Math.round(val * 10) / 10;
  return `${rounded} / ${maxScore}`;
}

export default function ScoreCards({
  scores,
  maxScore = 10,
}: ScoreCardsProps) {
  if (!scores) {
    return (
      <div className={`${nbCard} flex items-center justify-center min-h-[120px]`}>
        <p className="text-sm text-stone-500">스코어를 계산 중이에요</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {CARDS.map((card) => {
        const val = scores[card.key];
        const displayVal =
          typeof val === 'number' && !Number.isNaN(val) ? val : 0;
        return (
          <div
            key={card.key}
            className={`${nbCard} p-4 text-center`}
          >
            <p className="text-xs font-medium text-stone-500 mb-1">
              {card.title}
            </p>
            <p className="text-lg font-bold text-slate-800">
              {formatScore(displayVal, maxScore)}
            </p>
            <p className="text-xs text-stone-600 mt-1">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
