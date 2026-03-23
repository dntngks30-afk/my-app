'use client';

import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep2Props = {
  summaryBody: string;
  reasonInsightLines: string[];
  refinementShiftLine: string | null;
  missingHintLine: string | null;
  careful: readonly string[] | string[];
  carefulHeading: string;
  carefulFitLine: string;
  onBack: () => void;
  onNext: () => void;
};

/**
 * stitch screen 29 — 인사이트 번호 리스트
 */
export function BaselineResultStep2({
  summaryBody,
  reasonInsightLines,
  refinementShiftLine,
  missingHintLine,
  careful,
  carefulHeading,
  carefulFitLine,
  onBack,
  onNext,
}: BaselineResultStep2Props) {
  const insightRows = reasonInsightLines.slice(0, 3);
  const carefulRows = careful.slice(0, 4);

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-3 pt-1">
        <h2 className="break-keep text-left text-2xl font-light text-[#dce1fb] [font-family:var(--font-display)]">
          왜 이런 패턴이 보이기 쉬운가요?
        </h2>

        <p
          className="break-keep text-sm leading-relaxed text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {summaryBody}
        </p>

        {insightRows.length > 0 ? (
          <div className="space-y-6">
            {insightRows.map((line, i) => (
              <div key={i} className="flex gap-4">
                <span className="text-2xl italic text-[#ffb77d] [font-family:var(--font-display)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p
                  className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {refinementShiftLine ? (
          <p className="break-keep text-xs leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
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

        <div className="rounded-2xl border border-white/[0.06] bg-[#151b2d]/45 px-4 py-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-medium text-[#dce1fb]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {carefulHeading}
          </h3>
          <ul className="space-y-3">
            {carefulRows.map((line, i) => (
              <li
                key={i}
                className="break-keep border-l-2 border-[#ffb77d]/25 pl-3 text-sm leading-relaxed text-slate-400"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {line}
              </li>
            ))}
          </ul>
          <p
            className="mt-3 break-keep text-[11px] leading-relaxed text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {carefulFitLine}
          </p>
        </div>

        <div className="flex justify-center gap-2 pt-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#46464c]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffb77d]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#46464c]" />
        </div>
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
