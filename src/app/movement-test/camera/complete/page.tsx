'use client';

/**
 * 카메라 테스트 완료
 * evaluatorResults + guardrailResults → normalize → 안전한 result 분기
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import { trackEvent } from '@/lib/analytics/trackEvent';
import { MoveReFullscreenScreen } from '@/components/public-brand';
import {
  StitchCameraGlassPanel,
} from '@/components/stitch/camera/CameraSquat';
import {
  StitchCameraGhostButton,
  StitchCameraMutedOutlineButton,
  StitchCameraPrimaryButton,
} from '@/components/stitch/camera/CameraButton';
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
    const completedSteps = data.completedSteps?.length ?? 0;
    if (
      allResults.length >= CAMERA_STEPS.length &&
      allGuardrails.length >= CAMERA_STEPS.length &&
      normalized.captureQuality !== 'invalid' &&
      normalized.fallbackMode !== 'survey'
    ) {
      trackEvent('camera_refine_completed', {
        route_group: 'camera_refine',
        completed_steps: completedSteps,
        evidence_quality: normalized.captureQuality ?? null,
      });
    } else {
      trackEvent('camera_refine_failed_or_fallback', {
        route_group: 'camera_refine',
        reason: normalized.fallbackMode ?? normalized.captureQuality ?? 'incomplete_steps',
        completed_steps: completedSteps,
      });
    }
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
        description: '동작 신호를 확인하는 중입니다.',
        allowContinue: false,
      };
    }
    if (analysis.captureQuality === 'invalid' || analysis.fallbackMode === 'survey') {
      return {
        title: '신호가 충분하지 않았습니다',
        description:
          '전신이 화면에 충분히 보이지 않았거나, 움직임 신호가 부족했어요. 다시 촬영하거나 설문 결과로 이어갈 수 있어요.',
        allowContinue: false,
      };
    }
    return {
      title: '촬영이 완료되었습니다',
      description:
        `${ACTIVE_STEP_COUNT}가지 동작 신호를 확인했어요. 이제 내 몸의 움직임 패턴을 정리해볼게요.`,
      allowContinue: true,
    };
  }, [analysis]);

  const signalSummaryLabel = uiState.allowContinue ? '확인됨' : '재촬영 권장';

  return (
    <MoveReFullscreenScreen backgroundSlot={<Starfield />}>
      <main
        className="relative z-10 flex min-h-[100svh] flex-1 flex-col justify-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-5">
          <StitchCameraGlassPanel className="px-5 py-6 text-left">
            <p
              className="mb-4 text-center text-[10px] font-medium uppercase tracking-[0.28em] text-[#ffb77d]/90"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              동작 분석 완료
            </p>
            <h1
              className="text-center text-xl font-bold leading-snug text-slate-100 md:text-2xl"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {uiState.title}
            </h1>
            <p
              className="mt-3 text-center text-sm leading-relaxed text-slate-400 break-keep"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {uiState.description}
            </p>

            {analysis ? (
              <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/22 px-4 py-3 backdrop-blur-sm">
                <p
                  className="text-sm text-slate-200"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  촬영 신호: {signalSummaryLabel}
                </p>
                {process.env.NODE_ENV !== 'production' && analysis.flags.length > 0 ? (
                  <p
                    className="mt-2 break-all text-[10px] leading-relaxed text-slate-500"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    debug: quality={analysis.captureQuality}, confidence={analysis.confidence}, flags=
                    {analysis.flags.join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </StitchCameraGlassPanel>

          {analysis ? (
            <div className="flex flex-col gap-3">
              {uiState.allowContinue ? (
                <>
                  <StitchCameraPrimaryButton onClick={handleViewResult}>결과 보기</StitchCameraPrimaryButton>
                  <StitchCameraPrimaryButton variant="outline" onClick={handleRetry}>
                    다시 촬영하기
                  </StitchCameraPrimaryButton>
                  <StitchCameraMutedOutlineButton onClick={handleSurveyFallback}>
                    설문형 테스트로 전환
                  </StitchCameraMutedOutlineButton>
                  <StitchCameraGhostButton onClick={handleHome}>홈으로</StitchCameraGhostButton>
                </>
              ) : (
                <>
                  <StitchCameraPrimaryButton onClick={handleRetry}>다시 촬영하기</StitchCameraPrimaryButton>
                  <StitchCameraPrimaryButton variant="outline" onClick={handleSurveyFallback}>
                    설문형 테스트로 전환
                  </StitchCameraPrimaryButton>
                  <StitchCameraGhostButton onClick={handleHome}>홈으로</StitchCameraGhostButton>
                </>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </MoveReFullscreenScreen>
  );
}
