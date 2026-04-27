'use client';

import Image from 'next/image';
import {
  STEP3_ACTION_SCENE_SUBLINE,
  STEP3_EXECUTION_BRIDGE_TITLE,
  STEP3_EXECUTION_BRIDGE_BULLETS,
} from '@/components/public-result/public-result-labels';
import type { ResultStep3Assets } from '@/components/public-result/result-step3-assets';

const glassHabit =
  'rounded-2xl border border-white/[0.06] bg-[#151b2d]/45 px-4 py-3 backdrop-blur-sm';

export type BaselineResultStep3Stage = {
  /** 작은 단계 표시 (예: 1/3) */
  stageLabel: string;
  title: string;
  purpose: string;
  examples: string;
};

export type BaselineResultStep3ScrollSceneProps = {
  headline: string;
  refinedContextLine: string | null;
  stages: readonly [BaselineResultStep3Stage, BaselineResultStep3Stage, BaselineResultStep3Stage];
  /** [먼저 풀기, 그다음 깨우기, 움직임 연결하기] — 각 카드 대표 동작 이미지 */
  stageAssets: ResultStep3Assets;
  habitSectionTitle: string;
  habits: readonly [string, string, string];
  provenanceLine: string;
};

/**
 * PR-BASELINE-STEP3-SCROLL-ACTION-08 — 스크롤형 시작 씬: 3단 액션(이미지 슬롯 예약) + 실행 브리지 + 습관.
 * stitch zip(8) 미수급 시에도 동일 톤·리듬으로 구현.
 */
export function BaselineResultStep3ScrollScene({
  headline,
  refinedContextLine,
  stages,
  stageAssets,
  habitSectionTitle,
  habits,
  provenanceLine,
}: BaselineResultStep3ScrollSceneProps) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2
          className="break-keep text-xl font-semibold leading-snug text-[#dce1fb]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {headline}
        </h2>
        <p
          className="break-keep text-[13px] leading-relaxed text-slate-500"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {STEP3_ACTION_SCENE_SUBLINE}
        </p>
        {refinedContextLine ? (
          <p className="break-keep text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {refinedContextLine}
          </p>
        ) : null}
      </header>

      <div className="space-y-7">
        {stages.map((s, i) => (
          <article
            key={s.stageLabel}
            className="overflow-hidden rounded-2xl border border-[#ffb77d]/18 bg-gradient-to-b from-[#161d31]/95 to-[#0f1424]/95 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-md"
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ffb77d]/75"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {s.stageLabel}
            </p>
            <h3
              className="mt-2 break-keep text-[1.35rem] font-semibold leading-tight text-[#dce1fb]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {s.title}
            </h3>
            <p
              className="mt-3 break-keep text-[13px] leading-relaxed text-slate-400"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {s.purpose}
            </p>
            <p
              className="mt-2 break-keep text-[13px] font-medium leading-relaxed text-[#c6c6cd]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {s.examples}
            </p>
            <div className="relative mt-5 aspect-[4/3] min-h-[168px] w-full overflow-hidden rounded-xl border border-[#ffb77d]/22 bg-[#0e1322]">
              <Image
                src={stageAssets[i]!}
                alt={`${s.title} — ${s.examples}`}
                fill
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover"
              />
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-[#ffb77d]/14 bg-[#121a2e]/80 p-5 backdrop-blur-sm">
        <h3
          className="break-keep text-base font-semibold text-[#ffb77d]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {STEP3_EXECUTION_BRIDGE_TITLE}
        </h3>
        <ul className="mt-3 space-y-2.5" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {STEP3_EXECUTION_BRIDGE_BULLETS.map((line, i) => (
            <li
              key={i}
              className="flex gap-2.5 break-keep text-[13px] leading-relaxed text-[#c6c6cd]"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#ffb77d]/50" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className={glassHabit}>
        <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {habitSectionTitle}
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          <li>· {habits[0]}</li>
          <li>· {habits[1]}</li>
          <li>· {habits[2]}</li>
        </ul>
      </div>

      <p
        className="break-keep px-1 text-center text-[10px] text-slate-600"
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {provenanceLine}
      </p>
    </div>
  );
}
