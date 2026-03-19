'use client';

/**
 * PR-V2-04 — Baseline Summary Gate + Baseline-Only Renderer
 *
 * Survey 완료 후 old free result 직행 경로 대신 이 페이지로 진입한다.
 *
 * 두 단계(view):
 *   1. 'gate'  — 기본 분석 요약 + CTA 분기
 *                 A. 기본 결과 보기 → view='result'
 *                 B. 카메라로 정밀 분석 → /movement-test/camera
 *   2. 'result' — Baseline Deep Result V2 전체 렌더
 *
 * ─── 결과 타입 표시 규칙 ───────────────────────────────────────────────────
 * 표시 타입은 반드시 UnifiedDeepResultV2 기반 어휘 사용.
 * legacy animal type(거북이/캥거루 등)은 절대 headline identity로 사용 안 함.
 * _compat 필드에 내부 보존만 허용 (V2-07~09 정리 예정).
 *
 * @see src/lib/deep-v2/builders/build-free-survey-baseline.ts (V2-03 builder)
 * @see src/lib/result/deep-result-v2-contract.ts
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';
import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import type { TestAnswerValue } from '@/features/movement-test/v2';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'movementTestSession:v2';
const BG = '#0d161f';
const ACCENT = '#ff7b00';

// ─── Deep Result V2 어휘 → 한국어 표시 ───────────────────────────────────────

/**
 * UnifiedPrimaryType → 표시 레이블 (Deep Result V2 어휘 기반)
 * 동물 이름 사용 금지 — paid-deep-style 어휘 사용.
 */
const PRIMARY_TYPE_LABELS: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체 안정성 패턴',
  LOWER_MOBILITY_RESTRICTION: '하체 가동성 제한',
  UPPER_IMMOBILITY:           '상체 가동성 제한',
  CORE_CONTROL_DEFICIT:       '체간 조절 패턴',
  DECONDITIONED:              '복합 재조정 패턴',
  STABLE:                     '균형형',
  UNKNOWN:                    '분석 정보 부족',
};

/**
 * UnifiedPrimaryType → 간략 설명
 */
const PRIMARY_TYPE_BRIEF: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '하체의 안정성 신호가 가장 두드러집니다.',
  LOWER_MOBILITY_RESTRICTION: '발목·고관절의 가동 범위 제한 신호가 나타납니다.',
  UPPER_IMMOBILITY:           '흉추·어깨의 가동성 제한 신호가 나타납니다.',
  CORE_CONTROL_DEFICIT:       '허리·골반 조절 패턴 신호가 가장 두드러집니다.',
  DECONDITIONED:              '복수 부위에서 동시에 신호가 나타납니다.',
  STABLE:                     '전반적으로 균형이 잡힌 움직임 패턴입니다.',
  UNKNOWN:                    '충분한 신호를 얻지 못했습니다.',
};

/** evidence_level → 배지 레이블 */
const EVIDENCE_LEVEL_LABELS: Record<string, string> = {
  lite:    '기초 분석',
  partial: '부분 분석',
  full:    '정밀 분석',
};

/** UnifiedPrimaryType → accent 색상 */
const PRIMARY_TYPE_COLOR: Record<UnifiedPrimaryType, string> = {
  LOWER_INSTABILITY:          '#60a5fa', // blue-400
  LOWER_MOBILITY_RESTRICTION: '#34d399', // emerald-400
  UPPER_IMMOBILITY:           '#a78bfa', // violet-400
  CORE_CONTROL_DEFICIT:       '#f97316', // orange-500
  DECONDITIONED:              '#fb923c', // orange-400
  STABLE:                     '#4ade80', // green-400
  UNKNOWN:                    '#94a3b8', // slate-400
};

/** priority_vector 축 → 한국어 레이블 */
const AXIS_LABELS: Record<string, string> = {
  lower_stability: '하체 안정성',
  lower_mobility:  '하체 가동성',
  upper_mobility:  '상체 가동성',
  trunk_control:   '체간 조절',
  asymmetry:       '좌우 균형',
  deconditioned:   '전신 조건화',
};

