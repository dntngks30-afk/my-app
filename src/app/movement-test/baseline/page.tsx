'use client';

/**
 * PR-V2-04 / PR-V2-06 — Baseline 결과 (PublicResultRenderer)
 * PR-PUBLIC-BRIDGE-01 — 설문 완료 후 선택 브리지(/movement-test/refine-bridge) 다음에 진입.
 *
 * 이전에 이 페이지에 있던 'gate'(요약 카드 + 신뢰도 바)는 브리지로 분리됨.
 * 카메라 refine은 optional이며, /movement-test/camera → /movement-test/refined 경로 유지.
 *
 * @see src/lib/deep-v2/builders/build-free-survey-baseline.ts (V2-03 builder)
 * @see src/components/public-result/PublicResultRenderer.tsx (V2-06 shared renderer)
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { MoveReFullscreenScreen } from '@/components/public-brand';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import { PublicResultRenderer } from '@/components/public-result/PublicResultRenderer';
import { persistPublicResult } from '@/lib/public-results/persistPublicResult';
import { loadPublicResultHandoff } from '@/lib/public-results/public-result-handoff';
import { loadPublicResult } from '@/lib/public-results/loadPublicResult';
import { useExecutionStartBridge } from '@/lib/public-results/useExecutionStartBridge';
import { ResumeExecutionGate } from '@/components/public-result/ResumeExecutionGate';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';
import type { TestAnswerValue } from '@/features/movement-test/v2';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'movementTestSession:v2';
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

// ─── 페이지 메인 ─────────────────────────────────────────────────────────────

export default function BaselinePage() {
  const router = useRouter();
  const [baseline, setBaseline] = useState<FreeSurveyBaselineResult | null>(null);
  const [publicResultIdForBridge, setPublicResultIdForBridge] = useState<string | null>(null);
  const [recoveredFromDb, setRecoveredFromDb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { handleExecutionStart, isPending: bridgePending, error: bridgeError } = useExecutionStartBridge({
    publicResultId: publicResultIdForBridge,
    stage: 'baseline',
    returnPath: '/movement-test/baseline',
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const handoffId = loadPublicResultHandoff('baseline');
        if (handoffId) {
          const recovered = await loadPublicResult(handoffId);
          if (!cancelled && recovered && recovered.stage === 'baseline') {
            setRecoveredFromDb(true);
            setPublicResultIdForBridge(handoffId);
            setBaseline({
              result: recovered.result,
              baseline_meta: {
                result_stage: 'baseline',
                source_inputs: ['free_survey'] as const,
                refinement_available: true,
                generated_at: recovered.createdAt,
                // PR-SCORING-META-ALIGN: canonical deep family 기준.
                // DB에서 복구 시 과거 'free_survey_v2_core' 스탬프가 저장되어 있을 수 있으나,
                // page state은 canonical 값으로 정렬한다.
                // 실제 result._compat.scoring_version은 그대로 보존됨.
                scoring_version: 'deep_v2',
              },
            });
            if (process.env.NODE_ENV !== 'production') {
              console.info('[public-result] baseline recovered from DB:', handoffId);
            }
            return;
          }
        }

        if (cancelled) return;

        const answers = loadSurveyAnswers();
        if (!answers) {
          router.replace('/movement-test/survey');
          return;
        }
        const result = buildFreeSurveyBaselineResult(answers);
        if (!cancelled) {
          setBaseline(result);

          persistPublicResult({
            result: result.result,
            stage: 'baseline',
            sourceInputs: Array.from(result.baseline_meta.source_inputs),
          })
            .then((r) => {
              if (r.ok && !cancelled) setPublicResultIdForBridge(r.id);
              if (process.env.NODE_ENV !== 'production') {
                if (r.ok) console.info('[public-result] baseline saved:', r.id);
                else console.warn('[public-result] baseline save skipped:', r.reason);
              }
            })
            .catch(() => {
              /* best-effort */
            });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCameraRefine = useCallback(() => router.push('/movement-test/camera'), [router]);
  const handleRetake = useCallback(() => router.push('/movement-test/survey'), [router]);
  const handleBackToBridge = useCallback(() => router.push('/movement-test/refine-bridge'), [router]);

  if (loading) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            분석 중...
          </p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  if (error || !baseline) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="mb-4 text-center text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
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
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <Suspense fallback={null}>
          <ResumeExecutionGate
            enabled={!loading && !!baseline}
            returnPathClean="/movement-test/baseline"
            handleExecutionStart={handleExecutionStart}
          />
        </Suspense>
        <div className="space-y-3 w-full max-w-md">
          <PublicResultRenderer
            result={baseline.result}
            stage="baseline"
            onBack={recoveredFromDb ? undefined : handleBackToBridge}
            actions={[
              {
                label: bridgePending ? '처리 중...' : '실행 시작하기',
                onClick: handleExecutionStart,
                variant: 'primary',
              },
              {
                label: '카메라로 움직임 체크하기',
                onClick: handleCameraRefine,
                variant: 'secondary',
              },
              {
                label: '설문 다시 하기',
                onClick: handleRetake,
                variant: 'ghost',
              },
            ]}
          />
          {bridgeError && (
            <p className="text-sm text-amber-400 text-center" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {bridgeError}
            </p>
          )}
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
