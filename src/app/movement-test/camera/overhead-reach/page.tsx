'use client';

/**
 * 카메라 테스트 - 오버헤드 리치
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
  isFinalPassLatched,
  isGatePassReady,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';
import {
  getGuideToneFromLiveReadiness,
  getLiveReadinessSummary,
  getPrimaryReadinessBlocker,
  useStabilizedLiveReadiness,
  type LiveReadinessState,
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
  getFollowUpIntroVoiceCue,
  getReadyToShootVoiceCue,
  getStartVoiceCue,
  getFinalSuccessVoiceCue,
  hasFunnelIntroPlayed,
  hasReadyToShootPlayedThisSession,
  markReadyToShootPlayed,
  resetVoiceGuidanceSession,
  setFunnelIntroPlayed,
  speakVoiceCue,
  speakVoiceCueAndWait,
  trySpeakCorrectiveCueWithAntiSpam,
  unlockVoiceGuidance,
} from '@/lib/camera/voice-guidance';
import { getSetupFramingHint } from '@/lib/camera/setup-framing';
import { TraceDebugPanel } from '@/components/camera/TraceDebugPanel';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
const STEP_ID: CameraStepId = 'overhead-reach';
const IS_DEV = process.env.NODE_ENV !== 'production';
/** final outro 재생 실패 시 fallback 대기 시간 (ms) */
const FINAL_OUTRO_FALLBACK_MS = 5000;
const DEBUG_SESSION_KEY = `move-re-camera-debug:${STEP_ID}`;

const INSTRUCTION = '정면으로 서서 양팔을 머리 위로 올리고, 맨 위에서 잠깐 멈춰주세요.';

