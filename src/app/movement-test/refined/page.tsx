'use client';

/**
 * PR-V2-05 — Refined Result Page (Baseline + Camera Fusion)
 *
 * 카메라 완료 후 진입하는 refined Deep Result V2 결과 페이지.
 * survey baseline + camera evidence를 fuse한 결과를 표시한다.
 *
 * 이 페이지는 purpose-built이다. V2-06에서 unified public renderer로 일반화된다.
 *
 * 표시 타입:
 * - Deep Result V2 어휘 기반 (동물 이름 headline 없음)
 * - primary_type, secondary_type, priority_vector, reason_codes 기반
 * - camera evidence quality / result_stage 명시
 *
 * 폴백:
 * - baseline 없음: /movement-test/survey로 리디렉트
 * - camera 결과 없음: /movement-test/baseline으로 리디렉트
 * - fusion 실패: 보수적 baseline 결과 표시
 *
 * @see src/lib/deep-v2/builders/build-camera-refined-result.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import { buildCameraRefinedResult, type CameraRefinedResult } from '@/lib/deep-v2/builders/build-camera-refined-result';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';
import type { UnifiedPrimaryType, UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import { loadCameraResult } from '@/lib/camera/camera-result';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'movementTestSession:v2';
const BG = '#0d161f';
const ACCENT = '#ff7b00';

// ─── Deep Result V2 어휘 ──────────────────────────────────────────────────────

const PRIMARY_TYPE_LABELS: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 안정성 패턴',
  LOWER_MOBILITY_RESTRICTION: '하체 가동성 제한',
  UPPER_IMMOBILITY:           '상체 가동성 제한',
  CORE_CONTROL_DEFICIT:       '체간 조절 패턴',
  DECONDITIONED:              '복합 재조정 패턴',
  STABLE:                     '균형형',
  UNKNOWN:                    '분석 정보 부족',
};

const PRIMARY_TYPE_COLOR: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '#60a5fa',
  LOWER_MOBILITY_RESTRICTION: '#34d399',
  UPPER_IMMOBILITY:           '#a78bfa',
  CORE_CONTROL_DEFICIT:       '#f97316',
  DECONDITIONED:              '#fb923c',
  STABLE:                     '#4ade80',
  UNKNOWN:                    '#94a3b8',
};

const EVIDENCE_QUALITY_LABELS: Record<string, string> = {
  strong:  '동작 분석 확인',
  partial: '동작 분석 일부',
  minimal: '신호 제한적',
};

const EVIDENCE_LEVEL_LABELS: Record<string, string> = {
  lite:    '기초 분석',
  partial: '부분 분석',
  full:    '정밀 분석',
};

const AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정성',
  lower_mobility:  '하체 가동성',
  upper_mobility:  '상체 가동성',
  trunk_control:   '체간 조절',
  asymmetry:       '좌우 균형',
  deconditioned:   '전신 조건화',
};

const REASON_CODE_LABELS: Record<string, string> = {
  top_axis_lower_stability:   '하체 안정성 신호 강함',
  top_axis_lower_mobility:    '하체 가동성 제한 신호',
  top_axis_upper_mobility:    '상체 가동성 제한 신호',
  top_axis_trunk_control:     '체간 조절 신호 강함',
  top_axis_asymmetry:         '좌우 비대칭 신호',
  secondary_axis_lower_stability: '하체 안정성 보조 신호',
  secondary_axis_lower_mobility:  '하체 가동성 보조 신호',
  secondary_axis_upper_mobility:  '상체 가동성 보조 신호',
  secondary_axis_trunk_control:   '체간 조절 보조 신호',
  secondary_axis_asymmetry:       '비대칭 보조 신호',
  stable_gate:            '균형형 판정',
  deconditioned_gate:     '복합 패턴 판정',
  asymmetry_detected:     '좌우 비대칭 감지',
  camera_evidence_partial: '카메라 일부 신호 기반',
};

// ─── localStorage 헬퍼 ────────────────────────────────────────────────────────

function loadSurveyAnswers(): Record<string, TestAnswerValue> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    if (!data.isCompleted) return null;
    return data.answersById ?? {};
  } catch {
    return null;
  }
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f97316';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
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
            <div className="h-full rounded-full" style={{ width: `${Math.round(val * 100)}%`, backgroundColor: ACCENT }} />
          </div>
          <span className="text-xs text-slate-500 shrink-0 w-8 text-right">{Math.round(val * 100)}</span>
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

// ─── Refined Result View ──────────────────────────────────────────────────────

function RefinedResultView({
  refined,
  onRetake,
}: {
  refined: CameraRefinedResult;
  onRetake: () => void;
}) {
  const { result, refined_meta } = refined;
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type] ?? result.primary_type;
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type] ?? ACCENT;
  const evidenceLevelLabel = EVIDENCE_LEVEL_LABELS[result.evidence_level] ?? result.evidence_level;
  const qualityLabel = EVIDENCE_QUALITY_LABELS[refined_meta.camera_evidence_quality] ?? '';

  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">
      {/* 상단 배지 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
            {refined_meta.result_stage}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
            {evidenceLevelLabel}
          </span>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full text-slate-300"
          style={{ backgroundColor: `${typeColor}20` }}
        >
          {qualityLabel}
        </span>
      </div>

      {/* 타이틀 */}
      <div>
        <p className="text-xs text-slate-500 mb-1">동작 분석 포함 결과</p>
        <h1
          className="text-2xl font-bold break-keep"
          style={{ color: typeColor, fontFamily: 'var(--font-sans-noto)' }}
        >
          {typeLabel}
        </h1>
        {result.secondary_type && result.secondary_type !== result.primary_type && (
          <p className="text-sm text-slate-400 mt-1" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            보조: {PRIMARY_TYPE_LABELS[result.secondary_type] ?? result.secondary_type}
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
        {refined_meta.camera_evidence_quality === 'partial' && (
          <p className="text-xs text-amber-400">카메라 일부 구간 신호 기반 분석입니다.</p>
        )}
      </div>

      {/* Priority Vector */}
      {result.priority_vector && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
          <p className="text-xs text-slate-500">움직임 축별 신호 강도</p>
          <PriorityVectorBars vector={result.priority_vector} />
        </div>
      )}

      {/* Reason codes */}
      {result.reason_codes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">분류 근거</p>
          <ReasonCodeChips codes={result.reason_codes} />
        </div>
      )}

      {/* 누락 신호 */}
      {result.missing_signals.filter((s) => !s.includes('_empty') && !s.includes('_step_')).length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400 mb-1.5">추가 분석이 가능한 영역</p>
          <ul className="space-y-1">
            {result.missing_signals
              .filter((s) => !s.includes('_empty') && !s.includes('_step_'))
              .map((s) => (
                <li key={s} className="text-xs text-slate-400">
                  {s === 'pain_intensity_missing' && '통증 강도 정보 (유료 딥테스트에서 측정)'}
                  {s === 'pain_location_missing' && '통증 위치 정보 (유료 딥테스트에서 측정)'}
                  {s === 'camera_evidence_partial' && '카메라 신호 일부 제한 (재촬영 시 개선 가능)'}
                  {s === 'subjective_fatigue_missing' && '주관적 피로도 (설문 항목에 없음)'}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* 안내 */}
      <p className="text-xs text-slate-600 text-center break-keep">
        설문 기반 기초 분석 + 카메라 동작 분석이 융합된 결과입니다.
      </p>

      {/* CTA */}
      <div className="space-y-3 pb-8">
        <button
          type="button"
          onClick={onRetake}
          className="w-full min-h-[44px] rounded-2xl font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-colors text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          처음부터 다시 하기
        </button>
      </div>
    </div>
  );
}

// ─── Baseline Fallback View (fusion 실패 시) ──────────────────────────────────

function BaselineFallbackView({
  result,
  onRetake,
}: {
  result: UnifiedDeepResultV2;
  onRetake: () => void;
}) {
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type] ?? result.primary_type;
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type] ?? ACCENT;

  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400">baseline</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">카메라 신호 제한</span>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">설문 기반 기초 분석</p>
        <h1 className="text-2xl font-bold break-keep" style={{ color: typeColor }}>
          {typeLabel}
        </h1>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-sm text-slate-300 leading-relaxed break-keep">
          {result.summary_copy}
        </p>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <p className="text-sm text-amber-400 break-keep">
          카메라 신호가 충분하지 않아 설문 기반 결과만 표시됩니다. 다시 촬영하면 더 정밀한 분석이 가능합니다.
        </p>
      </div>
      <div className="space-y-3 pb-8">
        <button
          type="button"
          onClick={onRetake}
          className="w-full min-h-[44px] rounded-2xl font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-colors text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          처음부터 다시 하기
        </button>
      </div>
    </div>
  );
}

