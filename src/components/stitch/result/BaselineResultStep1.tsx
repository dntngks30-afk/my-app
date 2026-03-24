'use client';

import type { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep1Props = {
  /** 스테이지 eyebrow (예: 지금의 시작점) */
  titlePrefix: string;
  /** 사용자 대면 타입명 (6형 + UNKNOWN 안내) */
  typeName: string;
  /** 히어로 타입명 강조색 */
  typeAccentColor: string;
  /** 움직임 상태 요약(짧게) */
  heroStateSummary: string;
  /** 보상·대체 움직임 경향 한 줄 */
  heroCompensationLine: string;
  onNext: () => void;
};

/**
 * PR-BASELINE-STEP-IA-09 — zip(7) 히어로: 타입 reveal + 상태 + 보상 경향만.
 * 가짜 점수·진행 바 없음.
 */
export function BaselineResultStep1({
  titlePrefix,
  typeName,
  typeAccentColor,
  heroStateSummary,
  heroCompensationLine,
  onNext,
}: BaselineResultStep1Props) {
  return (
    <>
      <div className="relative min-h-0 flex-1 overflow-y-auto pb-3 pt-1">
        {/* 배경 글로우 — 측정 UI 아닌 분위기용 */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-48 max-w-sm rounded-full opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle, ${typeAccentColor}33 0%, transparent 70%)`,
          }}
          aria-hidden
        />

        <section className="relative flex flex-col items-center px-1 text-center">
          <span
            className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#ffb77d]/75"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {titlePrefix}
          </span>
          <p
            className="mt-2 text-xs italic text-[#c6c6cd]/80 [font-family:var(--font-display)]"
          >
            오늘의 움직임 타입
          </p>

          <div className="relative mt-6 flex size-28 items-center justify-center">
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
            className="mt-6 max-w-[20rem] break-keep text-[1.75rem] font-light italic leading-[1.15] tracking-tight [font-family:var(--font-display)] md:text-[2rem]"
            style={{ color: typeAccentColor }}
          >
            {typeName}
          </h2>

          <p
            className="mx-auto mt-4 max-w-[22rem] break-keep text-sm leading-relaxed text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {heroStateSummary}
          </p>

          <div
            className="mx-auto mt-5 w-full max-w-[22rem] rounded-xl border border-[#ffb77d]/15 bg-[#151b2d]/80 px-4 py-3 text-left"
          >
            <p
              className="text-[10px] uppercase tracking-[0.2em] text-[#fcb973]/90"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              자주 붙는 움직임 경향
            </p>
            <p
              className="mt-2 break-keep text-sm leading-relaxed text-[#dce1fb]/95"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {heroCompensationLine}
            </p>
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