interface OverheadReachDebugSnapshot {
  exercise: CameraStepId;
  passedAt: string;
  currentStepKey: string;
  metrics: {
    armRange: number | null;
    armElevation: number | null;
    symmetry: number | null;
    compensation: number | null;
    holdDurationMs: number;
    raiseCount: number;
    peakCount: number;
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

interface OverheadReachOverlayGuide {
  hint: string | null;
  focus: 'frame' | 'upper' | 'lower' | 'full' | null;
  animated: boolean;
}

function getOverheadReachOverlayGuide(
  reasons: string[],
  failureReasons: string[],
  progressionState: ExerciseProgressionState
): OverheadReachOverlayGuide {
  if (progressionState === 'passed') {
    return { hint: '통과', focus: 'upper', animated: true };
  }

  if (
    failureReasons.includes('framing_invalid') ||
    failureReasons.includes('left_side_missing') ||
    failureReasons.includes('right_side_missing') ||
    failureReasons.includes('hard_partial') ||
    failureReasons.includes('capture_quality_invalid') ||
    failureReasons.includes('capture_quality_low')
  ) {
    return { hint: '손끝까지 보이기', focus: 'frame', animated: true };
  }

  if (failureReasons.includes('hold_too_short')) {
    return { hint: '위에서 잠깐 멈추기', focus: 'upper', animated: true };
  }

  if (reasons.includes('rep_incomplete') || reasons.includes('raise_peak_incomplete')) {
    return { hint: '양팔 머리 위로', focus: 'upper', animated: true };
  }

  if (failureReasons.includes('confidence_too_low')) {
    return { hint: '자세 고정', focus: 'upper', animated: false };
  }

  if (progressionState === 'camera_ready') {
    return { hint: '정면 준비', focus: 'upper', animated: false };
  }

  return { hint: null, focus: null, animated: false };
}

export default function CameraOverheadReachPage() {
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
  const [successSnapshot, setSuccessSnapshot] = useState<OverheadReachDebugSnapshot | null>(null);
  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture();
  const hasStartedRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const passLatchedStepKeyRef = useRef<string | null>(null);
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const startCueAttemptedRef = useRef(false);
  const successCueAttemptedRef = useRef(false);
  const [startSequenceComplete, setStartSequenceComplete] = useState(false);
  /** PR G2: readiness phase 기반 큐잉 게이트 (ready_to_shoot 재생 중 = false) */
  const [captureCuingEnabled, setCaptureCuingEnabled] = useState(false);
  /** PR HOTFIX-02: start sequence 이후 직전 readiness 추적 (red→white 전환 감지용) */
  const prevCapturingReadinessRef = useRef<LiveReadinessState | null>(null);
  /** PR HOTFIX-02: ready_to_shoot 시도 여부 — async IIFE 재진입 방지 */
  const readyToShootAttemptedRef = useRef(false);
  const currentStepKey = `${STEP_ID}:${previewKey}`;
  const nextPath = getNextStepPath(STEP_ID) ?? '/movement-test/camera/complete';
  /** 마지막 단계(overhead-reach → complete): outro 재생 완료 후에만 이동 */
  const isFinalStep = getNextStepPath(STEP_ID) === null;
  const debugEnabled = IS_DEV;

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );
  const passReady = isGatePassReady(gate);
  const finalPassLatched = isFinalPassLatched(STEP_ID, gate);
  const effectivePassLatched = finalPassLatched || passLatched;
  const raiseCount =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.raiseCount === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.raiseCount
      : 0;
  const peakCount =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.peakCount === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.peakCount
      : 0;
  const holdDurationMs =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.holdDurationMs === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.holdDurationMs
      : 0;
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
  const armRange = getMetricValueFromList(gate.evaluatorResult.metrics, 'arm_range');
  const compensation = getMetricValueFromList(gate.evaluatorResult.metrics, 'lumbar_extension');
  const symmetry = getMetricValueFromList(gate.evaluatorResult.metrics, 'asymmetry');
  const armElevation =
    typeof gate.evaluatorResult.debug?.highlightedMetrics?.peakArmElevation === 'number'
      ? gate.evaluatorResult.debug.highlightedMetrics.peakArmElevation
      : armRange;

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
      console.info('[camera:overhead-reach-success-snapshot]', successSnapshot);
    } catch {
      // ignore debug persistence failures
    }
  }, [debugEnabled, successSnapshot]);

  useEffect(() => {
    clearAutoAdvanceTimer();
    resetVoiceGuidanceSession();
    settledRef.current = false;
    advanceLockRef.current = false;
    passLatchedStepKeyRef.current = null;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    startCueAttemptedRef.current = false;
    successCueAttemptedRef.current = false;
    prevCapturingReadinessRef.current = null;
    readyToShootAttemptedRef.current = false;
    setStartSequenceComplete(false);
    setCaptureCuingEnabled(false);
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
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
      liveCueingEnabled: startSequenceComplete,
      autoNextObservation: nextTriggerReason ?? 'pass_latched',
    });
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
  }, [gate, nextTriggerReason, readinessTraceSummary, startSequenceComplete]);

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

  /* PR G4: funnel intro 중복 제거 — squat 이후 overhead 진입 시 "촬영이 시작됩니다" 재실행 금지.
   * PR G2 follow-up intro: squat 성공 후 overhead 진입 시 "두번째 테스트입니다..." 필수 재생.
   * intro 재생 완료 전까지 startSequenceComplete=false → readiness/평가/live cue 모두 비활성화. */
  useEffect(() => {
    if (!cameraReady || startCueAttemptedRef.current) {
      return;
    }

    startCueAttemptedRef.current = true;
    const alreadyPlayed = hasFunnelIntroPlayed();

    if (alreadyPlayed) {
      /* squat 이후 진입: follow-up intro 1회 재생, 완료 후에만 overhead evaluation 활성화 */
      const cancelledRef = { current: false };
      const idRef = { current: null as ReturnType<typeof setTimeout> | null };
      void (async () => {
        await speakVoiceCueAndWait(getFollowUpIntroVoiceCue());
        if (cancelledRef.current) return;
        idRef.current = window.setTimeout(() => {
          if (cancelledRef.current) return;
          setStartSequenceComplete(true);
        }, 800);
      })();
      return () => {
        cancelledRef.current = true;
        if (idRef.current) window.clearTimeout(idRef.current);
      };
    }

    void speakVoiceCue(getStartVoiceCue(STEP_ID));
    setFunnelIntroPlayed();
    const id = window.setTimeout(() => setStartSequenceComplete(true), 3000);
    return () => window.clearTimeout(id);
  }, [cameraReady]);

  /* PR HOTFIX-02: start sequence 완료 후 red → white 전환 감지 및 one-shot ready_to_shoot 재생
   * squat/page.tsx와 동일한 패턴. getReadyToShootVoiceCue()에 interrupt:true가 추가되어
   * 재생 중인 framing cue(priority 5)에 의한 차단 문제도 함께 해소됨. */
  useEffect(() => {
    if (!startSequenceComplete) {
      prevCapturingReadinessRef.current = null;
      readyToShootAttemptedRef.current = false;
      return;
    }

    const prevReadiness = prevCapturingReadinessRef.current;
    const enteredWhite = prevReadiness !== 'ready' && liveReadiness === 'ready';
    prevCapturingReadinessRef.current = liveReadiness;

    if (liveReadiness === 'ready') {
      setCaptureCuingEnabled(false);

      const alreadyHandled =
        hasReadyToShootPlayedThisSession() ||
        readyToShootAttemptedRef.current ||
        !enteredWhite;

      if (alreadyHandled) {
        setCaptureCuingEnabled(true);
        return;
      }

      readyToShootAttemptedRef.current = true;
      let cancelled = false;
      void (async () => {
        const played = await speakVoiceCueAndWait(getReadyToShootVoiceCue());
        markReadyToShootPlayed();
        if (IS_DEV) {
          console.info('[camera:overhead-reach-white-transition]', {
            prevReadiness,
            enteredWhite,
            played,
            suppressionReason: played ? null : 'playback_returned_false',
            readyToShootPlayedThisSession: true,
          });
        }
        if (!cancelled) setCaptureCuingEnabled(true);
      })();
      return () => { cancelled = true; };
    }

    if (liveReadiness === 'not_ready') {
      setCaptureCuingEnabled(true);
    }
  }, [startSequenceComplete, liveReadiness]);

  useEffect(() => {
    if (effectivePassLatched || permissionDenied || !captureCuingEnabled) {
      return;
    }
    /* captureCuingEnabled state가 다음 렌더에 반영되기 전 보호: ready_to_shoot 재생 중에는
     * priority 4 stability cue가 ready_to_shoot(3)을 interrupt하지 않도록 차단 */
    if (readyToShootAttemptedRef.current && !hasReadyToShootPlayedThisSession()) return;

    trySpeakCorrectiveCueWithAntiSpam({
      stepId: STEP_ID,
      gate: {
        ...gate,
        readinessState: liveReadiness,
        framingHint:
          liveReadiness === 'not_ready' ? liveReadinessSummary.framingHint ?? null : null,
      },
      passLatched: effectivePassLatched,
      liveCueingEnabled: startSequenceComplete,
    });
  }, [
    captureCuingEnabled,
    effectivePassLatched,
    gate,
    liveReadiness,
    liveReadinessSummary.framingHint,
    permissionDenied,
    startSequenceComplete,
  ]);

  useEffect(() => {
    if (!effectivePassLatched || successCueAttemptedRef.current) {
      return;
    }
    /* 마지막 단계: success cue는 navigation effect에서 speakVoiceCueAndWait로 재생 후 이동 */
    if (isFinalStep) {
      return;
    }

    successCueAttemptedRef.current = true;
    cancelCorrectiveCueForSuccess();
    void speakVoiceCue(getFinalSuccessVoiceCue());
  }, [effectivePassLatched, isFinalStep]);

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
        armRange,
        armElevation,
        symmetry,
        compensation,
        holdDurationMs,
        raiseCount,
        peakCount,
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
    armElevation,
    armRange,
    compensation,
    currentStepKey,
    gate.completionSatisfied,
    gate.confidence,
    gate.failureReasons,
    gate.flags,
    gate.guardrail.captureQuality,
    gate.nextAllowed,
    gate.progressionState,
    gate.status,
    gate.uiMessage,
    holdDurationMs,
    nextPath,
    passLatched,
    peakCount,
    persistCurrentStep,
    raiseCount,
    stop,
    symmetry,
  ]);

  /* PR G5: passConfirmed -> passLatched 공통 계약. effectivePassLatched(finalPassLatched || passLatched)로 latch. */
  useEffect(() => {
    if (permissionDenied || !cameraReady || passLatched || settledRef.current) {
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
    effectivePassLatched,
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
      setSuccessSnapshot((prev) =>
        prev
          ? {
              ...prev,
              navigation: {
                ...prev.navigation,
                nextPath,
                autoAdvanceReason: 'transition_not_triggered',
              },
            }
          : prev
      );
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

    const doNavigate = () => {
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
    };

    if (isFinalStep) {
      /* 마지막 단계: final outro 재생 완료 후에만 이동. 실패/타임아웃 시 fallback으로 이동 */
      void (async () => {
        const timeout = new Promise<boolean>((r) =>
          setTimeout(() => r(false), FINAL_OUTRO_FALLBACK_MS)
        );
        await Promise.race([
          speakVoiceCueAndWait(getFinalSuccessVoiceCue()),
          timeout,
        ]);
        doNavigate();
      })();
    } else {
      autoAdvanceTimerRef.current = window.setTimeout(doNavigate, gate.autoAdvanceDelayMs);
    }
  }, [
    clearAutoAdvanceTimer,
    currentStepKey,
    effectivePassLatched,
    gate.autoAdvanceDelayMs,
    isFinalStep,
    latchPassEvent,
    navigationTriggered,
    nextPath,
    router,
  ]);

  useEffect(() => {
    return () => {
      cancelVoiceGuidance();
      clearAutoAdvanceTimer();
    };
  }, [clearAutoAdvanceTimer]);

  const handleRetry = useCallback(() => {
    unlockVoiceGuidance();
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
      liveCueingEnabled: startSequenceComplete,
      autoNextObservation: 'retry',
    });
    clearAutoAdvanceTimer();
    resetVoiceGuidanceSession();
    stop();
    settledRef.current = false;
    advanceLockRef.current = false;
    passLatchedStepKeyRef.current = null;
    scheduledAdvanceStepKeyRef.current = null;
    triggeredAdvanceStepKeyRef.current = null;
    hasStartedRef.current = false;
    prevCapturingReadinessRef.current = null;
    readyToShootAttemptedRef.current = false;
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
  }, [clearAutoAdvanceTimer, gate, readinessTraceSummary, startSequenceComplete, stop]);

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
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setSuccessSnapshot(null);
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
  const isMinimalCapture = !showRetryActions;
  const showDebugPanel =
    debugEnabled &&
    (showRetryActions ||
      (typeof window !== 'undefined' && window.location.search.includes('debug=1')));
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
  const overlayGuide = getOverheadReachOverlayGuide(
    gate.reasons,
    gate.failureReasons,
    effectiveProgressionState
  );
  const autoNextObservation =
    effectivePassLatched && !nextTriggeredAt
      ? nextScheduledAt
        ? 'pass_latched_waiting_for_auto_next'
        : 'transition_not_triggered'
      : nextTriggeredAt
        ? 'next_triggered'
        : 'pass_not_latched';
  /* PR G4: readiness parity — fallback/default red, warm-up/settle window.
   * 진입 직후 즉시 white 금지. startSequenceComplete 전이거나 샘플 8프레임 미만이면 red 유지. */
  const isOverheadWarmupPhase =
    !startSequenceComplete || stats.sampledFrameCount < 8;
  const guideTone = isOverheadWarmupPhase
    ? 'warning'
    : getGuideToneFromLiveReadiness(liveReadiness);

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
          2 / 2
        </p>
        <div className="w-12" />
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-4 overflow-hidden">
        {!isMinimalCapture && (
          <>
            <h1
              className="text-xl font-bold text-slate-100 mb-2"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              오버헤드 리치
            </h1>
            <p
              className="text-slate-400 text-sm mb-4 text-center break-keep"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              위치를 다시 맞춰 주세요
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
            <div className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center">
              <CameraPreview
                key={previewKey}
                onVideoReady={handleVideoReady}
                onPoseFrame={pushFrame}
                onError={handleCameraError}
                guideTone={guideTone}
                guideHint={isMinimalCapture ? null : overlayGuide.hint}
                guideFocus={isMinimalCapture ? null : overlayGuide.focus}
                guideAnimated={isMinimalCapture ? false : overlayGuide.animated}
                guideVariant="overhead-reach"
                guideBadges={[]}
                guideInstructions={undefined}
                guideReadinessLabel={null}
                minimalCaptureMode={isMinimalCapture}
                className="w-full"
              />
            </div>
            {!isMinimalCapture && (
            <div className="w-full max-w-md mt-4 space-y-3">
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
              {showDebugPanel && (
                <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-4 text-left">
                  <p className="text-xs text-amber-200" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    overhead reach debug
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
                    <span>finalPassLatched: {String(finalPassLatched)}</span>
                    <span>introAlreadyPlayed: {String(hasFunnelIntroPlayed())}</span>
                    <span>introSuppressedReason: {hasFunnelIntroPlayed() ? 'funnel_intro_already_played' : 'n/a'}</span>
                    <span>readinessPhase: {isOverheadWarmupPhase ? 'warmup' : liveReadiness}</span>
                    <span>readinessRaw: {rawLiveReadiness}</span>
                    <span>readinessStable: {liveReadiness}</span>
                    <span>readinessBlocker: {primaryReadinessBlocker ?? 'none'}</span>
                    <span>readinessSmoothing: {String(readinessSmoothingApplied)}</span>
                    <span>silhouetteVsVoice: {isOverheadWarmupPhase ? 'warmup_override' : 'match'}</span>
                    <span>startPoseSatisfied: {String(stats.sampledFrameCount >= 8)}</span>
                    <span>upwardMotionDetected: {String(raiseCount > 0)}</span>
                    <span>topReachDetected: {String(peakCount > 0)}</span>
                    <span>holdSatisfied: {String(holdDurationMs >= 600)}</span>
                    <span>holdTooShort: {String(gate.failureReasons?.includes('hold_too_short') ?? false)}</span>
                    <span>passBlockedReason: {gate.completionSatisfied ? 'n/a' : (stats.captureDurationMs < 800 ? 'arming_window' : gate.guardrail.completionStatus !== 'complete' ? 'guardrail_not_complete' : 'metrics')}</span>
                    <span>latchBlockedReason: {effectivePassLatched ? 'n/a' : (!gate.completionSatisfied ? 'completion' : !gate.passConfirmationSatisfied ? 'passConfirmation' : gate.guardrail.captureQuality === 'invalid' ? 'captureQuality' : gate.confidence < 0.72 ? 'confidence' : 'passFrames')}</span>
                    <span>passConfirmed: {String(gate.passConfirmationSatisfied)}</span>
                    <span>passFrames: {gate.passConfirmationFrameCount}/{gate.passConfirmationWindowCount}</span>
                    <span>passLatchedAt: {passLatchedAt ?? 'n/a'}</span>
                    <span>navigationTriggered: {String(navigationTriggered)}</span>
                    <span>transitionLocked: {String(transitionLocked)}</span>
                    <span>autoAdvanceScheduled: {String(autoAdvanceScheduled)}</span>
                    <span>currentStepKey: {currentStepKey}</span>
                    <span>nextPath: {nextPath ?? 'n/a'}</span>
                    <span>nextScheduledAt: {nextScheduledAt ?? 'n/a'}</span>
                    <span>nextTriggeredAt: {nextTriggeredAt ?? 'n/a'}</span>
                    <span>autoAdvanceReason: {nextTriggerReason ?? 'n/a'}</span>
                    <span>autoNextObservation: {autoNextObservation}</span>
                    <span>armRange: {armRange ?? 'n/a'}</span>
                    <span>armElevation: {armElevation ?? 'n/a'}</span>
                    <span>symmetry: {symmetry ?? 'n/a'}</span>
                    <span>compensation: {compensation ?? 'n/a'}</span>
                    <span>raiseCount: {raiseCount}</span>
                    <span>peakCount: {peakCount}</span>
                    <span>holdDurationMs: {holdDurationMs}</span>
                    <span>validFrames: {gate.guardrail.debug.validFrameCount}</span>
                    <span>visibleRatio: {gate.guardrail.debug.visibleJointsRatio}</span>
                    <span>criticalRatio: {gate.guardrail.debug.criticalJointsAvailability}</span>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                    <p>flags: {gate.flags.join(', ') || 'none'}</p>
                    <p>failureReasons: {gate.failureReasons.join(', ') || 'none'}</p>
                    <p>snapshotStored: {successSnapshot ? 'yes' : 'no'}</p>
                  </div>
                  <TraceDebugPanel
                    liveReadiness={{
                      ...readinessTraceSummary,
                      finalPassLatched: effectivePassLatched,
                    }}
                    liveCueingEnabled={startSequenceComplete}
                  />
                </div>
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
