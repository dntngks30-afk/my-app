'use client';

import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep1Props = {
  titlePrefix: string;
  typeLabel: string;
  typeColor: string;
  secondaryTendencyLine: string | null;
  brief: string;
  bullets: string[];
  onNext: () => void;
};

/**
 * stitch screen 28 — 시작점 / 타입 영웅 씬
 */
export function BaselineResultStep1({
  titlePrefix,
  typeLabel,
  typeColor,
  secondaryTendencyLine,
  brief,
  bullets,
  onNext,
}: BaselineResultStep1Props) {
  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-3 pt-1">
        <div className="flex flex-col items-center text-center">
          <span className="text-xl italic text-[#ffb77d]/90 [font-family:var(--font-display)]">{titlePrefix}</span>
          <h2
            className="mt-2 break-keep text-4xl font-light tracking-wide md:text-5xl [font-family:var(--font-display)]"
            style={{ color: typeColor }}
          >
            {typeLabel}
          </h2>
          {secondaryTendencyLine ? (
            <p
              className="mt-2 max-w-md text-sm text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {secondaryTendencyLine}
            </p>
          ) : null}
        </div>

        <div className="relative mx-auto flex w-full max-w-sm aspect-square items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#ffb77d]/10" />
          <div className="absolute inset-6 rounded-full border border-[#ffb77d]/30" />
          <div className="absolute inset-12 flex flex-col items-center justify-center rounded-full border border-white/[0.06] bg-[rgba(46,52,71,0.45)] p-8 text-center backdrop-blur-xl">
            <p
              className="break-keep text-sm font-light leading-relaxed text-[#c6c6cd]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {brief}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#151b2d]/50 px-4 py-4 backdrop-blur-sm">
          <ul className="space-y-2.5">
            {bullets.map((line, i) => (
              <li
                key={i}
                className="relative break-keep pl-3 text-sm leading-relaxed text-[#c6c6cd] before:absolute before:left-0 before:text-[#ffb77d] before:content-['•']"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ResultStitchFooter>
        <StitchBottomNavRow
          right={
            <button
              type="button"
              onClick={onNext}
              className="w-full min-h-[52px] rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-sm font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 — 왜 이런 패턴인지 보기
            </button>
          }
        />
      </ResultStitchFooter>
    </>
  );
}

function ResultStitchFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      {children}
    </div>
  );
}
