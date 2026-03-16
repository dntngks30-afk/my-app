'use client';

/**
 * 카메라 테스트 - 스쿼트
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
  getNextStepPath,
  getPrevStepPath,
  type CameraStepId,
} from '@/lib/public/camera-test';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import {
  evaluateExerciseAutoProgress,
  getCameraGuideTone,
  isGatePassReady,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
const STEP_ID: CameraStepId = 'squat';
const IS_DEV = process.env.NODE_ENV !== 'production';

const INSTRUCTION = '발을 어깨 너비로 벌리고, 허리를 펴고 천천히 앉았다 일어나세요.';

interface DebugTransitionEntry {
  at: string;
  state: ExerciseProgressionState;
  reason: string;
}

interface SquatOverlayGuide {
  hint: string | null;
  focus: 'frame' | 'upper' | 'lower' | 'full' | null;
  animated: boolean;
}

function getSquatOverlayGuide(
  failureReasons: string[],
  progressionState: ExerciseProgressionState
): SquatOverlayGuide {
  if (progressionState === 'passed') {
    return { hint: '통과', focus: 'full', animated: true };
  }

  if (
    failureReasons.includes('framing_invalid') ||
    failureReasons.includes('left_side_missing') ||
    failureReasons.includes('right_side_missing') ||
    failureReasons.includes('partial_capture') ||
    failureReasons.includes('capture_quality_invalid') ||
    failureReasons.includes('capture_quality_low')
  ) {
    return { hint: '위치 다시', focus: 'frame', animated: true };
  }

  if (failureReasons.includes('depth_not_reached')) {
    return { hint: '더 깊게', focus: 'lower', animated: true };
  }

  if (failureReasons.includes('ascent_not_detected')) {
    return { hint: '끝까지 올라오기', focus: 'upper', animated: true };
  }

  if (failureReasons.includes('rep_incomplete')) {
    return { hint: '동작 이어가기', focus: 'full', animated: true };
  }

  if (failureReasons.includes('confidence_too_low')) {
    return { hint: '자세 고정', focus: 'full', animated: false };
  }

  if (progressionState === 'camera_ready') {
    return { hint: '자세 준비', focus: 'full', animated: false };
  }

  return { hint: null, focus: null, animated: false };
}

export default function CameraSquatPage() {
  const router = useRouter();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [progressionState, setProgressionState] =
    useState<ExerciseProgressionState>('idle');
  const [statusMessage, setStatusMessage] = useState('준비 중');
  const [transitionLocked, setTransitionLocked] = useState(false);
  const [autoAdvanceScheduled, setAutoAdvanceScheduled] = useState(false);
  const [passDetectedAt, setPassDetectedAt] = useState<string | null>(null);
  const [nextScheduledAt, setNextScheduledAt] = useState<string | null>(null);
  const [nextTriggeredAt, setNextTriggeredAt] = useState<string | null>(null);
  const [nextTriggerReason, setNextTriggerReason] = useState<string | null>(null);
  const [transitionHistory, setTransitionHistory] = useState<DebugTransitionEntry[]>([]);
  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture();
  const hasStartedRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const lastProgressionStateRef = useRef<ExerciseProgressionState>('idle');
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const debugEnabled = IS_DEV;
  const currentStepKey = `${STEP_ID}:${previewKey}`;

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );
  const passReady = isGatePassReady(gate);

  const appendTransition = useCallback(
    (state: ExerciseProgressionState, reason: string) => {
      if (!debugEnabled) return;

      const entry = {
        at: new Date().toISOString(),
        state,
        reason,
      };

      setTransitionHistory((prev) => [...prev.slice(-7), entry]);
      console.info('[camera:squat-transition]', entry);
    },
    [debugEnabled]
  );

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceScheduled(false);
  }, []);

  useEffect(() => {
    clearAutoAdvanceTimer();
    settledRef.current = false;
    advanceLockRef.current = false;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    lastProgressionStateRef.current = 'idle';
    setTransitionLocked(false);
    setPassDetectedAt(null);
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setTransitionHistory([]);
  }, [clearAutoAdvanceTimer, currentStepKey]);

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
      appendTransition('camera_ready', 'video_ready');
    },
    [appendTransition, start]
  );

  const handlePassAdvance = useCallback(() => {
    if (
      advanceLockRef.current &&
      autoAdvanceTimerRef.current &&
      scheduledAdvanceStepKeyRef.current === currentStepKey
    ) {
      setNextTriggerReason('transition_locked');
      return;
    }

    if (advanceLockRef.current && !autoAdvanceTimerRef.current) {
      advanceLockRef.current = false;
      setTransitionLocked(false);
      setNextTriggerReason('stale_transition_lock_released');
    }

    if (triggeredAdvanceStepKeyRef.current === currentStepKey) {
      setNextTriggerReason('next_already_triggered');
      return;
    }

    const next = getNextStepPath(STEP_ID);
    if (!next) {
      setNextTriggerReason('transition_not_triggered');
      return;
    }

    advanceLockRef.current = true;
    settledRef.current = true;
    setTransitionLocked(true);
    setPassDetectedAt(new Date().toISOString());
    setNextTriggerReason('pass_detected');
    stop();
    persistCurrentStep();
    setProgressionState('passed');
    setStatusMessage(gate.uiMessage);
    appendTransition('passed', 'gate_status_pass');

    clearAutoAdvanceTimer();
    scheduledAdvanceStepKeyRef.current = currentStepKey;
    setAutoAdvanceScheduled(true);
    setNextScheduledAt(new Date().toISOString());
    setNextTriggerReason('auto_advance_scheduled');
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (triggeredAdvanceStepKeyRef.current === currentStepKey) {
        return;
      }

      triggeredAdvanceStepKeyRef.current = currentStepKey;
      setNextTriggeredAt(new Date().toISOString());
      setNextTriggerReason('route_push_next_step');
      console.info('[camera:squat-next]', {
        currentStepKey,
        triggeredAt: new Date().toISOString(),
        reason: 'route_push_next_step',
      });
      router.push(next);
    }, gate.autoAdvanceDelayMs);
  }, [
    appendTransition,
    clearAutoAdvanceTimer,
    currentStepKey,
    gate.autoAdvanceDelayMs,
    gate.uiMessage,
    persistCurrentStep,
    router,
    stop,
  ]);

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

    if (passReady) {
      handlePassAdvance();
      return;
    }

    if (gate.status === 'retry' || gate.status === 'fail') {
      settledRef.current = true;
      stop();
      setProgressionState(gate.progressionState);
      setStatusMessage(gate.uiMessage);
      appendTransition(
        gate.progressionState,
        gate.failureReasons.length > 0 ? gate.failureReasons.join(',') : gate.reasons.join(',')
      );
    }
  }, [
    appendTransition,
    cameraReady,
    gate,
    handlePassAdvance,
    passReady,
    permissionDenied,
    stats.sampledFrameCount,
    stop,
  ]);

  useEffect(() => {
    if (lastProgressionStateRef.current !== progressionState) {
      appendTransition(
        progressionState,
        gate.failureReasons.length > 0 ? gate.failureReasons.join(',') : gate.reasons.join(',') || 'state_update'
      );
      lastProgressionStateRef.current = progressionState;
    }
  }, [appendTransition, gate.failureReasons, gate.reasons, progressionState]);

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
    setTransitionLocked(false);
    setPassDetectedAt(null);
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setTransitionHistory([]);
    setPermissionDenied(false);
    setPreviewKey((prev) => prev + 1);
    appendTransition('idle', 'manual_retry');
  }, [clearAutoAdvanceTimer, stop]);

  const handleCameraError = useCallback(() => {
    clearAutoAdvanceTimer();
    settledRef.current = false;
    advanceLockRef.current = false;
    setTransitionLocked(false);
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
  const repCount =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.repCount === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.repCount
      : 0;
  const depthProxy =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.depthPeak === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.depthPeak
      : getMetricValueFromList(gate.evaluatorResult.metrics, 'depth');
  const trunkLeanProxy = getMetricValueFromList(gate.evaluatorResult.metrics, 'trunk_lean');
  const kneeTrackingProxy = getMetricValueFromList(
    gate.evaluatorResult.metrics,
    'knee_alignment_trend'
  );
  const autoNextObservation =
    passDetectedAt && !nextTriggeredAt
      ? nextScheduledAt
        ? 'pass_detected_but_waiting_for_auto_next'
        : 'transition_not_triggered'
      : nextTriggeredAt
        ? 'next_triggered'
        : 'pass_not_detected';
  const guideTone = getCameraGuideTone({
    ...gate,
    progressionState,
  });
  const overlayGuide = getSquatOverlayGuide(gate.failureReasons, progressionState);

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
            <Link
              href="/movement-test/camera"
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6" style={{ color: ACCENT }} />
            </Link>
          )}
        </div>
        <p className="text-slate-400 text-sm" style={{ fontFamily: 'var(--font-sans-noto)' }}>
          1 / 3
        </p>
        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-4 overflow-hidden">
        <h1
          className="text-xl font-bold text-slate-100 mb-2"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          스쿼트
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
                guideHint={overlayGuide.hint}
                guideFocus={overlayGuide.focus}
                guideAnimated={overlayGuide.animated}
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

              {debugEnabled && (
                <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-4 text-left">
                  <p className="text-xs text-amber-200" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    squat debug
                  </p>
                  <div
                    className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    <span>status: {gate.status}</span>
                    <span>state: {progressionState}</span>
                    <span>confidence: {gate.confidence}</span>
                    <span>captureQuality: {gate.guardrail.captureQuality}</span>
                    <span>completionSatisfied: {String(gate.completionSatisfied)}</span>
                    <span>nextAllowed: {String(gate.nextAllowed)}</span>
                    <span>repCount: {repCount}</span>
                    <span>retryRecommended: {String(gate.retryRecommended)}</span>
                    <span>depthProxy: {depthProxy ?? 'n/a'}</span>
                    <span>trunkLean: {trunkLeanProxy ?? 'n/a'}</span>
                    <span>kneeTracking: {kneeTrackingProxy ?? 'n/a'}</span>
                    <span>validFrames: {gate.guardrail.debug.validFrameCount}</span>
                    <span>sampledFrames: {gate.guardrail.debug.sampledFrameCount}</span>
                    <span>motionStatus: {gate.guardrail.completionStatus}</span>
                    <span>visibleRatio: {gate.guardrail.debug.visibleJointsRatio}</span>
                    <span>left/right: {gate.guardrail.debug.leftSideCompleteness}/{gate.guardrail.debug.rightSideCompleteness}</span>
                    <span>transitionLocked: {String(transitionLocked)}</span>
                    <span>autoAdvanceScheduled: {String(autoAdvanceScheduled)}</span>
                    <span>currentStepKey: {currentStepKey}</span>
                    <span>autoAdvanceReason: {nextTriggerReason ?? 'n/a'}</span>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    <p>flags: {gate.flags.join(', ') || 'none'}</p>
                    <p>failureReasons: {gate.failureReasons.join(', ') || 'none'}</p>
                    <p>passDetectedAt: {passDetectedAt ?? 'n/a'}</p>
                    <p>nextScheduledAt: {nextScheduledAt ?? 'n/a'}</p>
                    <p>nextTriggeredAt: {nextTriggeredAt ?? 'n/a'}</p>
                    <p>nextTriggerReason: {nextTriggerReason ?? 'n/a'}</p>
                    <p>autoNextObservation: {autoNextObservation}</p>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    {transitionHistory.map((entry) => (
                      <p key={`${entry.at}-${entry.state}`}>
                        {entry.at} {entry.state} {entry.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

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

function getMetricValueFromList(
  metrics: Array<{ name: string; value: number }> | undefined,
  name: string
): number | null {
  const metric = metrics?.find((item) => item.name === name);
  return typeof metric?.value === 'number' ? metric.value : null;
}
