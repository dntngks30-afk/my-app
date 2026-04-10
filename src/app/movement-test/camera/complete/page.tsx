'use client';

/**
 * 카메라 테스트 완료
 * evaluatorResults + guardrailResults → normalize → 안전한 result 분기
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import {
  MoveReFullscreenScreen,
  MoveReHeroBlock,
  MoveRePrimaryCTA,
  MoveReSecondaryCTA,
  MoveReSurfaceCard,
} from '@/components/public-brand';
import {
  loadCameraTest,
  CAMERA_STEPS,
  resetCameraTest,
} from '@/lib/public/camera-test';
import { normalizeCameraResult, type NormalizedCameraResult } from '@/lib/camera/normalize';
import { clearCameraResult, saveCameraResult } from '@/lib/camera/camera-result';
import type { EvaluatorResult } from '@/lib/camera/evaluators/types';
import type { CameraGuardrailFlag, StepGuardrailResult } from '@/lib/camera/guardrails';

const ACTIVE_STEP_COUNT = CAMERA_STEPS.length;

export default function CameraCompletePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<NormalizedCameraResult | null>(null);

  useEffect(() => {
    const data = loadCameraTest();
    const results = data.evaluatorResults ?? {};
    const guardrails = data.guardrailResults ?? {};
    const allResults = CAMERA_STEPS
      .map((step) => results[step.id])
      .filter((result): result is EvaluatorResult => result != null);
    const allGuardrails = CAMERA_STEPS
      .map((step) => guardrails[step.id])
      .filter((result): result is StepGuardrailResult => result != null);
    const normalized = normalizeCameraResult(allResults, allGuardrails);

    if (allResults.length < CAMERA_STEPS.length || allGuardrails.length < CAMERA_STEPS.length) {
      normalized.captureQuality = 'invalid';
      normalized.flags = [
        ...new Set([...normalized.flags, 'hard_partial', 'insufficient_signal']),
      ] as CameraGuardrailFlag[];
      normalized.retryRecommended = true;
      normalized.fallbackMode = 'survey';
      normalized.insufficientSignal = true;
      normalized.patternSummary = '촬영이 끝나지 않았거나 신호가 충분하지 않아 결과를 바로 확정하지 않았습니다.';
    }
    saveCameraResult(normalized);
    setAnalysis(normalized);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[camera-guardrails]', normalized);
      if (normalized.resultEvidenceLevel || normalized.resultToneMode) {
        console.info('[camera-evidence]', {
          resultEvidenceLevel: normalized.resultEvidenceLevel,
          resultToneMode: normalized.resultToneMode,
          interpretationDowngraded: normalized.debug?.interpretationDowngraded,
          fallbackToRetryOrLowConfidence: normalized.debug?.fallbackToRetryOrLowConfidence,
        });
      }
    }
  }, []);

  const handleViewResult = () => {
    // V2-05: 성공적 카메라 완료 → refined Deep Result V2 경로
    router.push('/movement-test/refined');
  };

  const handleRetry = () => {
    clearCameraResult();
    resetCameraTest();
    router.push('/movement-test/camera');
  };

  const handleSurveyFallback = () => {
    clearCameraResult();
    router.push('/movement-test/survey');
  };

  const handleHome = () => {
    router.push('/');
  };

  const uiState = useMemo(() => {
    if (!analysis) {
      return {
        title: '촬영을 정리하고 있습니다',
        description: '캡처 신호와 결과를 확인하는 중입니다.',
        allowContinue: false,
      };
    }
    if (analysis.captureQuality === 'invalid' || analysis.fallbackMode === 'survey') {
      return {
        title: '신호가 충분하지 않았습니다',
        description:
          '전신 프레이밍이나 유효 프레임이 부족해 결과를 바로 확정하지 않았어요. 다시 촬영하거나 설문형 테스트로 이어서 진행해 보세요.',
        allowContinue: false,
      };
    }
    return {
      title: '촬영이 완료되었습니다',
      description: `${ACTIVE_STEP_COUNT}가지 동작의 촬영 신호를 확인했습니다. 결과를 확인해 보세요.`,
      allowContinue: true,
    };
  }, [analysis]);

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <div className="flex w-full max-w-md flex-col gap-6">
          <MoveReHeroBlock
            title={
              <span
                className="block text-2xl font-bold md:text-3xl"
                style={{ fontFamily: 'var(--font-serif-noto)' }}
              >
                {uiState.title}
              </span>
            }
            subtitle={<p className="break-keep">{uiState.description}</p>}
          />
          {analysis ? (
            <MoveReSurfaceCard className="p-4 text-left">
              <p className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                촬영 신호:{' '}
                {uiState.allowContinue
                  ? '확인됨'
                  : analysis.captureQuality === 'invalid'
                    ? '재촬영 권장'
                    : '안정적'}
              </p>
              {process.env.NODE_ENV !== 'production' && analysis.flags.length > 0 ? (
                <p
                  className="mt-2 break-keep text-xs text-slate-500"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  debug: quality={analysis.captureQuality}, confidence={analysis.confidence}, flags=
                  {analysis.flags.join(', ')}
                </p>
              ) : null}
            </MoveReSurfaceCard>
          ) : null}
          <div className="flex flex-col gap-3">
            {uiState.allowContinue ? (
              <MoveRePrimaryCTA onClick={handleViewResult}>결과 보기</MoveRePrimaryCTA>
            ) : null}
            {uiState.allowContinue ? (
              <MoveReSecondaryCTA onClick={handleRetry}>다시 촬영하기</MoveReSecondaryCTA>
            ) : (
              <MoveRePrimaryCTA onClick={handleRetry}>다시 촬영하기</MoveRePrimaryCTA>
            )}
            <MoveReSecondaryCTA onClick={handleSurveyFallback}>설문형 테스트로 전환</MoveReSecondaryCTA>
            <MoveReSecondaryCTA onClick={handleHome}>홈으로</MoveReSecondaryCTA>
          </div>
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
