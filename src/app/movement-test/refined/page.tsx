'use client';

/**
 * PR-V2-05 — Refined Result Page (Baseline + Camera Fusion)
 * PR-V2-06 — Refactored: result views use PublicResultRenderer
 *
 * 카메라 완료 후 진입하는 refined Deep Result V2 결과 페이지.
 * survey baseline + camera evidence를 fuse한 결과를 표시한다.
 *
 * 세 가지 상태:
 * 1. refined   — fusion 성공 → PublicResultRenderer (stage='refined')
 * 2. fallback  — camera 신호 불충분 → PublicResultRenderer (stage='fallback')
 * 3. 에러/없음 — redirect
 *
 * 폴백:
 * - baseline 없음: /movement-test/survey로 리디렉트
 * - camera 결과 없음: /movement-test/baseline으로 리디렉트
 * - fusion 실패: 보수적 baseline 결과를 fallback stage로 표시
 *
 * @see src/lib/deep-v2/builders/build-camera-refined-result.ts
 * @see src/components/public-result/PublicResultRenderer.tsx (V2-06 shared renderer)
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { MoveReFullscreenScreen } from '@/components/public-brand';
import { buildFreeSurveyBaselineResult } from '@/lib/deep-v2/builders/build-free-survey-baseline';
import { buildCameraRefinedResult, type CameraRefinedResult } from '@/lib/deep-v2/builders/build-camera-refined-result';
import { PublicResultRenderer } from '@/components/public-result/PublicResultRenderer';
import { persistPublicResult } from '@/lib/public-results/persistPublicResult';
import { loadPublicResultHandoff } from '@/lib/public-results/public-result-handoff';
import { loadPublicResult } from '@/lib/public-results/loadPublicResult';
import { useExecutionStartBridge } from '@/lib/public-results/useExecutionStartBridge';
import { ResumeExecutionGate } from '@/components/public-result/ResumeExecutionGate';
import type { FreeSurveyBaselineResult } from '@/lib/deep-v2/types';
import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';
import type { TestAnswerValue } from '@/features/movement-test/v2';
import { loadCameraResult } from '@/lib/camera/camera-result';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'movementTestSession:v2';

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

// ─── 페이지 메인 ─────────────────────────────────────────────────────────────

export default function RefinedResultPage() {
  const router = useRouter();
  const [refined, setRefined] = useState<CameraRefinedResult | null>(null);
  const [baselineFallback, setBaselineFallback] = useState<FreeSurveyBaselineResult | null>(null);
  const [publicResultIdForBridge, setPublicResultIdForBridge] = useState<string | null>(null);
  // FLOW-02: DB에서 복구된 refined result (CameraRefinedResult 래퍼 없이 직접 렌더용)
  const [recoveredRefined, setRecoveredRefined] = useState<UnifiedDeepResultV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { handleExecutionStart, isPending: bridgePending, error: bridgeError } = useExecutionStartBridge({
    publicResultId: publicResultIdForBridge,
    stage: 'refined',
    returnPath: '/movement-test/refined',
  });

  const resumeEnabled =
    !loading &&
    !error &&
    (!!refined || !!recoveredRefined || !!baselineFallback);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // FLOW-02: DB recovery 시도 (refined 결과)
        // localStorage에 handoff id가 있으면 DB에서 직접 결과를 읽는다.
        // 성공하면 camera/survey 재분석 없이 결과를 복구한다.
        const handoffId = loadPublicResultHandoff('refined');
        if (handoffId) {
          const recovered = await loadPublicResult(handoffId);
          if (!cancelled && recovered && recovered.stage === 'refined') {
            setPublicResultIdForBridge(handoffId);
            setRecoveredRefined(recovered.result);
            if (process.env.NODE_ENV !== 'production') {
              console.info('[public-result] refined recovered from DB:', handoffId);
            }
            return;
          }
        }

        if (cancelled) return;

        // FLOW-02 DB 복구 실패 → 기존 local 계산 경로
        const surveyAnswers = loadSurveyAnswers();
        const cameraStorage = loadCameraResult();

        if (!surveyAnswers) {
          router.replace('/movement-test/survey');
          return;
        }
        if (!cameraStorage) {
          router.replace('/movement-test/baseline');
          return;
        }

        const baselineResult = buildFreeSurveyBaselineResult(surveyAnswers);

        try {
          const refinedResult = buildCameraRefinedResult(
            baselineResult.result,
            cameraStorage.result
          );
          if (!cancelled) {
            setRefined(refinedResult);

            // FLOW-01: best-effort persistence — refined result
            // FLOW-02: 성공 시 savePublicResultHandoff가 내부에서 자동 호출됨
            persistPublicResult({
              result: refinedResult.result,
              stage: 'refined',
              sourceInputs: Array.from(refinedResult.refined_meta.source_inputs),
            }).then((r) => {
              if (r.ok && !cancelled) setPublicResultIdForBridge(r.id);
              if (process.env.NODE_ENV !== 'production') {
                if (r.ok) console.info('[public-result] refined saved:', r.id);
                else console.warn('[public-result] refined save skipped:', r.reason);
              }
            }).catch(() => { /* best-effort: ignore */ });
          }
        } catch {
          if (!cancelled) setBaselineFallback(baselineResult);
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
    return () => { cancelled = true; };
  }, [router]);

  const handleRetake = useCallback(() => router.push('/'), [router]);
  const handleBack = useCallback(() => router.back(), [router]);
  const handleCameraRetake = useCallback(() => router.push('/movement-test/camera'), [router]);

  if (loading) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">분석 중...</p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  if (error) {
    return (
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <p className="mb-4 text-center text-sm text-slate-400">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/movement-test/survey')}
            className="text-sm text-slate-300 underline"
          >
            설문으로 돌아가기
          </button>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex flex-1 flex-col items-center justify-start px-6 py-4">
        <Suspense fallback={null}>
          <ResumeExecutionGate
            enabled={resumeEnabled}
            returnPathClean="/movement-test/refined"
            handleExecutionStart={handleExecutionStart}
          />
        </Suspense>
        {recoveredRefined ? (
          /* FLOW-02: DB에서 복구된 refined | FLOW-03: 실행 시작 CTA */
          <div className="space-y-3 w-full max-w-md">
            <PublicResultRenderer
              result={recoveredRefined}
              stage="refined"
              onBack={handleBack}
              actions={[
                {
                  label: bridgePending ? '처리 중...' : '실행 시작하기',
                  onClick: handleExecutionStart,
                  variant: 'primary',
                },
                {
                  label: '처음부터 다시 하기',
                  onClick: handleRetake,
                  variant: 'ghost',
                },
              ]}
            />
            {bridgeError && <p className="text-sm text-amber-400 text-center">{bridgeError}</p>}
          </div>
        ) : refined ? (
          /* V2-06: shared renderer — refined stage | FLOW-03: 실행 시작 CTA */
          <div className="space-y-3 w-full max-w-md">
            <PublicResultRenderer
              result={refined.result}
              stage="refined"
              cameraEvidenceQuality={refined.refined_meta.camera_evidence_quality}
              onBack={handleBack}
              actions={[
                {
                  label: bridgePending ? '처리 중...' : '실행 시작하기',
                  onClick: handleExecutionStart,
                  variant: 'primary',
                },
                {
                  label: '처음부터 다시 하기',
                  onClick: handleRetake,
                  variant: 'ghost',
                },
              ]}
            />
            {bridgeError && <p className="text-sm text-amber-400 text-center">{bridgeError}</p>}
          </div>
        ) : baselineFallback ? (
          /* V2-06: shared renderer — fallback stage | FLOW-03: 실행 시작 CTA */
          <div className="space-y-3 w-full max-w-md">
            <PublicResultRenderer
              result={baselineFallback.result}
              stage="fallback"
              onBack={handleBack}
              actions={[
                {
                  label: bridgePending ? '처리 중...' : '실행 시작하기',
                  onClick: handleExecutionStart,
                  variant: 'primary',
                },
                {
                  label: '카메라 다시 촬영하기',
                  onClick: handleCameraRetake,
                  variant: 'secondary',
                },
                {
                  label: '처음부터 다시 하기',
                  onClick: handleRetake,
                  variant: 'ghost',
                },
              ]}
            />
            {bridgeError && <p className="text-sm text-amber-400 text-center">{bridgeError}</p>}
          </div>
        ) : null}
      </main>
    </MoveReFullscreenScreen>
  );
}