/** reason_code → 간략 설명 */
const REASON_CODE_LABELS: Record<string, string> = {
  top_axis_lower_stability:   '하체 안정성 신호 강함',
  top_axis_lower_mobility:    '하체 가동성 제한 신호',
  top_axis_upper_mobility:    '상체 가동성 제한 신호',
  top_axis_trunk_control:     '체간 조절 신호 강함',
  top_axis_asymmetry:         '좌우 비대칭 신호',
  secondary_axis_lower_stability:   '하체 안정성 보조 신호',
  secondary_axis_lower_mobility:    '하체 가동성 보조 신호',
  secondary_axis_upper_mobility:    '상체 가동성 보조 신호',
  secondary_axis_trunk_control:     '체간 조절 보조 신호',
  secondary_axis_asymmetry:         '비대칭 보조 신호',
  stable_gate:                '균형형 판정',
  deconditioned_gate:         '복합 패턴 판정',
  asymmetry_detected:         '좌우 비대칭 감지',
  lumbar_dominant_pattern:    '허리 주도 패턴',
  thoracic_closure_pattern:   '흉추 닫힘 패턴',
  lateral_imbalance_pattern:  '측면 불균형 패턴',
  anterior_head_pattern:      '경추 전방화 패턴',
  ankle_mobility_restriction: '발목 가동성 제한',
  global_bracing_pattern:     '전신 긴장 패턴',
  balanced_movement_pattern:  '균형 움직임 패턴',
  composite_pattern:          '복합 패턴 감지',
};

// ─── localStorage 헬퍼 ───────────────────────────────────────────────────────

interface StoredSessionV2 {
  version: string;
  isCompleted: boolean;
  answersById: Record<string, TestAnswerValue>;
}

function loadSurveyAnswers(): Record<string, TestAnswerValue> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: StoredSessionV2 = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    if (!data.isCompleted) return null;
    return data.answersById ?? {};
  } catch {
    return null;
  }
}

// ─── 신뢰도 바 ───────────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 80 ? '#4ade80' :
    pct >= 60 ? '#facc15' :
    '#f97316';
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

// ─── Priority Vector 바 ──────────────────────────────────────────────────────

