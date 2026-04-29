'use client';

/**
 * PR-V2-04 / PR-V2-06 — Baseline 결과 (PublicResultRenderer)
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import { PublicResultRenderer } from '@/components/public-result/PublicResultRenderer';
import { persistPublicResult } from '@/lib/public-results/persistPublicResult';
import { loadPublicResultHandoff } from '@/lib/public-results/public-result-handoff';
import { loadPublicResult } from '@/lib/public-results/loadPublicResult';
import { useExecutionStartBridge } from '@/lib/public-results/useExecutionStartBridge';
import { loadCompletedSurveyAnswersCache } from '@/lib/public/survey-session-cache';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';

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

        const answers = loadCompletedSurveyAnswersCache();
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
      <StitchSceneShell>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            분석 중...
          </p>
        </div>
      </StitchSceneShell>
    );
  }

  if (error || !baseline) {
    return (
      <StitchSceneShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="mb-4 text-center text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {error ?? '결과를 불러오지 못했습니다.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/movement-test/survey')}
            className="text-sm text-[#c6c6cd] underline"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            설문으로 돌아가기
          </button>
        </div>
      </StitchSceneShell>
    );
  }

  return (
    <StitchSceneShell>
      <main className="flex min-h-0 flex-1 flex-col px-5 py-6">
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col space-y-3">
          <PublicResultRenderer
            result={baseline.result}
            stage="baseline"
            onBack={recoveredFromDb ? undefined : handleBackToBridge}
            actions={[
              {
                label: bridgePending ? '처리 중...' : '움직임 리셋 시작하기',
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
            <p className="text-center text-sm text-[#fcb973]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {bridgeError}
            </p>
          )}
        </div>
      </main>
    </StitchSceneShell>
  );
}
