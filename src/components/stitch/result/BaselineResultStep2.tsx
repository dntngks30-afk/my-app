'use client';

import { Activity, Layers, TrendingUp } from 'lucide-react';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';
import type { ResultMiniCard } from '@/components/public-result/public-result-labels';
import { ResultInsightCard } from '@/components/stitch/result/ResultInsightCard';

const STEP2_CARD_ICONS = [Activity, TrendingUp, Layers] as const;

export type BaselineResultStep2Props = {
  cards: ResultMiniCard[];
  refinementShiftLine: string | null;
  missingHintLine: string | null;
  /** 서버 summary_copy(메타 제거) — 시각 카드와 별도로 보조 기술용 짧은 제공 */
  a11ySummaryPlain?: string;
  onBack: () => void;
  onNext: () => void;
};

/**
 * PR-BASELINE-STEP-IA-09 — zip(6) 카드형: 패턴 이해 단계(짧은 헤드라인 + 카드).
 * reason/보조는 labels 빌더에서 3번째 카드에 합성.
 */
export function BaselineResultStep2({
  cards,
  refinementShiftLine,
  missingHintLine,
  a11ySummaryPlain,
  onBack,
  onNext,
}: BaselineResultStep2Props) {
  const row = cards.slice(0, 3);
  const a11yText =
    a11ySummaryPlain && a11ySummaryPlain.trim().length > 0
      ? a11ySummaryPlain.trim().length > 500
        ? `${a11ySummaryPlain.trim().slice(0, 497)}…`
        : a11ySummaryPlain.trim()
      : null;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-1">
        <h2
          className="break-keep text-left text-xl font-light text-[#dce1fb]"
          style={{ fontFamily: 'var(--font-display)' }}
          aria-describedby={a11yText ? 'baseline-step2-summary-plain' : undefined}
        >
          왜 이런 패턴이 보이기 쉬운가요?
        </h2>
        {a11yText ? (
          <span id="baseline-step2-summary-plain" className="sr-only">
            {a11yText}
          </span>
        ) : null}
        <p
          className="break-keep text-xs leading-relaxed text-slate-500"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          아래는 지금 읽힌 움직임 경향을 짧게 나눈 설명이에요.
        </p>

        <div className="space-y-3">
          {row.map((card, i) => {
            const Icon = STEP2_CARD_ICONS[i] ?? Layers;
            return (
              <ResultInsightCard key={`${card.title}-${i}`} icon={Icon} title={card.title} body={card.body} />
            );
          })}
        </div>

        {refinementShiftLine ? (
          <p
            className="break-keep text-xs leading-relaxed text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {refinementShiftLine}
          </p>
        ) : null}
        {missingHintLine ? (
          <p
            className="break-keep text-[11px] leading-relaxed text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {missingHintLine}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
        <StitchBottomNavRow
          left={
            <button
              type="button"
              onClick={onBack}
              className="w-full min-h-[52px] rounded-lg border border-[#ffb77d]/25 bg-transparent py-3 text-sm font-medium text-[#c6c6cd] transition-colors hover:bg-white/5"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              이전
            </button>
          }
          right={
            <button
              type="button"
              onClick={onNext}
              className="w-full min-h-[52px] rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-sm font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 — 시작 순서 보기
            </button>
          }
        />
      </div>
    </>
  );
}
