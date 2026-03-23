'use client';

/**
 * PR-V2-06 — Unified Public Result Renderer
 * 시각: stitch result family (로직·카피·단계 의미 동일)
 */

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { UnifiedDeepResultV2, UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import { MoveReStepNavRow } from '@/components/public-brand';
import { StitchSceneProgressRail } from '@/components/stitch/shared/SceneProgressRail';
import { StitchBottomNavRow } from '@/components/stitch/shared/BottomNavRow';
import { BaselineResultStep1 } from '@/components/stitch/result/BaselineResultStep1';
import { BaselineResultStep2 } from '@/components/stitch/result/BaselineResultStep2';
import { BaselineResultStep3 } from '@/components/stitch/result/BaselineResultStep3';
import {
  PRIMARY_TYPE_COLOR,
  PRIMARY_TYPE_CAREFUL_MOVEMENTS,
  getBaselineStep1ResultSlots,
  PRIMARY_TYPE_RECOMMENDED_MOVES,
  PRIMARY_TYPE_LIFESTYLE_HABITS,
  PRIMARY_TYPE_EXERCISE_ORDER_PREVIEW,
  PRIMARY_TYPE_START_HOOK,
  stripSummaryMetaSuffix,
  STEP3_HEADLINE,
  STEP3_ORDER_PREVIEW_SECTION_TITLE,
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
  confidenceNote?: string;
}

const STAGE_META: Record<PublicResultStage, { titlePrefix: string; provenanceCopy: string }> = {
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
  const variant = action.variant ?? 'ghost';
  const base = 'w-full min-h-[48px] rounded-lg text-sm font-medium transition-all';
  if (variant === 'primary') {
    return (
      <button
        type="button"
        onClick={action.onClick}
        className={`${base} bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.06)] hover:brightness-110`}
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {action.label}
      </button>
    );
  }
  if (variant === 'secondary') {
    return (
      <button
        type="button"
        onClick={action.onClick}
        className={`${base} border border-[#ffb77d]/30 text-[#c6c6cd] hover:bg-white/5`}
        style={{ fontFamily: 'var(--font-sans-noto)' }}
      >
        {action.label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={`${base} border border-white/10 text-slate-400 hover:bg-white/5`}
      style={{ fontFamily: 'var(--font-sans-noto)' }}
    >
      {action.label}
    </button>
  );
}

const stitchGlassCard = 'rounded-2xl border border-white/[0.06] bg-[#151b2d]/45 px-4 py-3 backdrop-blur-sm';

export function PublicResultRenderer({
  result,
  stage,
  cameraEvidenceQuality,
  onBack,
  actions = [],
}: PublicResultRendererProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const pt = result.primary_type as UnifiedPrimaryType;
  const typeColor = PRIMARY_TYPE_COLOR[pt] ?? 'var(--mr-public-accent)';
  const stageMeta = STAGE_META[stage];
  const step1Slots = getBaselineStep1ResultSlots(pt);
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
  const secondaryTendencyLine = buildSecondaryTendencySentence(result.secondary_type, pt);
  const step3OrderFitLine = STEP3_ORDER_FIT_BY_PRIMARY[pt] ?? STEP3_ORDER_FIT_BY_PRIMARY.UNKNOWN;
  const carefulFitLine = CAREFUL_FIT_BY_PRIMARY[pt] ?? CAREFUL_FIT_BY_PRIMARY.UNKNOWN;

  const primaryAction = actions[0];
  const restActions = actions.slice(1);

  return (
    <div className="flex min-h-0 w-full max-w-md flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 pb-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-[#ffb77d]"
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6 text-[#ffb77d]" />
          </button>
        ) : (
          <span className="w-10 shrink-0" />
        )}
        <p
          className="min-w-0 max-w-[200px] break-keep text-right text-[10px] text-slate-500"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {headerHint}
        </p>
      </div>

      <StitchSceneProgressRail current={step} total={3} className="pb-3 pt-0" />

      {stage === 'fallback' && (
        <div className="mb-3 shrink-0 rounded-xl border border-[#ffb77d]/25 bg-[#ffb77d]/10 px-3 py-2">
          <p className="break-keep text-xs text-[#fce9dc]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {STAGE_META.fallback.provenanceCopy}
          </p>
        </div>
      )}

      {step === 1 && (
        <BaselineResultStep1
          titlePrefix={stageMeta.titlePrefix}
          typeName={step1Slots.typeName}
          typeAccentColor={typeColor}
          secondaryTendencyLine={secondaryTendencyLine}
          summary={step1Slots.summary}
          patternToWatch={step1Slots.patternToWatch}
          todayCaution={step1Slots.todayCaution}
          firstResetDirection={step1Slots.firstResetDirection}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <BaselineResultStep2
          summaryBody={summaryBody}
          reasonInsightLines={reasonInsightLines}
          refinementShiftLine={refinementShiftLine}
          missingHintLine={missingHintLine}
          careful={careful}
          carefulHeading="일상에서 조심하면 좋은 점"
          carefulFitLine={carefulFitLine}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <BaselineResultStep3
          footer={
            <div className="space-y-3">
              <MoveReStepNavRow
                left={
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex h-[52px] w-full items-center justify-center rounded-lg border border-[#ffb77d]/25 text-sm font-medium text-[#c6c6cd] transition-colors hover:bg-white/5"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    이전
                  </button>
                }
                right={
                  primaryAction ? (
                    <button
                      type="button"
                      onClick={primaryAction.onClick}
                      className="flex h-[52px] w-full items-center justify-center rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-sm font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      {primaryAction.label}
                    </button>
                  ) : (
                    <span className="min-h-[52px] w-full" aria-hidden />
                  )
                }
              />
              {restActions.length > 0 ? (
                <div className="space-y-3">
                  {restActions.map((action, i) => (
                    <ActionButton key={i} action={action} />
                  ))}
                </div>
              ) : null}
            </div>
          }
        >
          <h2
            className="break-keep text-lg font-semibold text-[#dce1fb]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {STEP3_HEADLINE}
          </h2>
          {stage === 'refined' ? (
            <p className="break-keep text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_REFINED_CONTEXT_LINE}
            </p>
          ) : null}
          <p className="break-keep text-sm leading-relaxed text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {hook}
          </p>
          <p
            className="break-keep text-[11px] leading-relaxed text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {step3OrderFitLine}
          </p>

          <div className="space-y-3 rounded-2xl border border-[#ffb77d]/25 bg-[#151b2d]/50 p-4 backdrop-blur-md">
            <div>
              <p className="text-sm font-bold text-[#ffb77d]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {STEP3_ORDER_PREVIEW_SECTION_TITLE}
              </p>
              <p
                className="mt-1.5 break-keep text-[11px] leading-relaxed text-slate-500"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {STEP3_PREVIEW_DISCLAIMER}
              </p>
            </div>
            <ol className="list-none space-y-3">
              {([0, 1, 2] as const).map((i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] text-xs font-bold text-[#4d2600]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                      {EXECUTION_ORDER_PHASE_TITLES[i]}
                    </p>
                    <p
                      className="mt-0.5 break-keep text-sm leading-relaxed text-[#dce1fb]"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      {order[i]}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className={stitchGlassCard}>
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              실행을 시작하면
            </p>
            <ul className="mt-2 space-y-2">
              {STEP3_VALUE_PILLARS.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 break-keep text-sm leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  <span className="shrink-0 text-[#ffb77d]" aria-hidden>
                    ·
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={stitchGlassCard}>
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_RECOMMENDED_SECTION_TITLE}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-[#dce1fb]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              <li>· {rec[0]}</li>
              <li>· {rec[1]}</li>
            </ul>
          </div>

          <div className={stitchGlassCard}>
            <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_LIFESTYLE_SECTION_TITLE}
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              <li>· {life[0]}</li>
              <li>· {life[1]}</li>
              <li>· {life[2]}</li>
            </ul>
          </div>

          <p
            className="break-keep px-1 text-center text-[10px] text-slate-600"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {stageMeta.provenanceCopy}
          </p>
        </BaselineResultStep3>
      )}
    </div>
  );
}
