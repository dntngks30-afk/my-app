'use client';

/**
 * PR-V2-04 — Baseline Summary Gate + Baseline-Only Renderer
 * PR-V2-06 — Refactored: result view uses PublicResultRenderer
 *
 * Survey 완료 후 old free result 직행 경로 대신 이 페이지로 진입한다.
 *
 * 두 단계(view):
 *   1. 'gate'   — 기본 분석 요약 + CTA 분기
 *                 A. 기본 결과 보기 → view='result'
 *                 B. 카메라로 정밀 분석 → /movement-test/camera
 *   2. 'result' — PublicResultRenderer (stage='baseline')
 *
 * ─── 결과 타입 표시 규칙 ────────────────────────────────────────────────────
 * 표시 타입은 반드시 UnifiedDeepResultV2 기반 어휘 사용.
 * legacy animal type(거북이/캥거루 등)은 절대 headline identity로 사용 안 함.
 *
 * @see src/lib/deep-v2/builders/build-free-survey-baseline.ts (V2-03 builder)
 * @see src/components/public-result/PublicResultRenderer.tsx (V2-06 shared renderer)
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import { PublicResultRenderer } from '@/components/public-result/PublicResultRenderer';
import { persistPublicResult } from '@/lib/public-results/persistPublicResult';
import {
  PRIMARY_TYPE_LABELS,
  PRIMARY_TYPE_BRIEF,
  PRIMARY_TYPE_COLOR,
  EVIDENCE_LEVEL_LABELS,
} from '@/components/public-result/public-result-labels';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';
import type { UnifiedPrimaryType } from '@/lib/result/deep-result-v2-contract';
import type { TestAnswerValue } from '@/features/movement-test/v2';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'movementTestSession:v2';
const BG = '#0d161f';
const ACCENT = '#ff7b00';

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
  const typeLabel = PRIMARY_TYPE_LABELS[result.primary_type as UnifiedPrimaryType] ?? result.primary_type;
  const typeBrief = PRIMARY_TYPE_BRIEF[result.primary_type as UnifiedPrimaryType] ?? '';
  const typeColor = PRIMARY_TYPE_COLOR[result.primary_type as UnifiedPrimaryType] ?? ACCENT;
  const evidenceLabel = EVIDENCE_LEVEL_LABELS[result.evidence_level] ?? result.evidence_level;

  const pct = Math.round(result.confidence * 100);
  const barColor = pct >= 80 ? '#4ade80' : pct >= 60 ? '#facc15' : '#f97316';

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
                {PRIMARY_TYPE_LABELS[result.secondary_type as UnifiedPrimaryType] ?? result.secondary_type}
              </p>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-300 leading-relaxed break-keep" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          {typeBrief}
        </p>
        <div className="pt-1">
          <p className="text-xs text-slate-500 mb-1.5">분석 신뢰도</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <span className="text-xs text-slate-400 shrink-0">{pct}%</span>
          </div>
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
          style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
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

// ─── 페이지 메인 ─────────────────────────────────────────────────────────────

type BaselineView = 'gate' | 'result';

export default function BaselinePage() {
  const router = useRouter();
  const [view, setView] = useState<BaselineView>('gate');
  const [baseline, setBaseline] = useState<FreeSurveyBaselineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const answers = loadSurveyAnswers();
      if (!answers) {
        router.replace('/movement-test/survey');
        return;
      }
      const result = buildFreeSurveyBaselineResult(answers);
      setBaseline(result);

      // FLOW-01: best-effort persistence (실패해도 UX 블로킹 없음)
      persistPublicResult({
        result: result.result,
        stage: 'baseline',
        sourceInputs: Array.from(result.baseline_meta.source_inputs),
      }).then((r) => {
        if (process.env.NODE_ENV !== 'production') {
          if (r.ok) console.info('[public-result] baseline saved:', r.id);
          else console.warn('[public-result] baseline save skipped:', r.reason);
        }
      }).catch(() => { /* best-effort: ignore */ });
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleViewResult = useCallback(() => setView('result'), []);
  const handleBackToGate = useCallback(() => setView('gate'), []);
  const handleCamera = useCallback(() => router.push('/movement-test/camera'), [router]);
  const handleRetake = useCallback(() => router.push('/movement-test/survey'), [router]);

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>분석 중...</p>
      </div>
    );
  }

  if (error || !baseline) {
    return (
      <div className="min-h-[100svh] flex flex-col items-center justify-center px-6" style={{ backgroundColor: BG }}>
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
          /* V2-06: shared renderer 사용 */
          <PublicResultRenderer
            result={baseline.result}
            stage="baseline"
            onBack={handleBackToGate}
            confidenceNote="설문 응답 완성도 및 축별 신호 격차 기반 계산"
            actions={[
              {
                label: '카메라로 더 정밀하게 분석하기',
                onClick: handleCamera,
                variant: 'primary',
              },
              {
                label: '설문 다시 하기',
                onClick: handleRetake,
                variant: 'ghost',
              },
            ]}
          />
        )}
      </main>
    </div>
  );
}
