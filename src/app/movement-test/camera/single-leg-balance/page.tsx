'use client';

/**
 * 카메라 테스트 - 한발 서기
 * AI gate가 pass / retry / fail을 판단하고 자동 진행한다.
 */
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Starfield } from '@/components/landing/Starfield';
import { CameraPreview } from '@/components/public/CameraPreview';
import {
  saveCameraTest,
  loadCameraTest,
  getPrevStepPath,
  type CameraStepId,
} from '@/lib/public/camera-test';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import {
  evaluateExerciseAutoProgress,
  getCameraGuideTone,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
const STEP_ID: CameraStepId = 'single-leg-balance';
const IS_DEV = process.env.NODE_ENV !== 'production';

const INSTRUCTION = '한 발로 10초 서세요. 좌우 각각 진행해 주세요.';

export default function CameraSingleLegBalancePage() {
  const router = useRouter();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [progressionState, setProgressionState] =
    useState<ExerciseProgressionState>('idle');
  const [statusMessage, setStatusMessage] = useState('준비 중');
  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture();
  const hasStartedRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const persistCurrentStep = useCallback(() => {
    const current = loadCameraTest();
    const completed = current.completedSteps?.includes(STEP_ID)
      ? current.completedSteps
      : [...(current.completedSteps ?? []), STEP_ID];
    const evaluatorResults = {
      ...(current.evaluatorResults ?? {}),
      [STEP_ID]: gate.evaluatorResult,
    };
    const guardrailResults = {
      ...(current.guardrailResults ?? {}),
      [STEP_ID]: gate.guardrail,
    };

    saveCameraTest({
      completedSteps: completed,
      lastStepAt: new Date().toISOString(),
      evaluatorResults,
      guardrailResults,
    });
  }, [gate.evaluatorResult, gate.guardrail]);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        start(video);
      }
      settledRef.current = false;
      setCameraReady(true);
      setProgressionState('camera_ready');
      setStatusMessage('동작을 시작해 주세요');
    },
    [start]
  );

  const handlePassAdvance = useCallback(() => {
    if (advanceLockRef.current) return;

    advanceLockRef.current = true;
    settledRef.current = true;
    stop();
    persistCurrentStep();
    setProgressionState('passed');
    setStatusMessage('충분한 신호를 확인했어요');
    clearAutoAdvanceTimer();
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      router.push('/movement-test/camera/complete');
    }, gate.autoAdvanceDelayMs);
  }, [clearAutoAdvanceTimer, gate.autoAdvanceDelayMs, persistCurrentStep, router, stop]);

  useEffect(() => {
    if (permissionDenied || !cameraReady || settledRef.current) {
      return;
    }

    if (stats.sampledFrameCount === 0) {
      setProgressionState('camera_ready');
      setStatusMessage('동작을 시작해 주세요');
      return;
    }

    setProgressionState(gate.progressionState);
    setStatusMessage(gate.uiMessage);

    if (gate.status === 'pass' && gate.nextAllowed) {
      handlePassAdvance();
      return;
    }

    if (gate.status === 'retry' || gate.status === 'fail') {
      settledRef.current = true;
      stop();
      setProgressionState(gate.progressionState);
      setStatusMessage(gate.uiMessage);
    }
  }, [
    cameraReady,
    gate,
    handlePassAdvance,
    permissionDenied,
    stats.sampledFrameCount,
    stop,
  ]);

  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  const handleRetry = useCallback(() => {
    clearAutoAdvanceTimer();
    stop();
    settledRef.current = false;
    advanceLockRef.current = false;
    hasStartedRef.current = false;
    setCameraReady(false);
    setProgressionState('idle');
    setStatusMessage('준비 중');
    setPermissionDenied(false);
    setPreviewKey((prev) => prev + 1);
  }, [clearAutoAdvanceTimer, stop]);

  const handleCameraError = useCallback(() => {
    clearAutoAdvanceTimer();
    settledRef.current = false;
    advanceLockRef.current = false;
    setCameraReady(false);
    setPermissionDenied(true);
  }, [clearAutoAdvanceTimer]);

  const handleSurveyFallback = useCallback(() => {
    clearAutoAdvanceTimer();
    stop();
    router.push('/movement-test/survey');
  }, [clearAutoAdvanceTimer, router, stop]);

  const handleDevOverride = useCallback(() => {
    if (!IS_DEV) return;
    handlePassAdvance();
  }, [handlePassAdvance]);

  const prevPath = getPrevStepPath(STEP_ID);
  const showRetryActions =
    progressionState === 'retry_required' ||
    progressionState === 'failed' ||
    progressionState === 'insufficient_signal';
  const guideTone = getCameraGuideTone(gate);

  return (
    <div
      className="relative min-h-[100svh] overflow-hidden flex flex-col"
      style={{ backgroundColor: BG }}
    >
      <Starfield />

      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-12">
          {prevPath ? (
            <Link
              href={prevPath}
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </Link>
          ) : (
            <span />
          )}
        </div>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          3 / 3
        </p>
        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-4 overflow-hidden">
        <h1
          className="text-xl font-bold text-slate-100 mb-2"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          한발 서기
        </h1>
        <p
          className="text-slate-400 text-sm mb-4 text-center break-keep"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          {INSTRUCTION}
        </p>

        {permissionDenied ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-md">
            <p className="text-slate-400 text-sm text-center">
              카메라 접근이 거부되었습니다.
              <br />
              브라우저 설정에서 카메라 권한을 허용해 주세요.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={handleSurveyFallback}
                className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                설문형으로 전환
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center">
              <CameraPreview
                key={previewKey}
                onVideoReady={handleVideoReady}
                onPoseFrame={pushFrame}
                onError={handleCameraError}
                guideTone={guideTone}
                className="w-full"
              />
            </div>
            <div className="w-full max-w-md mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p
                  className="text-sm text-slate-200"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {statusMessage}
                </p>
                {gate.userGuidance.length > 0 && (
                  <div
                    className="mt-2 space-y-1 text-xs text-slate-400 break-keep"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {gate.userGuidance.map((message) => (
                      <p key={message}>{message}</p>
                    ))}
                  </div>
                )}
                {IS_DEV && (
                  <p
                    className="mt-2 text-[11px] text-slate-500 break-all"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    state={progressionState}, gate={gate.status}, confidence={gate.confidence},
                    quality={gate.guardrail.captureQuality}
                  </p>
                )}
              </div>

              {showRetryActions && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    다시 해주세요
                  </button>
                  <button
                    type="button"
                    onClick={handleSurveyFallback}
                    className="w-full min-h-[48px] rounded-xl font-medium text-slate-300 border border-white/20 hover:bg-white/5"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    설문형으로 전환
                  </button>
                </div>
              )}

              {IS_DEV && !advanceLockRef.current && (
                <button
                  type="button"
                  onClick={handleDevOverride}
                  className="w-full min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 transition-colors"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  강제 다음
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
