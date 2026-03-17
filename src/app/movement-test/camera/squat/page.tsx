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
  type CameraPhase,
} from '@/lib/public/camera-test';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import { getSetupFramingHint } from '@/lib/camera/setup-framing';
import {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';
import {
  getGuideToneFromLiveReadiness,
  getLiveReadinessSummary,
  getPrimaryReadinessBlocker,
  useStabilizedLiveReadiness,
} from '@/lib/camera/live-readiness';
import { recordAttemptSnapshot } from '@/lib/camera/camera-trace';
import {
  getMovementSetupGuide,
  getPreCaptureGuidance,
  getEffectiveRetryGuidance,
} from '@/lib/camera/camera-guidance';
import {
  cancelCorrectiveCueForSuccess,
  cancelVoiceGuidance,
  getCountdownVoiceCue,
  getReadyToShootVoiceCue,
  getStartVoiceCue,
  getSuccessVoiceCue,
  resetVoiceGuidanceSession,
  speakVoiceCue,
  speakVoiceCueAndWait,
  trySpeakCorrectiveCueWithAntiSpam,
  unlockVoiceGuidance,
} from '@/lib/camera/voice-guidance';
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

/** 시작 안내가 끝난 뒤 1초 쉬고 카운트다운 시작 */
const START_SEQUENCE_GAP_MS = 1000;
/** 3, 2, 1 사이 아주 짧은 쉼 */
const COUNTDOWN_BETWEEN_GAP_MS = 600;
const COUNTDOWN_VALUES = [3, 2, 1] as const;
/** 통과 후 다음 단계로 전환 대기 (gate 의존성 제거로 effect 재실행 방지) */
const SQUAT_AUTO_ADVANCE_MS = 700;

export default function CameraSquatPage() {
  const router = useRouter();
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>('setup');
  const [countdownValue, setCountdownValue] = useState(0);
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const armingTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const startCueAttemptedRef = useRef(false);
  const startSequenceRunIdRef = useRef(0);
  /* capturing 중 ready_to_shoot 완료 후 교정 음성 허용 여부.
   * ref가 아닌 state: true로 바뀔 때 corrective cue effect가 re-run되어야 하기 때문. */
  const [captureCuingEnabled, setCaptureCuingEnabled] = useState(false);
  const successCueAttemptedRef = useRef(false);
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
  const effectivePassLatched = finalPassLatched || passLatched;
  const setupFramingHint = useMemo(() => getSetupFramingHint(landmarks), [landmarks]);
  const liveReadinessSummary = useMemo(
    () =>
      getLiveReadinessSummary({
        success: effectivePassLatched,
        guardrail: gate.guardrail,
        framingHint: setupFramingHint,
      }),
    [effectivePassLatched, gate.guardrail, setupFramingHint]
  );
  const rawLiveReadiness = liveReadinessSummary.state;
  const primaryReadinessBlocker = getPrimaryReadinessBlocker(liveReadinessSummary);
  const { stableState: liveReadiness, smoothingApplied: readinessSmoothingApplied } =
    useStabilizedLiveReadiness(rawLiveReadiness);
  const readinessTraceSummary = useMemo(
    () => ({
      state: liveReadiness,
      rawState: rawLiveReadiness,
      blocker: primaryReadinessBlocker,
      framingHint: liveReadinessSummary.framingHint,
      smoothingApplied: readinessSmoothingApplied,
      validFrameCount: liveReadinessSummary.inputs.validFrameCount,
      visibleJointsRatio: liveReadinessSummary.inputs.visibleJointsRatio,
      criticalJointsAvailability: liveReadinessSummary.inputs.criticalJointsAvailability,
    }),
    [
      liveReadiness,
      rawLiveReadiness,
      primaryReadinessBlocker,
      liveReadinessSummary,
      readinessSmoothingApplied,
    ]
  );

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

  const waitForTimer = useCallback(
    (ms: number, timerRef: { current: ReturnType<typeof window.setTimeout> | null }) =>
      new Promise<void>((resolve) => {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          resolve();
        }, ms);
      }),
    []
  );

  useEffect(() => {
    clearAutoAdvanceTimer();
    resetVoiceGuidanceSession();
    settledRef.current = false;
    advanceLockRef.current = false;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    passLatchedStepKeyRef.current = null;
    startCueAttemptedRef.current = false;
    startSequenceRunIdRef.current += 1;
    successCueAttemptedRef.current = false;
    lastProgressionStateRef.current = 'idle';
    setCaptureCuingEnabled(false);
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
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary);
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
  }, [gate, readinessTraceSummary]);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        start(video);
      }
      settledRef.current = false;
      setCameraReady(true);
      setProgressionState('camera_ready');
      setStatusMessage('동작을 시작해 주세요');
      appendTransition('camera_ready', 'video_ready');
      /* 음성 재생을 위해 가능한 시점에 unlock (카메라 권한 허용 시 사용자 제스처 있음) */
      unlockVoiceGuidance();
    },
    [appendTransition, start]
  );

  const handleSetupReady = useCallback(() => {
    unlockVoiceGuidance();
    if (startCueAttemptedRef.current) return;
    startCueAttemptedRef.current = true;

    /* phase를 'arming'으로 올려 UI 표시 */
    setCameraPhase('arming');

    const runId = startSequenceRunIdRef.current + 1;
    startSequenceRunIdRef.current = runId;
    const isActive = () => startSequenceRunIdRef.current === runId;
    /* liveReadiness는 useCallback dep으로 캡처되어 stale 없음 */
    const isWhite = liveReadiness === 'ready';

    const runStartSequence = async () => {
      /* white 상태면 1000ms 확인 후 ready_to_shoot 재생 (setup 단계 전용).
       * capturing 진입 후 white 전환 시의 ready_to_shoot은 별도 useEffect가 담당한다. */
      if (isWhite) {
        await waitForTimer(1000, armingTimerRef);
        if (!isActive()) return;
        await speakVoiceCueAndWait(getReadyToShootVoiceCue());
        if (!isActive()) return;
      }
      /* captureCuingEnabled는 capturing 진입 후 useEffect가 관리하므로 여기서 설정하지 않는다. */

      setCountdownValue(0);
      await speakVoiceCueAndWait(getStartVoiceCue(STEP_ID));
      if (!isActive()) return;

      await waitForTimer(START_SEQUENCE_GAP_MS, armingTimerRef);
      if (!isActive()) return;

      setCameraPhase('countdown');
      for (const value of COUNTDOWN_VALUES) {
        if (!isActive()) return;
        setCountdownValue(value);
        await speakVoiceCueAndWait(getCountdownVoiceCue(value));
        if (!isActive()) return;
        if (value !== 1) {
          await waitForTimer(COUNTDOWN_BETWEEN_GAP_MS, countdownTimerRef);
        }
      }
      if (!isActive()) return;

      setCountdownValue(0);
      setCameraPhase('capturing');
      if (videoRef.current) {
        start(videoRef.current);
      }
    };

    void runStartSequence();
  }, [liveReadiness, start, waitForTimer]);

  /* capturing 중 liveReadiness 전환 감지:
   * - white(ready) 진입 시: captureCuingEnabled=false → ready_to_shoot 재생 → 완료 후 true
   * - red(not_ready) 복귀 시: captureCuingEnabled=false (다시 white가 되면 위 흐름 반복)
   * - success 또는 pass 시: 교정 큐 불필요하므로 true로 바로 전환 */
  useEffect(() => {
    if (cameraPhase !== 'capturing') return;

    if (liveReadiness === 'ready') {
      setCaptureCuingEnabled(false);
      let cancelled = false;
      void (async () => {
        await speakVoiceCueAndWait(getReadyToShootVoiceCue());
        if (!cancelled) setCaptureCuingEnabled(true);
      })();
      return () => { cancelled = true; };
    }

    if (liveReadiness === 'not_ready') {
      setCaptureCuingEnabled(false);
    }
    /* success는 effectivePassLatched로 corrective cue effect 자체가 막힘 */
  }, [cameraPhase, liveReadiness]);

  useEffect(() => {
    if (cameraPhase !== 'capturing' || effectivePassLatched || permissionDenied) {
      return;
    }
    /* ready_to_shoot 재생이 완료되기 전까지 교정 음성 차단 */
    if (!captureCuingEnabled) return;

    trySpeakCorrectiveCueWithAntiSpam({
      stepId: STEP_ID,
      gate: {
        ...gate,
        readinessState: liveReadiness,
        framingHint:
          liveReadiness === 'not_ready' ? liveReadinessSummary.framingHint ?? null : null,
      },
      passLatched,
      liveCueingEnabled: cameraPhase === 'capturing',
    });
  }, [
    captureCuingEnabled,
    cameraPhase,
    effectivePassLatched,
    gate,
    liveReadiness,
    liveReadinessSummary.framingHint,
    permissionDenied,
  ]);

  useEffect(() => {
    if (
      !effectivePassLatched ||
      successCueAttemptedRef.current ||
      passLatchedStepKeyRef.current !== currentStepKey
    ) {
      return;
    }

    successCueAttemptedRef.current = true;
    cancelCorrectiveCueForSuccess();
    void speakVoiceCue(getSuccessVoiceCue());
  }, [currentStepKey, effectivePassLatched]);

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
    if (cameraPhase !== 'capturing') return;
    if (permissionDenied || !cameraReady || settledRef.current) {
      return;
    }

    if (effectivePassLatched) {
      latchPassEvent();
      return;
    }

    if (stats.sampledFrameCount === 0) {
      setProgressionState((prev) => (prev === 'camera_ready' ? prev : 'camera_ready'));
      setStatusMessage((prev) => (prev === '동작을 시작해 주세요' ? prev : '동작을 시작해 주세요'));
      return;
    }

    setProgressionState((prev) => (prev === gate.progressionState ? prev : gate.progressionState));
    setStatusMessage((prev) => (prev === gate.uiMessage ? prev : gate.uiMessage));

    if (gate.status === 'retry' || gate.status === 'fail') {
      settledRef.current = true;
      stop();
      setProgressionState((prev) => (prev === gate.progressionState ? prev : gate.progressionState));
      setStatusMessage((prev) => (prev === gate.uiMessage ? prev : gate.uiMessage));
      appendTransition(
        gate.progressionState,
        gate.failureReasons.length > 0 ? gate.failureReasons.join(',') : gate.reasons.join(',')
      );
    }
  }, [
    appendTransition,
    cameraPhase,
    cameraReady,
    gate.failureReasons,
    gate.progressionState,
    gate.reasons,
    gate.status,
    gate.uiMessage,
    latchPassEvent,
    effectivePassLatched,
    permissionDenied,
    stats.sampledFrameCount,
    stop,
  ]);

  useEffect(() => {
    if (!effectivePassLatched) {
      return;
    }

    if (passLatchedStepKeyRef.current !== currentStepKey) {
      latchPassEvent();
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
    }, SQUAT_AUTO_ADVANCE_MS);
  }, [
    clearAutoAdvanceTimer,
    currentStepKey,
    effectivePassLatched,
    latchPassEvent,
    navigationTriggered,
    nextPath,
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
      cancelVoiceGuidance();
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  const handleRetry = useCallback(() => {
    unlockVoiceGuidance();
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary);
    clearAutoAdvanceTimer();
    resetVoiceGuidanceSession();
    stop();
    if (armingTimerRef.current) {
      window.clearTimeout(armingTimerRef.current);
      armingTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    settledRef.current = false;
    advanceLockRef.current = false;
    startCueAttemptedRef.current = false;
    startSequenceRunIdRef.current += 1; /* 진행 중인 시퀀스 무효화 */
    passLatchedStepKeyRef.current = null;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    hasStartedRef.current = false;
    setCameraPhase('setup');
    setCountdownValue(0);
    setCameraReady(false);
    setCaptureCuingEnabled(false);
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
  }, [clearAutoAdvanceTimer, gate, readinessTraceSummary, stop]);

  const handleCameraError = useCallback(() => {
    clearAutoAdvanceTimer();
    cancelVoiceGuidance();
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
    cancelVoiceGuidance();
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
  const visibleUserGuidance = effectivePassLatched
    ? []
    : retryGuidance
      ? [retryGuidance.primary, retryGuidance.secondary].filter(Boolean)
      : gate.userGuidance;
  const showPreCaptureHint =
    (progressionState === 'camera_ready' || progressionState === 'insufficient_signal') &&
    stats.sampledFrameCount < 8;
  const effectiveProgressionState = effectivePassLatched ? 'passed' : progressionState;
  const guideTone = getGuideToneFromLiveReadiness(liveReadiness);
  const overlayGuide = getSquatOverlayGuide(gate.failureReasons, effectiveProgressionState);
  const isPreCapturePhase =
    cameraPhase === 'setup' || cameraPhase === 'arming' || cameraPhase === 'countdown';
  const isMinimalCapture =
    cameraPhase === 'capturing' && !showRetryActions;
  const showDebugPanel =
    debugEnabled &&
    (isPreCapturePhase ||
      showRetryActions ||
      (typeof window !== 'undefined' && window.location.search.includes('debug=1')));

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
        {!isMinimalCapture && (
          <>
            <h1
              className="text-xl font-bold text-slate-100 mb-2 shrink-0"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              스쿼트
            </h1>
            <p
              className="text-slate-400 text-sm mb-4 text-center break-keep shrink-0"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {cameraPhase === 'setup' ? (
                <>
                  휴대폰을 벽이나 가구에 기대 세워 주세요.
                  <br />
                  머리부터 발끝까지 화면 안에 들어오면 됩니다.
                  <br />
                  <span className="text-slate-300 mt-1 block">{INSTRUCTION}</span>
                </>
              ) : cameraPhase === 'arming' ? (
                '준비 중...'
              ) : cameraPhase === 'countdown' ? (
                ''
              ) : (
                '위치를 다시 맞춰 주세요'
              )}
            </p>
          </>
        )}

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
            <div className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center relative">
              <CameraPreview
                key={previewKey}
                onVideoReady={handleVideoReady}
                onPoseFrame={pushFrame}
                onError={handleCameraError}
                guideTone={isPreCapturePhase ? 'neutral' : guideTone}
                guideHint={isMinimalCapture ? null : isPreCapturePhase ? null : overlayGuide.hint}
                guideFocus={isMinimalCapture ? null : isPreCapturePhase ? null : overlayGuide.focus}
                guideAnimated={isMinimalCapture ? false : isPreCapturePhase ? false : overlayGuide.animated}
                guideVariant="default"
                guideBadges={isMinimalCapture ? [] : cameraPhase === 'setup' ? ['전신', '1.8~2m 거리', '폰 낮게'] : []}
                guideInstructions={cameraPhase === 'setup' ? setupGuide.instructions : undefined}
                guideReadinessLabel={cameraPhase === 'setup' ? setupGuide.readinessLabel : null}
                minimalCaptureMode={isMinimalCapture}
                className="w-full"
              />
              {cameraPhase === 'countdown' && countdownValue > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-live="polite"
                >
                  <span
                    className="text-8xl font-bold text-white drop-shadow-lg"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {countdownValue}
                  </span>
                </div>
              )}
            </div>
            {!isMinimalCapture && (
            <div className="w-full max-w-md mt-4 space-y-3 shrink-0">
              {isPreCapturePhase ? (
                <div className="space-y-3">
                  <p
                    className="text-center text-xs text-slate-500"
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {cameraPhase === 'arming'
                      ? '준비 중...'
                      : cameraPhase === 'countdown'
                        ? ''
                        : setupFramingHint ?? '준비가 되면 다음으로 넘어가세요'}
                  </p>
                  {cameraPhase === 'setup' && (
                    <button
                      type="button"
                      onClick={handleSetupReady}
                      className="w-full min-h-[48px] rounded-xl font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
                      style={{ fontFamily: 'var(--font-sans-noto)' }}
                    >
                      준비됐어요
                    </button>
                  )}
                </div>
              ) : showRetryActions ? (
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
              ) : (
                <>
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

              {showDebugPanel && (
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
                    <span>readinessRaw: {rawLiveReadiness}</span>
                    <span>readinessStable: {liveReadiness}</span>
                    <span>readinessBlocker: {primaryReadinessBlocker ?? 'none'}</span>
                    <span>readinessSmoothing: {String(readinessSmoothingApplied)}</span>
                    <span>motionStatus: {gate.guardrail.completionStatus}</span>
                    <span>visibleRatio: {gate.guardrail.debug.visibleJointsRatio}</span>
                    <span>criticalRatio: {gate.guardrail.debug.criticalJointsAvailability}</span>
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
                  <TraceDebugPanel
                    liveReadiness={{
                      ...readinessTraceSummary,
                      finalPassLatched,
                    }}
                  />
                </div>
              )}

              {!showRetryActions && IS_DEV && !advanceLockRef.current && (
                <button
                  type="button"
                  onClick={handleDevOverride}
                  className="w-full min-h-[44px] rounded-xl border border-amber-500/30 text-amber-200 hover:bg-amber-500/10 transition-colors"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  강제 다음
                </button>
              )}
          </>
        )}
            </div>
            )}
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
