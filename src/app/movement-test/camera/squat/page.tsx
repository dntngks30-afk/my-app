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
  isFinalPassLatched,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';
import { recordAttemptSnapshot } from '@/lib/camera/camera-trace';
import {
  getMovementSetupGuide,
  getPreCaptureGuidance,
  getEffectiveRetryGuidance,
} from '@/lib/camera/camera-guidance';
import { TraceDebugPanel } from '@/components/camera/TraceDebugPanel';

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
    failureReasons.includes('hard_partial') ||
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
  const [passLatched, setPassLatched] = useState(false);
  const [passLatchedAt, setPassLatchedAt] = useState<string | null>(null);
  const [navigationTriggered, setNavigationTriggered] = useState(false);
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
  const passLatchedStepKeyRef = useRef<string | null>(null);
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const debugEnabled = IS_DEV;
  const currentStepKey = `${STEP_ID}:${previewKey}`;
  const nextPath = getNextStepPath(STEP_ID);

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );
  const finalPassLatched = isFinalPassLatched(STEP_ID, gate);

  useEffect(() => {
    if (!debugEnabled || stats.sampledFrameCount === 0) return;
    console.info('[camera:squat-contract]', {
      passCandidate: gate.status === 'pass',
      completionSatisfied: gate.completionSatisfied,
      guardrailStatus: gate.guardrail.captureQuality,
      effectiveConfidence: gate.confidence,
      stableFrameCount: gate.passConfirmationFrameCount,
      finalPassLatched,
    });
  }, [
    debugEnabled,
    stats.sampledFrameCount,
    gate.status,
    gate.completionSatisfied,
    gate.guardrail.captureQuality,
    gate.confidence,
    gate.passConfirmationFrameCount,
    finalPassLatched,
  ]);

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
    passLatchedStepKeyRef.current = null;
    lastProgressionStateRef.current = 'idle';
    setPassLatched(false);
    setPassLatchedAt(null);
    setNavigationTriggered(false);
    setTransitionLocked(false);
    setPassDetectedAt(null);
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setTransitionHistory([]);
  }, [clearAutoAdvanceTimer, currentStepKey]);

  const persistCurrentStep = useCallback(() => {
    recordAttemptSnapshot(STEP_ID, gate);
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
  }, [gate]);

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

  const latchPassEvent = useCallback(() => {
    if (passLatchedStepKeyRef.current === currentStepKey || passLatched) {
      return;
    }

    const latchedAt = new Date().toISOString();
    passLatchedStepKeyRef.current = currentStepKey;
    settledRef.current = true;
    advanceLockRef.current = true;
    setPassLatched(true);
    setPassLatchedAt(latchedAt);
    setPassDetectedAt(latchedAt);
    setTransitionLocked(true);
    setNextTriggerReason('pass_latched');
    stop();
    persistCurrentStep();
    setProgressionState('passed');
    setStatusMessage(gate.uiMessage);
    appendTransition('passed', 'pass_latched');
  }, [appendTransition, currentStepKey, gate.uiMessage, passLatched, persistCurrentStep, stop]);

  useEffect(() => {
    if (permissionDenied || !cameraReady || passLatched) {
      return;
    }

    if (stats.sampledFrameCount === 0) {
      setProgressionState('camera_ready');
      setStatusMessage('동작을 시작해 주세요');
      return;
    }

    setProgressionState(gate.progressionState);
    setStatusMessage(gate.uiMessage);

    if (finalPassLatched) {
      latchPassEvent();
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
    latchPassEvent,
    finalPassLatched,
    passLatched,
    permissionDenied,
    stats.sampledFrameCount,
    stop,
  ]);

  useEffect(() => {
    if (!passLatched || passLatchedStepKeyRef.current !== currentStepKey) {
      return;
    }

    if (triggeredAdvanceStepKeyRef.current === currentStepKey || navigationTriggered) {
      return;
    }

    if (!nextPath) {
      setNextTriggerReason('transition_not_triggered');
      return;
    }

    if (
      advanceLockRef.current &&
      autoAdvanceTimerRef.current &&
      scheduledAdvanceStepKeyRef.current === currentStepKey
    ) {
      return;
    }

    if (advanceLockRef.current && !autoAdvanceTimerRef.current) {
      advanceLockRef.current = false;
      setTransitionLocked(false);
      setNextTriggerReason('stale_transition_lock_released');
    }

    advanceLockRef.current = true;
    setTransitionLocked(true);
    clearAutoAdvanceTimer();
    scheduledAdvanceStepKeyRef.current = currentStepKey;
    setAutoAdvanceScheduled(true);
    setNextScheduledAt(new Date().toISOString());
    setNextTriggerReason('auto_advance_scheduled');
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (
        triggeredAdvanceStepKeyRef.current === currentStepKey ||
        passLatchedStepKeyRef.current !== currentStepKey
      ) {
        return;
      }

      triggeredAdvanceStepKeyRef.current = currentStepKey;
      setNavigationTriggered(true);
      setNextTriggeredAt(new Date().toISOString());
      setNextTriggerReason('route_push_next_step');
      console.info('[camera:squat-next]', {
        currentStepKey,
        nextPath,
        triggeredAt: new Date().toISOString(),
        reason: 'route_push_next_step',
      });
      router.push(nextPath);
    }, gate.autoAdvanceDelayMs);
  }, [
    clearAutoAdvanceTimer,
    currentStepKey,
    gate.autoAdvanceDelayMs,
    navigationTriggered,
    nextPath,
    passLatched,
    router,
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
    recordAttemptSnapshot(STEP_ID, gate);
    clearAutoAdvanceTimer();
    stop();
    settledRef.current = false;
    advanceLockRef.current = false;
    passLatchedStepKeyRef.current = null;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    hasStartedRef.current = false;
    setCameraReady(false);
    setPassLatched(false);
    setPassLatchedAt(null);
    setNavigationTriggered(false);
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
  }, [clearAutoAdvanceTimer, gate, stop]);

  const handleCameraError = useCallback(() => {
    clearAutoAdvanceTimer();
    settledRef.current = false;
    advanceLockRef.current = false;
    passLatchedStepKeyRef.current = null;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    setPassLatched(false);
    setPassLatchedAt(null);
    setNavigationTriggered(false);
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
    latchPassEvent();
  }, [latchPassEvent]);

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
  const setupGuide = useMemo(() => getMovementSetupGuide(STEP_ID, gate), [gate]);
  const preCaptureGuidance = useMemo(
    () => getPreCaptureGuidance(STEP_ID, gate, stats.sampledFrameCount),
    [gate, stats.sampledFrameCount]
  );
  const retryGuidance = useMemo(
    () => (showRetryActions ? getEffectiveRetryGuidance(STEP_ID, gate) : null),
    [showRetryActions, gate]
  );
  const visibleUserGuidance = finalPassLatched || passLatched
    ? []
    : retryGuidance
      ? [retryGuidance.primary, retryGuidance.secondary].filter(Boolean)
      : gate.userGuidance;
  const showPreCaptureHint =
    (progressionState === 'camera_ready' || progressionState === 'insufficient_signal') &&
    stats.sampledFrameCount < 8;
  const effectiveProgressionState = finalPassLatched || passLatched ? 'passed' : progressionState;
  // Success tone ONLY when finalPassLatched (strict contract)
  const toneGate =
    finalPassLatched || passLatched
      ? { ...gate, status: 'pass' as const, nextAllowed: true, completionSatisfied: true }
      : gate.status === 'pass' && !finalPassLatched
        ? { ...gate, status: 'detecting' as const, progressionState: 'detecting' as const }
        : gate;
  const guideTone = getCameraGuideTone({
    ...toneGate,
    progressionState: effectiveProgressionState,
  });
  const overlayGuide = getSquatOverlayGuide(gate.failureReasons, effectiveProgressionState);

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
          1 / 2
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
                guideVariant="default"
                guideBadges={setupGuide.badges}
                guideInstructions={setupGuide.instructions}
                guideReadinessLabel={setupGuide.readinessLabel}
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
                {showPreCaptureHint && (
                  <p
                    className="mt-1 text-xs text-slate-400 break-keep"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {preCaptureGuidance.primary}
                  </p>
                )}
                {visibleUserGuidance.length > 0 && (
                  <div
                    className="mt-2 space-y-1 text-xs text-slate-400 break-keep"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {visibleUserGuidance.map((message) => (
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
                    <span>state: {effectiveProgressionState}</span>
                    <span>confidence: {gate.confidence}</span>
                    <span>captureQuality: {gate.guardrail.captureQuality}</span>
                    <span>completionSatisfied: {String(gate.completionSatisfied)}</span>
                    <span>nextAllowed: {String(gate.nextAllowed)}</span>
                    <span>finalPassLatched: {String(finalPassLatched)}</span>
                    <span>passLatched: {String(passLatched)}</span>
                    <span>passConfirmed: {String(gate.passConfirmationSatisfied)}</span>
                    <span>passFrames: {gate.passConfirmationFrameCount}/{gate.passConfirmationWindowCount}</span>
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
                    <span>navigationTriggered: {String(navigationTriggered)}</span>
                    <span>nextPath: {nextPath ?? 'n/a'}</span>
                  </div>

                  <div className="mt-3 text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    <p>flags: {gate.flags.join(', ') || 'none'}</p>
                    <p>failureReasons: {gate.failureReasons.join(', ') || 'none'}</p>
                    <p>passDetectedAt: {passDetectedAt ?? 'n/a'}</p>
                    <p>passLatchedAt: {passLatchedAt ?? 'n/a'}</p>
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
                  <TraceDebugPanel />
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
