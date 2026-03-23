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
  MoveRePrimaryCTA,
  MoveReProgressRail,
  MoveReSecondaryCTA,
  MoveReStepNavRow,
  MoveReSurfaceCard,
} from '@/components/public-brand';
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
  const base = 'w-full min-h-[48px] rounded-[var(--mr-public-radius-cta)] font-medium transition-colors text-sm';
  const styles: Record<NonNullable<PublicResultAction['variant']>, string> = {
    primary: `${base} font-bold text-slate-900`,
    secondary: `${base} text-slate-300 border border-white/20 hover:bg-white/5`,
    ghost: `${base} text-slate-400 border border-white/10 hover:bg-white/5`,
  };
  const variant = action.variant ?? 'ghost';
  const className = styles[variant];
  const inlineStyle = variant === 'primary' ? { backgroundColor: 'var(--mr-public-accent)' } : undefined;

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

function ResultStepFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-white/[0.06] bg-[var(--mr-public-bg-base)]/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
      {children}
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
  const typeColor = PRIMARY_TYPE_COLOR[pt] ?? 'var(--mr-public-accent)';
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

  const primaryAction = actions[0];
  const restActions = actions.slice(1);

  return (
    <div className="flex min-h-0 w-full max-w-md flex-1 flex-col animate-in fade-in">
      {/* 상단: 뒤로 · 힌트 */}
      <div className="flex shrink-0 items-center justify-between gap-2 pb-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="뒤로"
          >
            <ChevronLeft className="size-6 text-[var(--mr-public-accent)]" />
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

      <MoveReProgressRail current={step} total={3} className="px-0 pt-0 pb-3" weight="micro" />

      {stage === 'fallback' && (
        <div className="mb-3 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="break-keep text-xs text-amber-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {STAGE_META.fallback.provenanceCopy}
          </p>
        </div>
      )}

      {/* ── Step 1 ── */}
      {step === 1 && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pt-1">
            <MoveReSurfaceCard className="space-y-4 p-4">
              <div>
                <p className="mb-1 text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  {stageMeta.titlePrefix}
                </p>
                <h1
                  className="break-keep text-2xl font-bold"
                  style={{ color: typeColor, fontFamily: 'var(--font-sans-noto)' }}
                >
                  {typeLabel}
                </h1>
                {secondaryTendencyLine ? (
                  <p className="mt-1 text-sm text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    {secondaryTendencyLine}
                  </p>
                ) : null}
              </div>
              <p
                className="break-keep text-sm leading-relaxed text-slate-300"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {brief}
              </p>
            </MoveReSurfaceCard>
            <MoveReSurfaceCard className="px-4 py-3">
              <ul className="space-y-2.5">
                {bullets.map((line, i) => (
                  <li
                    key={i}
                    className="relative break-keep pl-3 text-sm leading-relaxed text-slate-300 before:absolute before:left-0 before:text-[var(--mr-public-accent)] before:content-['•']"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </MoveReSurfaceCard>
          </div>
          <ResultStepFooter>
            <MoveReStepNavRow
              right={
                <MoveRePrimaryCTA type="button" onClick={() => setStep(2)} className="w-full">
                  다음 — 왜 이런 패턴인지 보기
                </MoveRePrimaryCTA>
              }
            />
          </ResultStepFooter>
        </>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pt-1">
            <h2 className="break-keep text-lg font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              왜 이런 패턴이 보이기 쉬운가요?
            </h2>
            <p
              className="break-keep text-sm leading-relaxed text-slate-300"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {summaryBody}
            </p>
            {reasonInsightLines.length > 0 ? (
              <MoveReSurfaceCard className="px-3 py-2.5">
                <ul className="space-y-1.5">
                  {reasonInsightLines.map((line, i) => (
                    <li
                      key={i}
                      className="relative break-keep pl-3 text-xs leading-relaxed text-slate-400 before:absolute before:left-0 before:text-[var(--mr-public-accent)] before:content-['·']"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </MoveReSurfaceCard>
            ) : null}
            {refinementShiftLine ? (
              <p className="break-keep text-xs leading-relaxed text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
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
            <MoveReSurfaceCard className="space-y-2 p-4">
              <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                일상에서 조심하면 좋은 점
              </h3>
              <ul className="space-y-2">
                {careful.slice(0, 4).map((line, i) => (
                  <li
                    key={i}
                    className="break-keep border-l-2 border-white/15 pl-3 text-sm leading-relaxed text-slate-400"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <p className="break-keep text-[11px] leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {carefulFitLine}
              </p>
            </MoveReSurfaceCard>
          </div>
          <ResultStepFooter>
            <MoveReStepNavRow
              left={
                <MoveReSecondaryCTA type="button" onClick={() => setStep(1)} className="w-full min-h-[52px]">
                  이전
                </MoveReSecondaryCTA>
              }
              right={
                <MoveRePrimaryCTA type="button" onClick={() => setStep(3)} className="w-full">
                  다음 — 시작 순서 보기
                </MoveRePrimaryCTA>
              }
            />
          </ResultStepFooter>
        </>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pt-1">
            <h2 className="break-keep text-lg font-bold text-slate-100" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {STEP3_HEADLINE}
            </h2>
            {stage === 'refined' ? (
              <p className="break-keep text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {STEP3_REFINED_CONTEXT_LINE}
              </p>
            ) : null}
            <p className="break-keep text-sm leading-relaxed text-slate-300" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {hook}
            </p>
            <p
              className="break-keep text-[11px] leading-relaxed text-slate-500"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {step3OrderFitLine}
            </p>

            <div className="mr-public-panel-accent space-y-3 rounded-[var(--mr-public-radius-card)] p-4">
              <div>
                <p className="text-sm font-bold mr-public-text-accent" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                  시작 순서 미리보기
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
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-slate-900"
                      style={{ backgroundColor: 'var(--mr-public-accent)' }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                        {EXECUTION_ORDER_PHASE_TITLES[i]}
                      </p>
                      <p
                        className="mt-0.5 break-keep text-sm leading-relaxed text-slate-100"
                        style={{ fontFamily: 'var(--font-sans-noto)' }}
                      >
                        {order[i]}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <MoveReSurfaceCard className="space-y-2 px-4 py-3">
              <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                실행을 시작하면
              </p>
              <ul className="space-y-2">
                {STEP3_VALUE_PILLARS.map((line, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 break-keep text-sm leading-relaxed text-slate-300"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    <span className="mr-public-text-accent shrink-0" aria-hidden>
                      ·
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </MoveReSurfaceCard>

            <MoveReSurfaceCard className="space-y-2 px-4 py-3">
              <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {STEP3_RECOMMENDED_SECTION_TITLE}
              </p>
              <ul className="space-y-1.5 text-sm text-slate-200" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                <li>· {rec[0]}</li>
                <li>· {rec[1]}</li>
              </ul>
            </MoveReSurfaceCard>

            <MoveReSurfaceCard className="space-y-2 px-4 py-3">
              <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {STEP3_LIFESTYLE_SECTION_TITLE}
              </p>
              <ul className="space-y-1.5 text-sm text-slate-300" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                <li>· {life[0]}</li>
                <li>· {life[1]}</li>
                <li>· {life[2]}</li>
              </ul>
            </MoveReSurfaceCard>

            <p
              className="break-keep px-1 text-center text-[10px] text-slate-600"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {stageMeta.provenanceCopy}
            </p>
          </div>

          <ResultStepFooter>
            <div className="space-y-3">
              <MoveReStepNavRow
                left={
                  <MoveReSecondaryCTA type="button" onClick={() => setStep(2)} className="w-full min-h-[52px]">
                    이전
                  </MoveReSecondaryCTA>
                }
                right={
                  primaryAction ? (
                    <MoveRePrimaryCTA type="button" onClick={primaryAction.onClick} className="w-full">
                      {primaryAction.label}
                    </MoveRePrimaryCTA>
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
          </ResultStepFooter>
        </>
      )}
    </div>
  );
}
