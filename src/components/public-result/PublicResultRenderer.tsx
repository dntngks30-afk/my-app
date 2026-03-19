'use client';

/**
 * PR-V2-06 — Unified Public Result Renderer
 *
 * UnifiedDeepResultV2를 소비하는 공유 결과 렌더러.
 * baseline / refined / fallback 세 stage를 하나의 컴포넌트로 처리한다.
 *
 * ─── 계약 원칙 ────────────────────────────────────────────────────────────────
 * - 입력은 항상 UnifiedDeepResultV2 (SSOT)
 * - stage prop으로 단계 분기 (단계별 copy/badge만 다름, 분류 체계는 동일)
 * - 동물 이름 / camera-only taxonomy가 headline identity로 노출되지 않음
 * - CTA는 props로 주입 — renderer는 routing을 모름
 * - FLOW-01/02에서 persistence-loaded 결과를 주입할 준비 완료
 *   (renderer가 route 가정 없이 순수 UnifiedDeepResultV2만 소비하므로)
 *
 * ─── Stage 별 차이 ──────────────────────────────────────────────────────────
 * baseline : "기초 분석 결과" / "설문 기반 기초 분석입니다."
 * refined  : "동작 분석 포함 결과" / camera evidence quality 배지 추가
 * fallback : "설문 기반 기초 분석" / 카메라 신호 제한 경고 추가
 *
 * ─── V2-07~09 경계 ──────────────────────────────────────────────────────────
 * legacy /movement-test/result (animal renderer)는 이 컴포넌트와 무관하게 남아있다.
 * V2-07~09에서 정리 예정.
 *
 * @see src/components/public-result/public-result-labels.ts (레이블 SSOT)
 * @see src/lib/result/deep-result-v2-contract.ts (계약 SSOT)
 */

import { ChevronLeft } from 'lucide-react';
import type { UnifiedDeepResultV2, UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import {
  PRIMARY_TYPE_LABELS,
  PRIMARY_TYPE_COLOR,
  PRIMARY_TYPE_BRIEF,
  EVIDENCE_LEVEL_LABELS,
  CAMERA_QUALITY_LABELS,
  AXIS_LABELS,
  REASON_CODE_LABELS,
  MISSING_SIGNAL_LABELS,
  filterDisplayableMissingSignals,
} from './public-result-labels';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const ACCENT = '#ff7b00';

// ─── 공개 타입 ───────────────────────────────────────────────────────────────

/**
 * 렌더링 단계:
 * - baseline : 설문만으로 생성된 기초 분석
 * - refined  : baseline + camera evidence fusion 완료
 * - fallback : camera 신호 불충분으로 baseline만 표시 (refined page에서 사용)
 *
 * 향후 FLOW-01/02에서 persistence-loaded result가 들어올 때도
 * 동일 stage 값을 재사용 가능하다.
 */
export type PublicResultStage = 'baseline' | 'refined' | 'fallback';

/** CTA 버튼 정의 */
export interface PublicResultAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * PublicResultRenderer props
 *
 * 최소 surface — routing 로직을 포함하지 않는다.
 * actions는 parent page가 routing-aware하게 주입한다.
 */
export interface PublicResultRendererProps {
  /** UnifiedDeepResultV2 계약 준수 결과 객체 */
  result: UnifiedDeepResultV2;
  /** 렌더 단계 */
  stage: PublicResultStage;
  /** camera evidence quality (refined stage에서만 사용) */
  cameraEvidenceQuality?: 'strong' | 'partial' | 'minimal';
  /** 뒤로가기 핸들러 (있으면 상단 nav 표시) */
  onBack?: () => void;
  /** CTA 버튼 목록 (순서대로 렌더링) */
  actions?: PublicResultAction[];
  /** 신뢰도 부연 설명 (stage별로 parent가 제공) */
  confidenceNote?: string;
}

// ─── Stage 별 메타 ────────────────────────────────────────────────────────────

const STAGE_META: Record<PublicResultStage, {
  titlePrefix: string;
  provenanceCopy: string;
}> = {
  baseline: {
    titlePrefix:   '기초 분석 결과',
    provenanceCopy: '설문 기반 기초 분석입니다. 카메라 동작 분석으로 정밀도를 높일 수 있습니다.',
  },
  refined: {
    titlePrefix:   '동작 분석 포함 결과',
    provenanceCopy: '설문 기반 기초 분석 + 카메라 동작 분석이 융합된 결과입니다.',
  },
  fallback: {
    titlePrefix:   '설문 기반 기초 분석',
    provenanceCopy: '카메라 신호가 충분하지 않아 설문 기반 결과만 표시됩니다. 다시 촬영하면 더 정밀한 분석이 가능합니다.',
  },
};

// ─── 내부 시각 컴포넌트 ───────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f97316';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-slate-400 shrink-0">{pct}%</span>
    </div>
  );
}

