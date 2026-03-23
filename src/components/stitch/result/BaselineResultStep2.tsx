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
 * stitch screen 29 — 인사이트 씬 (PR-UI-RESULT-BENTO-05)
 * 넘버드 리스트 → 벤토 인사이트 타일, 주의 섹션 에디토리얼 스트립.
 * 동적 슬롯 의미·reason_code 계약 유지.
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
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-1">

        {/* ── 섹션 타이틀 ── */}
        <h2
          className="break-keep text-left text-xl font-light text-[#dce1fb]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          왜 이런 패턴이 보이기 쉬운가요?
        </h2>

        {/* ── 요약 본문 ── */}
        <p
          className="break-keep text-sm leading-relaxed text-[#c6c6cd]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {summaryBody}
        </p>

        {/* ── 벤토 인사이트 타일 ── */}
        {insightRows.length > 0 ? (
          <div className="space-y-2.5">
            {insightRows.map((line, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-xl border border-white/[0.06] bg-[#151b2d]/45 px-4 py-4 backdrop-blur-sm"
              >
                <span
                  className="shrink-0 text-xl italic leading-none text-[#ffb77d]/60"
                  style={{ fontFamily: 'var(--font-display)' }}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p
                  className="min-w-0 flex-1 break-keep text-sm leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>
        ) : null}

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

        {/* ── 주의 동작 에디토리얼 스트립 ── */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d1520]/70 px-4 py-5 backdrop-blur-sm">
          <h3
            className="mb-4 break-keep text-sm font-medium text-[#dce1fb]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {carefulHeading}
          </h3>
          <ul className="space-y-3">
            {carefulRows.map((line, i) => (
              <li
                key={i}
                className="flex gap-3"
              >
                <span
                  className="mt-0.5 shrink-0 text-[10px] font-light uppercase tracking-[0.25em] text-[#ffb77d]/50"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p
                  className="min-w-0 flex-1 break-keep text-sm leading-relaxed text-slate-400"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </p>
              </li>
            ))}
          </ul>
          <p
            className="mt-4 break-keep text-[11px] leading-relaxed text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {carefulFitLine}
          </p>
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