// ─── 페이지 메인 ─────────────────────────────────────────────────────────────

export default function RefinedResultPage() {
  const router = useRouter();
  const [refined, setRefined] = useState<CameraRefinedResult | null>(null);
  const [baselineFallback, setBaselineFallback] = useState<FreeSurveyBaselineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const surveyAnswers = loadSurveyAnswers();
      const cameraStorage = loadCameraResult();

      // 설문 없으면 → 설문으로 이동
      if (!surveyAnswers) {
        router.replace('/movement-test/survey');
        return;
      }

      // 카메라 결과 없으면 → baseline으로 이동
      if (!cameraStorage) {
        router.replace('/movement-test/baseline');
        return;
      }

      // baseline 생성 (V2-03 builder 재사용)
      const baselineResult = buildFreeSurveyBaselineResult(surveyAnswers);

      // fusion 시도
      try {
        const refinedResult = buildCameraRefinedResult(
          baselineResult.result,
          cameraStorage.result
        );
        setRefined(refinedResult);
      } catch {
        // fusion 실패 → baseline fallback 표시
        setBaselineFallback(baselineResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleRetake = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p className="text-slate-400 text-sm">분석 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center px-6" style={{ backgroundColor: BG }}>
        <p className="text-slate-400 text-sm mb-4 text-center">{error}</p>
        <button
          type="button"
          onClick={() => router.push('/movement-test/survey')}
          className="text-sm text-slate-300 underline"
        >
          설문으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      {/* 상단 네비 */}
      <header className="relative z-20 flex items-center px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="size-4" />
          뒤로
        </button>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-6 py-4">
        {refined ? (
          <RefinedResultView refined={refined} onRetake={handleRetake} />
        ) : baselineFallback ? (
          <BaselineFallbackView result={baselineFallback.result} onRetake={handleRetake} />
        ) : null}
      </main>
    </div>
  );
}