function PriorityVectorBars({
  vector,
}: {
  vector: Record<string, number>;
}) {
  const sorted = Object.entries(vector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // top 5 축만 표시

  return (
    <div className="space-y-2">
      {sorted.map(([axis, val]) => {
        const pct = Math.round(val * 100);
        return (
          <div key={axis} className="flex items-center gap-3">
            <span
              className="text-xs text-slate-400 shrink-0"
              style={{ minWidth: 80 }}
            >
              {AXIS_LABELS[axis] ?? axis}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: ACCENT }}
              />
            </div>
            <span className="text-xs text-slate-500 shrink-0 w-8 text-right">
              {pct}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Reason Codes 표시 ────────────────────────────────────────────────────────

function ReasonCodeChips({ codes }: { codes: string[] }) {
  const labels = codes
    .map((c) => REASON_CODE_LABELS[c])
    .filter(Boolean) as string[];
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label, i) => (
        <span
          key={i}
          className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-300"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// ─── Baseline Gate 뷰 ────────────────────────────────────────────────────────

function BaselineGateView({
  baseline,
  onViewResult,
  onCamera,
}: {
  baseline: FreeSurveyBaselineResult;
  onViewResult: () => void;
  onCamera: () => void;
}) {
  const { result, baseline_meta } = baseline;
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type] ?? result.primary_type;
  const typeBrief = PRIMARY_TYPE_BRIEF[result.primary_type] ?? '';
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type] ?? ACCENT;
  const evidenceLabel = EVIDENCE_LEVEL_LABELS[result.evidence_level] ?? result.evidence_level;

  return (
    <div className="w-full max-w-md space-y-6 animate-in fade-in">
      {/* 헤더 */}
      <div className="text-center space-y-1">
        <p
          className="text-xs text-slate-500 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {evidenceLabel} · {baseline_meta.result_stage}
        </p>
        <h1
          className="text-2xl font-bold text-slate-100 break-keep"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          기본 분석이 준비되었습니다
        </h1>
      </div>

      {/* 타입 카드 */}
      <div
        className="rounded-2xl border p-5 space-y-3"
        style={{ borderColor: `${typeColor}40`, backgroundColor: `${typeColor}08` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500 mb-1">주요 패턴</p>
            <p
              className="text-xl font-bold break-keep"
              style={{ color: typeColor, fontFamily: 'var(--font-sans-noto)' }}
            >
              {typeLabel}
            </p>
          </div>
          {result.secondary_type && result.secondary_type !== result.primary_type && (
            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500 mb-1">보조</p>
              <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                {PRIMARY_TYPE_LABELS[result.secondary_type] ?? result.secondary_type}
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {typeBrief}
        </p>
        <div className="pt-1">
          <p className="text-xs text-slate-500 mb-1.5">분석 신뢰도</p>
          <ConfidenceBar confidence={result.confidence} />
        </div>
      </div>

      {/* 요약 문구 */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {result.summary_copy}
        </p>
      </div>

      {/* baseline 안내 */}
      <p className="text-xs text-slate-500 text-center break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        설문 기반 기초 분석입니다. 카메라 동작 테스트로 더 정밀하게 확인할 수 있습니다.
      </p>

      {/* CTA 버튼 */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={onCamera}
          className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
          style={{
            backgroundColor: ACCENT,
            fontFamily: 'var(--font-sans-noto)',
          }}
        >
          카메라로 더 정밀하게 분석하기
        </button>
        <button
          type="button"
          onClick={onViewResult}
          className="w-full min-h-[48px] rounded-2xl font-medium text-slate-300 border border-white/20 hover:bg-white/5 transition-colors"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          지금 기본 결과 보기
        </button>
      </div>
    </div>
  );
}

// ─── Baseline Result 뷰 ───────────────────────────────────────────────────────

function BaselineResultView({
  baseline,
  onBack,
  onCamera,
  onRetake,
}: {
  baseline: FreeSurveyBaselineResult;
  onBack: () => void;
  onCamera: () => void;
  onRetake: () => void;
}) {
  const { result, baseline_meta } = baseline;
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type] ?? result.primary_type;
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type] ?? ACCENT;
  const evidenceLabel = EVIDENCE_LEVEL_LABELS[result.evidence_level] ?? result.evidence_level;

  return (
    <div className="w-full max-w-md space-y-5 animate-in fade-in">
      {/* 상단 네비 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          <ChevronLeft className="size-4" />
          뒤로
        </button>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {baseline_meta.result_stage}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-400"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {evidenceLabel}
          </span>
        </div>
      </div>

      {/* 타이틀 */}
      <div>
        <p className="text-xs text-slate-500 mb-1">기초 분석 결과</p>
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
        <p className="text-xs text-slate-600">
          설문 응답 완성도 및 축별 신호 격차 기반 계산
        </p>
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

      {/* 누락 신호 안내 */}
      {result.missing_signals.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-xs text-amber-400 mb-1.5">추가 분석이 가능한 영역</p>
          <ul className="space-y-1">
            {result.missing_signals
              .filter((s) => !s.includes('_empty'))
              .map((s) => (
                <li key={s} className="text-xs text-slate-400">
                  {s === 'pain_intensity_missing' && '통증 강도 정보 (유료 딥테스트에서 측정)'}
                  {s === 'pain_location_missing' && '통증 위치 정보 (유료 딥테스트에서 측정)'}
                  {s === 'objective_movement_test_missing' && '객관 동작 테스트 (카메라 분석에서 측정)'}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* baseline 안내 */}
      <p className="text-xs text-slate-600 text-center break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        이 결과는 설문 기반 기초 분석입니다.
        카메라 동작 분석으로 정밀도를 높일 수 있습니다.
      </p>

      {/* CTA */}
      <div className="space-y-3 pb-8">
        <button
          type="button"
          onClick={onCamera}
          className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors"
          style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
        >
          카메라로 더 정밀하게 분석하기
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="w-full min-h-[44px] rounded-2xl font-medium text-slate-400 border border-white/10 hover:bg-white/5 transition-colors text-sm"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          설문 다시 하기
        </button>
      </div>
    </div>
  );
}

// ─── 페이지 메인 ─────────────────────────────────────────────────────────────

type BaselineView = 'gate' | 'result';

export default function BaselinePage() {
  const router = useRouter();
  const [view, setView] = useState<BaselineView>('gate');
  const [baseline, setBaseline] = useState<FreeSurveyBaselineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // V2-03 builder를 통해 baseline 생성
  useEffect(() => {
    try {
      const answers = loadSurveyAnswers();
      if (!answers) {
        // 설문 미완성 또는 세션 없음 → 설문으로 돌아가기
        router.replace('/movement-test/survey');
        return;
      }
      const result = buildFreeSurveyBaselineResult(answers);
      setBaseline(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleViewResult = useCallback(() => setView('result'), []);
  const handleBackToGate = useCallback(() => setView('gate'), []);

  const handleCamera = useCallback(() => {
    router.push('/movement-test/camera');
  }, [router]);

  const handleRetake = useCallback(() => {
    router.push('/movement-test/survey');
  }, [router]);

  // 로딩
  if (loading) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center"
        style={{ backgroundColor: BG }}
      >
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          분석 중...
        </p>
      </div>
    );
  }

  // 에러
  if (error || !baseline) {
    return (
      <div
        className="min-h-[100svh] flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: BG }}
      >
        <p className="text-slate-400 text-sm mb-4 text-center" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {error ?? '결과를 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/movement-test/survey')}
          className="text-sm text-slate-300 underline"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
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

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        {view === 'gate' ? (
          <BaselineGateView
            baseline={baseline}
            onViewResult={handleViewResult}
            onCamera={handleCamera}
          />
        ) : (
          <BaselineResultView
            baseline={baseline}
            onBack={handleBackToGate}
            onCamera={handleCamera}
            onRetake={handleRetake}
          />
        )}
      </main>
    </div>
  );
}
