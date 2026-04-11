'use client';

import { Fragment, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { BASELINE_STEP1_HERO_OVERLINE } from '@/components/public-result/public-result-labels';

type Step1HeroHighlight = { phrase: string; tone: 'accent' | 'bodyMuted' };

/** Step1 본문에서만 강조(표현 전용). 부분 문자열 미포함 타입은 변화 없음. */
const BASELINE_STEP1_HERO_HIGHLIGHTS: readonly Step1HeroHighlight[] = [
  { phrase: '당신의 움직임 타입', tone: 'accent' },
  { phrase: '허리와 골반이 먼저 긴장해', tone: 'accent' },
  { phrase: '호흡과 함께 몸통 중심이 자연스럽게 연결', tone: 'accent' },
  { phrase: '스트레스가 쌓이면 몸의 균형도', tone: 'accent' },
  { phrase: '흔들릴 수 있습니다', tone: 'accent' },
  { phrase: '균형을 유지', tone: 'accent' },
  { phrase: '무릎과 발목이 먼저 버티는 방식', tone: 'accent' },
  { phrase: '이\n익숙해지기 쉽습니다.', tone: 'bodyMuted' },
  { phrase: '체중을 받쳐주는 감각', tone: 'accent' },
  { phrase: '상체 전체가 긴장으로 버티게 됩니다.', tone: 'accent' },
  { phrase: '가슴·등·어깨', tone: 'accent' },
  { phrase: '긴장을 먼저 풀어주는 것', tone: 'accent' },
  { phrase: '몸 전체가 쉽게 무겁고 둔하게 느껴지고,', tone: 'accent' },
  { phrase: '회복 리듬을 되찾는 것', tone: 'accent' },
];

function renderHeroLineWithHighlights(line: string): ReactNode {
  const nodes: ReactNode[] = [];
  let remaining = line;
  let k = 0;

  while (remaining.length > 0) {
    let bestIdx = -1;
    let best: Step1HeroHighlight | null = null;
    for (const spec of BASELINE_STEP1_HERO_HIGHLIGHTS) {
      const idx = remaining.indexOf(spec.phrase);
      if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
        bestIdx = idx;
        best = spec;
      }
    }
    if (bestIdx < 0 || !best) {
      nodes.push(<Fragment key={k++}>{remaining}</Fragment>);
      break;
    }
    if (bestIdx > 0) {
      nodes.push(<Fragment key={k++}>{remaining.slice(0, bestIdx)}</Fragment>);
    }
    const spanClass =
      best.tone === 'accent'
        ? 'text-[14px] font-medium text-[#fcb973]'
        : 'font-normal text-[rgba(198,198,205,1)]';
    nodes.push(
      <span key={k++} className={spanClass}>
        {best.phrase}
      </span>
    );
    remaining = remaining.slice(bestIdx + best.phrase.length);
  }

  return <>{nodes}</>;
}

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

        <section className="relative flex flex-col items-center px-1 text-left">
          <p
            className="text-[15px] font-extrabold tracking-[0] text-[#c6c6cd]/90"
            style={{ fontFamily: '"Noto Sans KR"' }}
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

          <div
            className="mx-0 my-2.5 flex w-full min-h-[40px] max-w-[20rem] transform-none items-center justify-center gap-0 rounded-xl border border-white/10 bg-[#151b2d]/85 px-0 py-0 text-center backdrop-blur-sm"
            style={{ boxShadow: '0 0 0 1px rgba(252, 144, 29, 0.25) inset' }}
          >
            <h2
              className="break-keep text-center text-[26px] font-bold not-italic leading-[1.2] tracking-[-0.6px] text-[#fc901d] transform-none"
              style={{ fontFamily: 'var(--font-serif-noto)' }}
            >
              {typeName}
            </h2>
          </div>

          <div
            className="mx-auto mt-5 w-full max-w-[22.5rem] space-y-3 text-center"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {lines.map((line, i) => (
              <p
                key={i}
                className="whitespace-pre-line break-keep text-center text-[13px] font-normal leading-[17px] tracking-[-0.5px] text-[rgba(198,198,205,1)] sm:text-[15px] sm:leading-[17px]"
              >
                {renderHeroLineWithHighlights(line)}
              </p>
            ))}
          </div>

          <div className="mx-auto mt-8 h-px w-14 bg-[#ffb77d]/35" aria-hidden />
        </section>
      </div>

      <ResultStitchFooter>
        <>
          <button
            type="button"
            onClick={onNext}
            className="w-full min-h-[52px] rounded-md bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-3.5 text-[16px] font-semibold tracking-wide text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            왜 이런 패턴인지 보기
          </button>
          <div className="w-full" aria-hidden />
        </>
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
