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
import { ExternalCameraGuidePanel } from '@/components/public/ExternalCameraGuidePanel';
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

const STEP_ID: CameraStepId = 'single-leg-balance';
const IS_DEV = process.env.NODE_ENV !== 'production';
const DEBUG_SESSION_KEY = `move-re-camera-debug:${STEP_ID}`;

const INSTRUCTION = '한 발로 10초 서세요. 좌우 각각 진행해 주세요.';

interface SingleLegBalanceDebugSnapshot {
  exercise: CameraStepId;
  passedAt: string;
  currentStepKey: string;
  metrics: {
    holdDuration: number | null;
    sway: number | null;
    pelvicDropProxy: number | null;
    leftSideCompleteness: number;
    rightSideCompleteness: number;
    holdOngoingCount: number;
    breakCount: number;
    breakDetected: boolean;
  };
  gate: {
    status: string;
    progressionState: ExerciseProgressionState;
    confidence: number;
    completionSatisfied: boolean;
    nextAllowed: boolean;
    captureQuality: string;
    flags: string[];
    failureReasons: string[];
  };
  navigation: {
    nextPath: string | null;
    transitionLocked: boolean;
    navigationTriggered: boolean;
    nextScheduledAt: string | null;
    nextTriggeredAt: string | null;
    autoAdvanceReason: string | null;
  };
}

interface SingleLegBalanceOverlayGuide {
  hint: string | null;
  focus: 'frame' | 'upper' | 'lower' | 'full' | null;
  animated: boolean;
}

function getSingleLegBalanceOverlayGuide(
  reasons: string[],
  failureReasons: string[],
  progressionState: ExerciseProgressionState
): SingleLegBalanceOverlayGuide {
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
    return { hint: '전신 다시 맞추기', focus: 'frame', animated: true };
  }

  if (reasons.includes('hold_too_short')) {
    return { hint: '10초 유지', focus: 'full', animated: true };
  }

  if (reasons.includes('hold_break_detected')) {
    return { hint: '중심 다시 잡기', focus: 'full', animated: true };
  }

  if (failureReasons.includes('confidence_too_low')) {
    return { hint: '잠깐 고정', focus: 'full', animated: false };
  }

  if (progressionState === 'camera_ready') {
    return { hint: '정면 준비', focus: 'full', animated: false };
  }

  return { hint: null, focus: null, animated: false };
}

