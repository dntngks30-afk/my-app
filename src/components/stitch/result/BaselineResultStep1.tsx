'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';

export type BaselineResultStep1Props = {
  /** 스테이지 eyebrow (예: 지금의 시작점) */
  titlePrefix: string;
  /** 사용자 대면 타입명 (6형 + UNKNOWN 안내) */
  typeName: string;
  /** 히어로 타입명 강조색 */
  typeAccentColor: string;
  /** 보조 경향 한 줄(있을 때만) */
  secondaryTendencyLine: string | null;
  /** 짧은 요약(타입명 바로 아래) */
  summary: string;
  /** 주의할 패턴(한 블록) */
  patternToWatch: string;
  /** 오늘의 조심(한 블록) */
  todayCaution: string;
  /** 첫 리셋 방향(한 블록) */
  firstResetDirection: string;
  onNext: () => void;
};

/**
 * stitch baseline type-result — PR-BASELINE-TYPE-UI-AND-COPY-07
 * Stitch 패키지 시각 SSOT: 톤 서피스·에디토리얼 계층·tertiary 아이콘·no-line(미세 border-l 만 오늘 블록).
 */
export function BaselineResultStep1({
  titlePrefix,
  typeName,
  typeAccentColor,
  secondaryTendencyLine,
  summary,
  patternToWatch,
  todayCaution,
  firstResetDirection,
  onNext,
}: BaselineResultStep1Props) {
  return (
    <>
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pb-3 pt-1">
        {/* A. Hero */}
        <section className="text-center">
          <span
            className="block text-sm italic text-[#ffb77d]/80 tracking-wide [font-family:var(--font-display)]"
          >
            {titlePrefix}
          </span>
          <h2
            className="mt-2.5 break-keep text-[1.85rem] font-light italic leading-[1.2] tracking-tight [font-family:var(--font-display)] md:text-[2rem]"
            style={{ color: typeAccentColor }}
          >
            {typeName}
          </h2>
          <p
            className="mx-auto mt-3 max-w-[22rem] break-keep text-sm leading-relaxed text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {summary}
          </p>
          {secondaryTendencyLine ? (
            <p
              className="mt-2 break-keep text-xs text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {secondaryTendencyLine}
            </p>
          ) : null}
          <div className="mx-auto mt-5 h-px w-12 bg-[#ffb77d]/30" />
        </section>

        {/* 1. 주의할 패턴 — surface-container-highest, tertiary 아이콘 */}
        <div className="rounded-xl bg-[#2e3447] px-5 py-5">
          <p
            className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#fcb973]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            주의할 패턴
          </p>
          <div className="flex gap-3 break-keep text-sm leading-relaxed text-[#c6c6cd]">
            <AlertCircle
              className="mt-0.5 size-[1.15rem] shrink-0 text-[#fcb973]/65"
              strokeWidth={1.5}
              aria-hidden
            />
            <p style={{ fontFamily: 'var(--font-sans-noto)' }}>{patternToWatch}</p>
          </div>
        </div>

        {/* 2. 오늘의 조심 — surface-container-low + 좌측 앰버 라인, 원형 아이콘 */}
        <div className="rounded-xl border-l border-[#ffb77d]/10 bg-[#151b2d] px-5 py-5 pl-4">
          <p
            className="mb-4 text-[10px] uppercase tracking-[0.2em] text-[#ffb77d]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            오늘의 조심
          </p>
          <div className="flex items-start gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#2e3447]"
              aria-hidden
            >
              <Sparkles className="size-7 text-[#ffb77d]" strokeWidth={1.25} />
            </div>
            <p
              className="min-w-0 flex-1 break-keep text-sm leading-relaxed text-[#c6c6cd]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {todayCaution}
            </p>
          </div>
        </div>

        {/* 3. 첫 리셋 방향 — surface-container-high, bento-glow 느낌 */}
        <div
          className="relative overflow-hidden rounded-xl px-5 py-5"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(255,183,125,0.07), transparent 68%), #23293c',
          }}
        >
          <p
            className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#ffb68e]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            첫 리셋 방향
          </p>
          <p
            className="break-keep text-base italic leading-relaxed text-[#dce1fb] [font-family:var(--font-display)]"
          >
            &ldquo;{firstResetDirection}&rdquo;
          </p>
        </div>
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
