'use client';

import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';
import { BASELINE_STEP1_HERO_OVERLINE } from '@/components/public-result/public-result-labels';

export type BaselineResultStep1Props = {
  /** 사용자 대면 타입명 (6형 + UNKNOWN 안내) */
  typeName: string;
  /** 히어로 타입명 강조색 */
  typeAccentColor: string;
  /** 6형: 확정 문단(1블록 또는 여러 문단), UNKNOWN: 짧은 안내 */
  heroCoreLines: readonly string[];
  onNext: () => void;
};

/**
 * PR-BASELINE-STEP1-FINAL-COPY-11 — 상단 고정 문구 + 타입명 + 본문(문단형 카피).
 * 스테이지별 eyebrow 없음. 가짜 점수·진행 바 없음.
 */
export function BaselineResultStep1({
  typeName,
  typeAccentColor,
  heroCoreLines,
  onNext,
}: BaselineResultStep1Props) {
  const lines = heroCoreLines.filter((l) => l.trim().length > 0);

  return (
    <>
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-3 pt-1">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 max-w-sm rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${typeAccentColor}33 0%, transparent 70%)`,
          }}
          aria-hidden
        />

        <section className="relative flex flex-col items-center px-1 text-center">
          <p
            className="text-[13px] font-medium tracking-wide text-[#c6c6cd]/90"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {BASELINE_STEP1_HERO_OVERLINE}
          </p>

          <div className="relative mt-5 flex size-28 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full opacity-30 blur-md"
              style={{ background: typeAccentColor }}
              aria-hidden
            />
            <div
              className="relative flex size-24 items-center justify-center rounded-full border border-white/10 bg-[#151b2d]/90 shadow-inner"
              style={{ boxShadow: `0 0 0 1px ${typeAccentColor}40 inset` }}
            >
              <UserRound className="size-11" style={{ color: typeAccentColor }} strokeWidth={1.25} aria-hidden />
            </div>
          </div>

          <h2
            className="mt-5 max-w-[20rem] break-keep text-[1.75rem] font-light italic leading-[1.15] tracking-tight [font-family:var(--font-display)] md:text-[2rem]"
            style={{ color: typeAccentColor }}
          >
            {typeName}
          </h2>

          <div
            className="mx-auto mt-5 w-full max-w-[22.5rem] space-y-3 text-left"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {lines.map((line, i) => (
              <p
                key={i}
                className="break-keep text-[14px] leading-[1.65] text-[#c6c6cd] sm:text-[15px]"
              >
                {line}
              </p>
            ))}
          </div>

          <div className="mx-auto mt-8 h-px w-14 bg-[#ffb77d]/35" aria-hidden />
        </section>
      </div>

      <ResultStitchFooter>
        <StitchBottomNavRow
          right={
            <button
              type="button"
              onClick={onNext}
              className="w-full min-h-[52px] rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-sm font-semibold tracking-wide text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
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

function ResultStitchFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[#0c1324]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      {children}
    </div>
  );
}