export default function CameraSingleLegBalancePage() {
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
  const [nextScheduledAt, setNextScheduledAt] = useState<string | null>(null);
  const [nextTriggeredAt, setNextTriggeredAt] = useState<string | null>(null);
  const [nextTriggerReason, setNextTriggerReason] = useState<string | null>(null);
  const [successSnapshot, setSuccessSnapshot] = useState<SingleLegBalanceDebugSnapshot | null>(
    null
  );
  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture();
  const hasStartedRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const passLatchedStepKeyRef = useRef<string | null>(null);
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const currentStepKey = `${STEP_ID}:${previewKey}`;
  const nextPath = getNextStepPath(STEP_ID) ?? '/movement-test/camera/complete';
  const debugEnabled = IS_DEV;

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );
  const passReady = isGatePassReady(gate);
  const holdDuration = getMetricValueFromList(gate.evaluatorResult.rawMetrics, 'hold_duration');
  const sway = getMetricValueFromList(gate.evaluatorResult.metrics, 'sway');
  const pelvicDropProxy = getMetricValueFromList(gate.evaluatorResult.metrics, 'pelvic_drop');
  const holdOngoingCount =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.holdOngoingCount === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.holdOngoingCount
      : 0;
  const breakCount =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.breakCount === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.breakCount
      : 0;

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceScheduled(false);
  }, []);

  useEffect(() => {
    if (!debugEnabled || typeof window === 'undefined') {
      return;
    }

    try {
      if (!successSnapshot) {
        window.sessionStorage.removeItem(DEBUG_SESSION_KEY);
        return;
      }

      window.sessionStorage.setItem(DEBUG_SESSION_KEY, JSON.stringify(successSnapshot));
      console.info('[camera:single-leg-balance-success-snapshot]', successSnapshot);
    } catch {
      // ignore debug persistence failures
    }
  }, [debugEnabled, successSnapshot]);

  useEffect(() => {
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
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setSuccessSnapshot(null);
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
    },
    [start]
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
    setTransitionLocked(true);
    setNextTriggerReason('pass_latched');
    stop();
    persistCurrentStep();
    setProgressionState('passed');
    setStatusMessage(gate.uiMessage);
    setSuccessSnapshot({
      exercise: STEP_ID,
      passedAt: latchedAt,
      currentStepKey,
      metrics: {
        holdDuration,
        sway,
        pelvicDropProxy,
        leftSideCompleteness: gate.guardrail.debug.leftSideCompleteness,
        rightSideCompleteness: gate.guardrail.debug.rightSideCompleteness,
        holdOngoingCount,
        breakCount,
        breakDetected: breakCount > 0,
      },
      gate: {
        status: gate.status,
        progressionState: gate.progressionState,
        confidence: gate.confidence,
        completionSatisfied: gate.completionSatisfied,
        nextAllowed: gate.nextAllowed,
        captureQuality: gate.guardrail.captureQuality,
        flags: gate.flags,
        failureReasons: gate.failureReasons,
      },
      navigation: {
        nextPath,
        transitionLocked: true,
        navigationTriggered: false,
        nextScheduledAt: null,
        nextTriggeredAt: null,
        autoAdvanceReason: 'pass_latched',
      },
    });
  }, [
    breakCount,
    currentStepKey,
    gate.completionSatisfied,
    gate.confidence,
    gate.failureReasons,
    gate.flags,
    gate.guardrail.captureQuality,
    gate.guardrail.debug.leftSideCompleteness,
    gate.guardrail.debug.rightSideCompleteness,
    gate.nextAllowed,
    gate.progressionState,
    gate.status,
    gate.uiMessage,
    holdDuration,
    holdOngoingCount,
    nextPath,
    passLatched,
    pelvicDropProxy,
    persistCurrentStep,
    stop,
    sway,
  ]);

  useEffect(() => {
    if (permissionDenied || !cameraReady || passLatched || settledRef.current) {
      return;
    }

    if (stats.sampledFrameCount === 0) {
      setProgressionState((prev) => (prev === 'camera_ready' ? prev : 'camera_ready'));
      setStatusMessage((prev) => (prev === '동작을 시작해 주세요' ? prev : '동작을 시작해 주세요'));
      return;
    }

    setProgressionState((prev) => (prev === gate.progressionState ? prev : gate.progressionState));
    setStatusMessage((prev) => (prev === gate.uiMessage ? prev : gate.uiMessage));

    if (passReady) {
      latchPassEvent();
      return;
    }

    if (gate.status === 'retry' || gate.status === 'fail') {
      settledRef.current = true;
      stop();
      setProgressionState((prev) => (prev === gate.progressionState ? prev : gate.progressionState));
      setStatusMessage((prev) => (prev === gate.uiMessage ? prev : gate.uiMessage));
    }
  }, [
    cameraReady,
    gate.progressionState,
    gate.status,
    gate.uiMessage,
    latchPassEvent,
    passReady,
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

    advanceLockRef.current = true;
    setTransitionLocked(true);
    clearAutoAdvanceTimer();
    scheduledAdvanceStepKeyRef.current = currentStepKey;
    setAutoAdvanceScheduled(true);
    const scheduledAt = new Date().toISOString();
    setNextScheduledAt(scheduledAt);
    setNextTriggerReason('auto_advance_scheduled');
    setSuccessSnapshot((prev) =>
      prev
        ? {
            ...prev,
            navigation: {
              ...prev.navigation,
              nextPath,
              transitionLocked: true,
              nextScheduledAt: scheduledAt,
              autoAdvanceReason: 'auto_advance_scheduled',
            },
          }
        : prev
    );
    autoAdvanceTimerRef.current = window.setTimeout(() => {
      if (
        triggeredAdvanceStepKeyRef.current === currentStepKey ||
        passLatchedStepKeyRef.current !== currentStepKey
      ) {
        return;
      }

      triggeredAdvanceStepKeyRef.current = currentStepKey;
      const triggeredAt = new Date().toISOString();
      setNavigationTriggered(true);
      setNextTriggeredAt(triggeredAt);
      setNextTriggerReason('route_push_next_step');
      setSuccessSnapshot((prev) =>
        prev
          ? {
              ...prev,
              navigation: {
                ...prev.navigation,
                nextPath,
                transitionLocked: true,
                navigationTriggered: true,
                nextTriggeredAt: triggeredAt,
                autoAdvanceReason: 'route_push_next_step',
              },
            }
          : prev
      );

      if (IS_DEV) {
        console.info('[camera:auto-next]', {
          stepId: STEP_ID,
          currentStepKey,
          nextPath,
          reason: 'route_push_next_step',
        });
      }

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
    return () => {
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  const handleRetry = useCallback(() => {
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
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setSuccessSnapshot(null);
    setPermissionDenied(false);
    setPreviewKey((prev) => prev + 1);
  }, [clearAutoAdvanceTimer, stop]);

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
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setSuccessSnapshot(null);
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
  const visibleUserGuidance = passLatched ? [] : gate.userGuidance;
  const effectiveProgressionState = passLatched ? 'passed' : progressionState;
  const overlayGuide = getSingleLegBalanceOverlayGuide(
    gate.reasons,
    gate.failureReasons,
    effectiveProgressionState
  );
  const guideBadges = ['정면 촬영', '전신이 보여야 함', '10초 유지'];
  const guideInstructions = [
    '머리부터 발끝까지 모두 보이게 서주세요',
    '한 발을 들고 10초 유지해 주세요',
    '흔들려도 화면 안에서 중심을 다시 잡아주세요',
  ];
  const guideReadinessLabel =
    cameraReady &&
    stats.sampledFrameCount > 0 &&
    gate.guardrail.captureQuality !== 'invalid' &&
    !gate.flags.includes('framing_invalid') &&
    !gate.flags.includes('hard_partial') &&
    !gate.flags.includes('left_side_missing') &&
    !gate.flags.includes('right_side_missing')
      ? '전신과 두 다리가 잘 보여요'
      : null;
  const autoNextObservation =
    passLatched && !nextTriggeredAt
      ? nextScheduledAt
        ? 'pass_latched_waiting_for_auto_next'
        : 'transition_not_triggered'
      : nextTriggeredAt
        ? 'next_triggered'
        : 'pass_not_latched';
  const guideTone = getCameraGuideTone({
    ...(passLatched
      ? { ...gate, status: 'pass' as const, nextAllowed: true, completionSatisfied: true }
      : gate),
    progressionState: effectiveProgressionState,
  });

  return (
    <div className="relative min-h-[100svh] overflow-hidden flex flex-col mr-public-funnel-shell">
      <Starfield />

      <header className="relative z-20 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="w-12">
          {prevPath ? (
            <Link
              href={prevPath}
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="이전"
            >
              <ChevronLeft className="size-6 text-[var(--mr-public-accent)]" />
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
                guideHint={overlayGuide.hint}
                guideFocus={overlayGuide.focus}
                guideAnimated={overlayGuide.animated}
                guideVariant="single-leg-balance"
                guideBadges={guideBadges}
                guideReadinessLabel={guideReadinessLabel}
                className="w-full"
              />
            </div>
            {guideInstructions.length > 0 && (
              <ExternalCameraGuidePanel
                variant="single-leg-balance"
                lines={guideInstructions}
                className="w-full max-w-md mt-2 shrink-0"
              />
            )}
            <div className="w-full max-w-md mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p
                  className="text-sm text-slate-200"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {statusMessage}
                </p>
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
                    single leg balance debug
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
                    <span>passReady: {String(passReady)}</span>
                    <span>passLatched: {String(passLatched)}</span>
                    <span>passLatchedAt: {passLatchedAt ?? 'n/a'}</span>
                    <span>navigationTriggered: {String(navigationTriggered)}</span>
                    <span>transitionLocked: {String(transitionLocked)}</span>
                    <span>autoAdvanceScheduled: {String(autoAdvanceScheduled)}</span>
                    <span>currentStepKey: {currentStepKey}</span>
                    <span>nextPath: {nextPath}</span>
                    <span>nextScheduledAt: {nextScheduledAt ?? 'n/a'}</span>
                    <span>nextTriggeredAt: {nextTriggeredAt ?? 'n/a'}</span>
                    <span>autoAdvanceReason: {nextTriggerReason ?? 'n/a'}</span>
                    <span>autoNextObservation: {autoNextObservation}</span>
                    <span>holdDuration: {holdDuration ?? 'n/a'}</span>
                    <span>sway: {sway ?? 'n/a'}</span>
                    <span>pelvicDrop: {pelvicDropProxy ?? 'n/a'}</span>
                    <span>leftSide: {gate.guardrail.debug.leftSideCompleteness}</span>
                    <span>rightSide: {gate.guardrail.debug.rightSideCompleteness}</span>
                    <span>holdOngoingCount: {holdOngoingCount}</span>
                    <span>breakCount: {breakCount}</span>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    <p>flags: {gate.flags.join(', ') || 'none'}</p>
                    <p>failureReasons: {gate.failureReasons.join(', ') || 'none'}</p>
                    <p>snapshotStored: {successSnapshot ? 'yes' : 'no'}</p>
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
