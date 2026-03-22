'use client';

/**
 * PR-V2-06 — Unified Public Result Renderer
 * PR-RESULT-IA-03 — 2~3단(3 step) 액션 지향 UI: 타입 → 이유·조심 → 지금 할 일 + 실행 CTA
 * PR-CONVERSION-PREVIEW-04 — Step 3: 시작 순서 미리보기·실행 unlock 가치 정렬
 * PR-RESULT-EXPLANATION-UPGRADE-01 — reason_codes·출처 필드 기반 보조 설명(표현만)
 *
 * - 계약(UnifiedDeepResultV2)은 변경하지 않고 표현만 단순화.
 * - 신뢰도 바·축별 벡터·분류 근거 칩 등 분석 대시보드형 요소는 본문에서 제거.
 *
 * @see src/components/public-result/public-result-labels.ts
 * @see src/lib/result/deep-result-v2-contract.ts
 */

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { UnifiedDeepResultV2, UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import {
  PRIMARY_TYPE_LABELS,
  PRIMARY_TYPE_COLOR,
  PRIMARY_TYPE_BRIEF,
  PRIMARY_TYPE_SCREEN1_BULLETS,
  PRIMARY_TYPE_CAREFUL_MOVEMENTS,
  PRIMARY_TYPE_RECOMMENDED_MOVES,
  PRIMARY_TYPE_LIFESTYLE_HABITS,
  PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW,
  PRIMARY_TYPE_START_HOOK,
  stripSummaryMetaSuffix,
  STEP3_HEADLINE,
  EXECUTION_ORDER_PHASE_TITLES,
  STEP3_PREVIEW_DISCLAIMER,
  STEP3_VALUE_PILLARS,
  STEP3_REFINED_CONTEXT_LINE,
  STEP3_RECOMMENDED_SECTION_TITLE,
  STEP3_LIFESTYLE_SECTION_TITLE,
  buildPublicResultHeaderHint,
  pickReasonInsightBullets,
  buildRefinementShiftSupportLine,
  buildSecondaryTendencySentence,
  pickLightMissingHintLine,
  STEP3_ORDER_FIT_BY_PRIMARY,
  CAREFUL_FIT_BY_PRIMARY,
} from './public-result-labels';

const ACCENT = '#ff7b00';

export type PublicResultStage = 'baseline' | 'refined' | 'fallback';

export interface PublicResultAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface PublicResultRendererProps {
  result: UnifiedDeepResultV2;
  stage: PublicResultStage;
  cameraEvidenceQuality?: 'strong' | 'partial' | 'minimal';
  onBack?: () => void;
  actions?: PublicResultAction[];
  /** @deprecated PR-RESULT-IA-03 — 표시하지 않음(호환만 유지) */
  confidenceNote?: string;
}

const STAGE_META: Record<
  PublicResultStage,
  { titlePrefix: string; provenanceCopy: string }
> = {
  baseline: {
    titlePrefix: '지금의 시작점',
    provenanceCopy:
      '설문으로 오늘의 시작점을 정리했어요. 원하시면 짧은 동작 체크로 조정할 수 있어요.',
  },
  refined: {
    titlePrefix: '조정된 시작점',
    provenanceCopy: '설문과 짧은 동작 체크를 함께 반영했어요.',
  },
  fallback: {
    titlePrefix: '시작점 안내',
    provenanceCopy:
      '동작 신호가 부족해 설문 기준으로 안내해요. 다시 촬영하면 더 맞출 수 있어요.',
  },
};

function ActionButton({ action }: { action: PublicResultAction }) {
  const base = 'w-full min-h-[44px] rounded-2xl font-medium transition-colors text-sm';
  const styles: Record<NonNullable<PublicResultAction['variant']>, string> = {
    primary: `${base} font-bold text-slate-900`,
    secondary: `${base} text-slate-300 border border-white/20 hover:bg-white/5`,
    ghost: `${base} text-slate-400 border border-white/10 hover:bg-white/5`,
  };
  const variant = action.variant ?? 'ghost';
  const className = styles[variant];
  const inlineStyle = variant === 'primary' ? { backgroundColor: ACCENT } : undefined;

  return (
    <button
      type="button"
      onClick={action.onClick}
      className={className}
      style={{ fontFamily: 'var(--font-sans-noto)', ...inlineStyle }}
    >
      {action.label}
    </button>
  );
}

/** 3단계 진행 표시 (액션 지향 결과 IA) */
function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 w-full py-1" aria-hidden>
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
            step === n ? 'bg-[#ff7b00] text-slate-900' : 'bg-white/10 text-slate-500'
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

export function PublicResultRenderer({
  result,
  stage,
  cameraEvidenceQuality,
  onBack,
  actions = [],
}: PublicResultRendererProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const pt = result.primary_type as UnifiedPrimaryType;
  const typeLabel = PRIMARY_TYPE_LABELS[pt] ?? result.primary_type;
  const typeColor = PRIMARY_TYPE_COLOR[pt] ?? ACCENT;
  const stageMeta = STAGE_META[stage];
  const bullets = PRIMARY_TYPE_SCREEN1_BULLETS[pt] ?? PRIMARY_TYPE_SCREEN1_BULLETS.UNKNOWN;
  const brief = PRIMARY_TYPE_BRIEF[pt] ?? '';
  const careful = PRIMARY_TYPE_CAREFUL_MOVEMENTS[pt] ?? PRIMARY_TYPE_CAREFUL_MOVEMENTS.UNKNOWN;
  const rec = PRIMARY_TYPE_RECOMMENDED_MOVES[pt] ?? PRIMARY_TYPE_RECOMMENDED_MOVES.UNKNOWN;
  const life = PRIMARY_TYPE_LIFESTYLE_HABITS[pt] ?? PRIMARY_TYPE_LIFESTYLE_HABITS.UNKNOWN;
  const order = PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW[pt] ?? PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW.UNKNOWN;
  const hook = PRIMARY_TYPE_START_HOOK[pt] ?? PRIMARY_TYPE_START_HOOK.UNKNOWN;
  const summaryBody = stripSummaryMetaSuffix(result.summary_copy);

  const headerHint = buildPublicResultHeaderHint({
    stage,
    cameraEvidenceQuality,
    sourceMode: result.source_mode,
    evidenceLevel: result.evidence_level,
  });

  const reasonInsightLines = pickReasonInsightBullets(result.reason_codes, 2);
  const refinementShiftLine = buildRefinementShiftSupportLine(result.reason_codes, stage);
  const missingHintLine = pickLightMissingHintLine(result.missing_signals);
  const secondaryTendencyLine = buildSecondaryTendencySentence(
    result.secondary_type,
    pt
  );
  const step3OrderFitLine = STEP3_ORDER_FIT_BY_PRIMARY[pt] ?? STEP3_ORDER_FIT_BY_PRIMARY.UNKNOWN;
  const carefulFitLine = CAREFUL_FIT_BY_PRIMARY[pt] ?? CAREFUL_FIT_BY_PRIMARY.UNKNOWN;

  return (
    <div className="w-full max-w-md space-y-4 animate-in fade-in pb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors shrink-0"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            <ChevronLeft className="size-4" />
            뒤로
          </button>
        ) : (
          <div />
        )}
        <p
          className="text-[10px] text-slate-500 text-right break-keep max-w-[160px]"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {headerHint}
        </p>
      </div>

      {stage === 'fallback' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-100 break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {STAGE_META.fallback.provenanceCopy}
          </p>
        </div>
      )}

      <StepDots step={step} />

      {/* ── Step 1: 타입 / 한 줄 설명 / 불릿 ── */}
      {step === 1 && (
        <div className="space-y-4 pt-1">
          <div>
            <p className="text-xs text-slate-500 mb-1" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {stageMeta.titlePrefix}
            </p>
            <h1
              className="text-2xl font-bold break-keep"
              style={{ color: typeColor, fontFamily: 'var(--font-sans-noto)' }}
            >
              {typeLabel}
            </h1>
            {secondaryTendencyLine && (
              <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {secondaryTendencyLine}
              </p>
            )}
          </div>
          <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {brief}
          </p>
          <ul className="space-y-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            {bullets.map((line, i) => (
              <li
                key={i}
                className="text-sm text-slate-300 leading-relaxed break-keep pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-[#ff7b00]"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {line}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full min-h-[48px] rounded-2xl font-bold text-slate-900 bg-[#ff7b00] hover:bg-[#ff8f26] transition-colors text-sm"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            다음 — 왜 이런 패턴인지 보기
          </button>
        </div>
      )}

      {/* ── Step 2: 왜 + 조심할 움직임 ── */}
      {step === 2 && (
        <div className="space-y-4 pt-1">
          <h2 className="text-lg font-bold text-slate-100 break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            왜 이런 패턴이 보이기 쉬운가요?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {summaryBody}
          </p>
          {reasonInsightLines.length > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              {reasonInsightLines.map((line, i) => (
                <li
                  key={i}
                  className="text-xs text-slate-400 leading-relaxed break-keep pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-[#ff7b00]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
          {refinementShiftLine && (
            <p className="text-xs text-slate-400 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {refinementShiftLine}
            </p>
          )}
          {missingHintLine && (
            <p className="text-[11px] text-slate-500 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {missingHintLine}
            </p>
          )}
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-2" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              일상에서 조심하면 좋은 점
            </h3>
            <ul className="space-y-2">
              {careful.slice(0, 4).map((line, i) => (
                <li
                  key={i}
                  className="text-sm text-slate-400 leading-relaxed break-keep border-l-2 border-white/15 pl-3"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {carefulFitLine}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 min-h-[44px] rounded-2xl text-slate-300 border border-white/20 text-sm"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 min-h-[44px] rounded-2xl font-bold text-slate-900 bg-[#ff7b00] text-sm"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 — 시작 순서 보기
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: 시작 순서 미리보기 + 실행 가치 + 보조 팁 + CTA (PR-CONVERSION-PREVIEW-04) ── */}
      {step === 3 && (
        <div className="space-y-4 pt-1">
          <h2 className="text-lg font-bold text-slate-100 break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {STEP3_HEADLINE}
          </h2>
          {stage === 'refined' && (
            <p className="text-xs text-slate-400 break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_REFINED_CONTEXT_LINE}
            </p>
          )}
          <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {hook}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {step3OrderFitLine}
          </p>

          {/* 시작 순서 미리보기 — 1·2·3 단계 의미 + 타입별 한 줄 */}
          <div className="rounded-2xl border border-[#ff7b00]/35 bg-[#ff7b00]/10 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-[#ff7b00]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                시작 순서 미리보기
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {STEP3_PREVIEW_DISCLAIMER}
              </p>
            </div>
            <ol className="space-y-3 list-none">
              {([0, 1, 2] as const).map((i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-900"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                      {EXECUTION_ORDER_PHASE_TITLES[i]}
                    </p>
                    <p className="text-sm text-slate-100 mt-0.5 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                      {order[i]}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* 실행 이어가기 — 결제=실행 unlock */}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              실행을 시작하면
            </p>
            <ul className="space-y-2">
              {STEP3_VALUE_PILLARS.map((line, i) => (
                <li
                  key={i}
                  className="text-sm text-slate-300 leading-relaxed break-keep flex gap-2.5"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  <span className="text-[#ff7b00] shrink-0" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_RECOMMENDED_SECTION_TITLE}
            </p>
            <ul className="text-sm text-slate-200 space-y-1.5" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              <li>· {rec[0]}</li>
              <li>· {rec[1]}</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_LIFESTYLE_SECTION_TITLE}
            </p>
            <ul className="text-sm text-slate-300 space-y-1.5" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              <li>· {life[0]}</li>
              <li>· {life[1]}</li>
              <li>· {life[2]}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full min-h-[40px] rounded-xl text-slate-400 border border-white/10 text-sm"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            이전
          </button>

          <p className="text-[10px] text-slate-600 text-center break-keep px-1" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {stageMeta.provenanceCopy}
          </p>

          {actions.length > 0 && (
            <div className="space-y-3 pt-1">
              {actions.map((action, i) => (
                <ActionButton key={i} action={action} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
