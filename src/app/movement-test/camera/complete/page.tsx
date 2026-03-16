'use client';

/**
 * 카메라 테스트 완료
 * evaluatorResults + guardrailResults → normalize → 안전한 result 분기
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Starfield } from '@/components/landing/Starfield';
import {
  loadCameraTest,
  CAMERA_STEPS,
  resetCameraTest,
} from '@/lib/public/camera-test';
import { normalizeCameraResult, type NormalizedCameraResult } from '@/lib/camera/normalize';
import { clearCameraResult, saveCameraResult } from '@/lib/camera/camera-result';

const BG = '#0d161f';
const ACTIVE_STEP_COUNT = CAMERA_STEPS.length;

export default function CameraCompletePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<NormalizedCameraResult | null>(null);

  useEffect(() => {
    const data = loadCameraTest();
    const results = data.evaluatorResults ?? {};
    const guardrails = data.guardrailResults ?? {};
    const allResults = CAMERA_STEPS.flatMap((step) => (results[step.id] ? [results[step.id]] : []));
    const allGuardrails = CAMERA_STEPS.flatMap((step) =>
      guardrails[step.id] ? [guardrails[step.id]] : []
    );
    const normalized = normalizeCameraResult(allResults, allGuardrails);

    if (allResults.length < CAMERA_STEPS.length || allGuardrails.length < CAMERA_STEPS.length) {
      normalized.captureQuality = 'invalid';
      normalized.flags = [...new Set([...normalized.flags, 'partial_capture', 'insufficient_signal'])];
      normalized.retryRecommended = true;
      normalized.fallbackMode = 'survey';
      normalized.insufficientSignal = true;
      normalized.patternSummary = '촬영이 끝나지 않았거나 신호가 충분하지 않아 결과를 바로 확정하지 않았습니다.';
    }
    saveCameraResult(normalized);
    setAnalysis(normalized);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[camera-guardrails]', normalized);
    }
  }, []);

  const handleViewResult = () => {
    router.push('/movement-test/result');
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
    if (analysis.captureQuality === 'low' || analysis.retryRecommended) {
      return {
        title: '일부 신호가 약했습니다',
        description:
          '확인 가능한 범위의 결과는 정리했지만 일부 구간이 짧거나 흔들렸어요. 다시 촬영하면 더 안정적인 결과를 볼 수 있습니다.',
        allowContinue: true,
      };
    }
    return {
      title: '촬영이 완료되었습니다',
        description: `${ACTIVE_STEP_COUNT}가지 동작의 촬영 신호가 안정적으로 확인되었습니다. 결과를 확인해 보세요.`,
      allowContinue: true,
    };
  }, [analysis]);

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-slate-100"
            style={{ fontFamily: 'var(--font-serif-noto)' }}
          >
            {uiState.title}
          </h1>
          <p
            className="text-slate-400 text-sm leading-relaxed break-keep"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {uiState.description}
          </p>
          {analysis && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <p className="text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                촬영 신호: {analysis.captureQuality === 'ok'
                  ? '안정적'
                  : analysis.captureQuality === 'low'
                    ? '조금 약함'
                    : '재촬영 권장'}
              </p>
              {process.env.NODE_ENV !== 'production' && analysis.flags.length > 0 && (
                <p
                  className="mt-2 text-xs text-slate-500 break-keep"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  debug: quality={analysis.captureQuality}, confidence={analysis.confidence}, flags={analysis.flags.join(', ')}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {uiState.allowContinue && (
              <button
                type="button"
                onClick={handleViewResult}
                className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {analysis?.captureQuality === 'low' ? '현재 결과 보기' : '결과 보기'}
              </button>
            )}
            <button
              type="button"
              onClick={handleRetry}
              className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다시 촬영하기
            </button>
            <button
              type="button"
              onClick={handleSurveyFallback}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              설문형 테스트로 전환
            </button>
            <button
              type="button"
              onClick={handleHome}
              className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              홈으로
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