function PriorityVectorBars({ vector }: { vector: Record<string, number> }) {
  const sorted = Object.entries(vector).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="space-y-2">
      {sorted.map(([axis, val]) => (
        <div key={axis} className="flex items-center gap-3">
          <span className="text-xs text-slate-400 shrink-0" style={{ minWidth: 80 }}>
            {AXIS_LABELS[axis] ?? axis}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.round(val * 100)}%`, backgroundColor: ACCENT }}
            />
          </div>
          <span className="text-xs text-slate-500 shrink-0 w-8 text-right">
            {Math.round(val * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReasonCodeChips({ codes }: { codes: string[] }) {
  const labels = codes.map((c) => REASON_CODE_LABELS[c]).filter(Boolean) as string[];
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => (
        <span key={i} className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-300">
          {label}
        </span>
      ))}
    </div>
  );
}

function ActionButton({ action }: { action: PublicResultAction }) {
  const base = 'w-full min-h-[44px] rounded-2xl font-medium transition-colors text-sm';
  const styles: Record<NonNullable<PublicResultAction['variant']>, string> = {
    primary:   `${base} font-bold text-slate-900`,
    secondary: `${base} text-slate-300 border border-white/20 hover:bg-white/5`,
    ghost:     `${base} text-slate-400 border border-white/10 hover:bg-white/5`,
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

// ─── 공개 컴포넌트 ────────────────────────────────────────────────────────────

/**
 * PublicResultRenderer
 *
 * UnifiedDeepResultV2를 stage-aware하게 렌더링하는 공유 컴포넌트.
 *
 * 사용처:
 * - /movement-test/baseline  (stage='baseline')
 * - /movement-test/refined   (stage='refined' | stage='fallback')
 * - 향후 FLOW-01/02 loaded result 표면
 */
export function PublicResultRenderer({
  result,
  stage,
  cameraEvidenceQuality,
  onBack,
  actions = [],
  confidenceNote,
}: PublicResultRendererProps) {
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type as UnifiedPrimaryType] ?? result.primary_type;
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type as UnifiedPrimaryType] ?? ACCENT;
  const evidenceLevelLabel = EVIDENCE_LEVEL_LABELS[result.evidence_level] ?? result.evidence_level;
  const stageMeta = STAGE_META[stage];
  const displayableMissingSignals = filterDisplayableMissingSignals(result.missing_signals);

  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">

      {/* 상단 헤더 행: back + 배지 */}
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
            {stage}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
            {evidenceLevelLabel}
          </span>
          {stage === 'refined' && cameraEvidenceQuality && (
            <span
              className="text-xs px-2 py-0.5 rounded-full text-slate-300"
              style={{ backgroundColor: `${typeColor}20` }}
            >
              {CAMERA_QUALITY_LABELS[cameraEvidenceQuality] ?? cameraEvidenceQuality}
            </span>
          )}
          {stage === 'fallback' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
              카메라 신호 제한
            </span>
          )}
        </div>
      </div>

      {/* 타이틀 */}
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
        {result.secondary_type && result.secondary_type !== result.primary_type && (
          <p className="text-sm text-slate-400 mt-1" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            보조: {PRIMARY_TYPE_LABELS[result.secondary_type as UnifiedPrimaryType] ?? result.secondary_type}
          </p>
        )}
      </div>

      {/* 요약 */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {result.summary_copy}
        </p>
      </div>

      {/* 신뢰도 */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2">
        <p className="text-xs text-slate-500">분석 신뢰도</p>
        <ConfidenceBar confidence={result.confidence} />
        {stage === 'refined' && cameraEvidenceQuality === 'partial' && (
          <p className="text-xs text-amber-400">카메라 일부 구간 신호 기반 분석입니다.</p>
        )}
        {confidenceNote && (
          <p className="text-xs text-slate-600">{confidenceNote}</p>
        )}
      </div>

      {/* Priority Vector */}
      {result.priority_vector && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
          <p className="text-xs text-slate-500">움직임 축별 신호 강도</p>
          <PriorityVectorBars vector={result.priority_vector} />
        </div>
      )}

      {/* 분류 근거 */}
      {result.reason_codes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">분류 근거</p>
          <ReasonCodeChips codes={result.reason_codes} />
        </div>
      )}

      {/* 누락 신호 */}
      {displayableMissingSignals.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400 mb-1.5">추가 분석이 가능한 영역</p>
          <ul className="space-y-1">
            {displayableMissingSignals.map((s) => (
              <li key={s} className="text-xs text-slate-400">
                {MISSING_SIGNAL_LABELS[s]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* fallback 경고 */}
      {stage === 'fallback' && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-400 break-keep">
            {stageMeta.provenanceCopy}
          </p>
        </div>
      )}

      {/* 출처/단계 안내 (baseline/refined) */}
      {stage !== 'fallback' && (
        <p className="text-xs text-slate-600 text-center break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {stageMeta.provenanceCopy}
        </p>
      )}

      {/* CTA 버튼 */}
      {actions.length > 0 && (
        <div className="space-y-3 pb-8">
          {actions.map((action, i) => (
            <ActionButton key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
