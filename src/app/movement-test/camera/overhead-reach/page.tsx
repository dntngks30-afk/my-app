'use client';

/**
 * 카메라 테스트 - 오버헤드 리치
 * AI gate가 pass / retry / fail을 판단하고 자동 진행한다.
 */
import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/trackEvent';
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
import type { PoseFrame, PoseLandmarks } from '@/lib/motion/pose-types';
import { usePoseCapture } from '@/lib/camera/use-pose-capture';
import {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
  isGatePassReady,
  type ExerciseGateResult,
  type ExerciseProgressionState,
} from '@/lib/camera/auto-progression';
import {
  getGuideToneFromLiveReadiness,
  getLiveReadinessSummary,
  getPrimaryReadinessBlocker,
  useStabilizedLiveReadiness,
  type LiveReadinessState,
} from '@/lib/camera/live-readiness';
import { recordAttemptSnapshot, recordOverheadObservationEvent } from '@/lib/camera/camera-trace';
import {
  buildOverheadVisualTruthSnapshotRecordAttemptOptions,
  captureOverheadTruthSnapshotDataUrl,
} from '@/lib/camera/overhead/visual-snapshot-export';
import {
  recordOverheadSuccessSnapshot,
  isDiagnosticFreezeMode,
  type SuccessOpenedBy,
} from '@/lib/camera/camera-success-diagnostic';
import {
  getMovementSetupGuide,
  getPreCaptureGuidance,
  getEffectiveRetryGuidance,
} from '@/lib/camera/camera-guidance';
import {
  cancelCorrectiveCueForSuccess,
  cancelVoiceGuidance,
  getFollowUpIntroVoiceCue,
  getOverheadAmbiguousRetryVoiceCue,
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
import { deriveOverheadAmbiguousRetryReason } from '@/lib/camera/overhead/overhead-ambiguous-retry';
import {
  OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE,
  computeOverheadRetryFailDeferral,
  isOverheadAccumulationGraceEligible,
  type OverheadAttemptFailureType,
} from '@/lib/camera/overhead/overhead-input-stability';
import {
  getSetupFramingHint,
  resolveOverheadReadinessFramingHint,
} from '@/lib/camera/setup-framing';
import {
  buildOverheadReadinessBlockerTracePayload,
  deriveDisplayedPrimaryBlockerSource,
  type OverheadReadinessBlockerMotionLatch,
} from '@/lib/camera/overhead/overhead-readiness-blocker-trace';
import { TraceDebugPanel } from '@/components/camera/TraceDebugPanel';
import { SuccessFreezeOverlay } from '@/components/camera/SuccessFreezeOverlay';

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
    return { hint: '거리·손 안 잘림', focus: 'frame', animated: true };
  }

  if (failureReasons.includes('hold_too_short')) {
    return { hint: '맨 위에서 손+얼굴 유지', focus: 'upper', animated: true };
  }

  if (reasons.includes('rep_incomplete') || reasons.includes('raise_peak_incomplete')) {
    return { hint: '머리 옆으로 세워 올리기', focus: 'upper', animated: true };
  }

  if (failureReasons.includes('confidence_too_low')) {
    return { hint: '자세 고정', focus: 'upper', animated: false };
  }

  if (progressionState === 'camera_ready') {
    return { hint: '정면·거리 맞추기', focus: 'upper', animated: false };
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
  const [showSuccessFreezeOverlay, setShowSuccessFreezeOverlay] = useState(false);
  const [nextScheduledAt, setNextScheduledAt] = useState<string | null>(null);
  const [nextTriggeredAt, setNextTriggeredAt] = useState<string | null>(null);
  const [nextTriggerReason, setNextTriggerReason] = useState<string | null>(null);
  const [successSnapshot, setSuccessSnapshot] = useState<OverheadReachDebugSnapshot | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const acceptedSnapshotDataUrlsRef = useRef<string[]>([]);

  const onHookAcceptedFrameForSnapshots = useCallback(
    ({ poseFrame }: { poseFrame: PoseFrame; landmarkRow: PoseLandmarks }) => {
      const video = previewVideoRef.current;
      if (!video) {
        acceptedSnapshotDataUrlsRef.current = [...acceptedSnapshotDataUrlsRef.current.slice(-179), ''];
        return;
      }
      const url = captureOverheadTruthSnapshotDataUrl(video, poseFrame) ?? '';
      acceptedSnapshotDataUrlsRef.current = [...acceptedSnapshotDataUrlsRef.current.slice(-179), url];
    },
    []
  );

  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture({
    mode: 'overhead-reach',
    onHookAcceptedFrame: onHookAcceptedFrameForSnapshots,
  });
  const hasStartedRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const passLatchedStepKeyRef = useRef<string | null>(null);
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const startCueAttemptedRef = useRef(false);
  const successCueAttemptedRef = useRef(false);
  /** final step: outro가 navigation을 독점. 재진입 시 중복 async 방지 */
  const finalStepOutroInProgressRef = useRef(false);
  const [startSequenceComplete, setStartSequenceComplete] = useState(false);
  /** PR G2: readiness phase 기반 큐잉 게이트 (ready_to_shoot 재생 중 = false) */
  const [captureCuingEnabled, setCaptureCuingEnabled] = useState(false);
  /** PR HOTFIX-02: start sequence 이후 직전 readiness 추적 (red→white 전환 감지용) */
  const prevCapturingReadinessRef = useRef<LiveReadinessState | null>(null);
  /** PR HOTFIX-02: ready_to_shoot 시도 여부 — async IIFE 재진입 방지 */
  const readyToShootAttemptedRef = useRef(false);
  /** PR-C4: hold cue one-shot — 이번 시도에서 1회만 재생 */
  const holdCuePlayedRef = useRef(false);
  /** PR-C4: hold cue 재생 중 success overlap 차단 */
  const [holdCueActive, setHoldCueActive] = useState(false);
  const currentStepKey = `${STEP_ID}:${previewKey}`;
  const ambiguousRetryPlayedForStepRef = useRef<string | null>(null);
  /** PR-02A: 터미널 retry/fail 시도당 attempt snapshot 1회 — handleRetry와 중복 방지 */
  const terminalAttemptSnapshotRecordedStepKeyRef = useRef<string | null>(null);
  /** OBS: 오버헤드 mid-attempt 관측 엣지(스텝당 1회 리셋) */
  const overheadObsEdgeRef = useRef({
    attemptStarted: false,
    meaningfulRise: false,
    topDetected: false,
    stableTop: false,
    holdStarted: false,
    holdSatisfied: false,
    completionBlocked: null as string | null,
    finalPassBlocked: null as string | null,
  });
  /** OBS: capture_session_terminal 1회/스텝 */
  const overheadTerminalObsStepKeyRef = useRef<string | null>(null);
  /** PR-OH-INPUT-STABILITY-02A: bounded accumulation grace start (performance.now); Category 2 only */
  const overheadAccumulationGraceStartedAtRef = useRef<number | null>(null);
  /** True once we deferred terminal at least once this attempt (for snapshot diagnosis). */
  const overheadTerminalDeferralOccurredRef = useRef(false);
  /** PR-OH-OBS-BLOCKER-TRACE-02C */
  const overheadBlockerTimeRef = useRef<{ firstSeenAtMs: number | null; lastSeenAtMs: number | null }>({
    firstSeenAtMs: null,
    lastSeenAtMs: null,
  });
  const overheadBlockerMotionLatchRef = useRef<OverheadReadinessBlockerMotionLatch>({
    seenDuringActiveMotion: false,
    seenAfterMotionWindow: false,
    lastSignals: null,
  });
  const prevStepKeyForAmbiguousRef = useRef(currentStepKey);
  const gateRef = useRef<ExerciseGateResult | null>(null);
  const nextPath = getNextStepPath(STEP_ID) ?? '/movement-test/camera/complete';
  /** 마지막 단계(overhead-reach → complete): outro 재생 완료 후에만 이동 */
  const isFinalStep = getNextStepPath(STEP_ID) === null;
  const debugEnabled = IS_DEV;

  useEffect(() => {
    trackEvent('camera_step_started', {
      route_group: 'camera_refine',
      movement_key: STEP_ID,
    });
  }, []);

  const gate = useMemo(
    () => evaluateExerciseAutoProgress(STEP_ID, landmarks, stats),
    [landmarks, stats]
  );

  useLayoutEffect(() => {
    if (prevStepKeyForAmbiguousRef.current !== currentStepKey) {
      ambiguousRetryPlayedForStepRef.current = null;
      terminalAttemptSnapshotRecordedStepKeyRef.current = null;
      overheadTerminalObsStepKeyRef.current = null;
      overheadAccumulationGraceStartedAtRef.current = null;
      overheadTerminalDeferralOccurredRef.current = false;
      overheadObsEdgeRef.current = {
        attemptStarted: false,
        meaningfulRise: false,
        topDetected: false,
        stableTop: false,
        holdStarted: false,
        holdSatisfied: false,
        completionBlocked: null,
        finalPassBlocked: null,
      };
      overheadBlockerTimeRef.current = { firstSeenAtMs: null, lastSeenAtMs: null };
      overheadBlockerMotionLatchRef.current = {
        seenDuringActiveMotion: false,
        seenAfterMotionWindow: false,
        lastSignals: null,
      };
      prevStepKeyForAmbiguousRef.current = currentStepKey;
    }
  }, [currentStepKey]);

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  const emitOverheadCaptureTerminalOnce = useCallback(
    (g: ExerciseGateResult, kind: string) => {
      if (overheadTerminalObsStepKeyRef.current === currentStepKey) return;
      overheadTerminalObsStepKeyRef.current = currentStepKey;
      recordOverheadObservationEvent(g, currentStepKey, 'capture_session_terminal', {
        captureTerminalKind: kind,
      });
    },
    [currentStepKey]
  );

  const passReady = isGatePassReady(gate);
  const finalPassLatched = isFinalPassLatched(STEP_ID, gate);
  const effectivePassLatched = finalPassLatched || passLatched;

  useEffect(() => {
    if (!passLatched) return;
    trackEvent('camera_step_completed', {
      route_group: 'camera_refine',
      movement_key: STEP_ID,
      pass_latched: true,
      retry_count: previewKey,
      evidence_quality: gate.guardrail.captureQuality ?? null,
    });
  }, [gate.guardrail.captureQuality, passLatched, previewKey]);

  /* OBS: 오버헤드 mid-attempt 관측 — highlightedMetrics·gate 엣지만(프레임 로그 없음) */
  useEffect(() => {
    if (!cameraReady || permissionDenied || effectivePassLatched) return;
    /* OBS: 동일 attemptCorrelationId(currentStepKey)에서 capture_session_terminal 이후 mid 이벤트 금지 */
    if (overheadTerminalObsStepKeyRef.current === currentStepKey) return;
    if (stats.sampledFrameCount < 1) return;
    const hm = gate.evaluatorResult?.debug?.highlightedMetrics as Record<string, unknown> | undefined;
    if (!hm) return;

    const ref = overheadObsEdgeRef.current;

    if (!ref.attemptStarted) {
      recordOverheadObservationEvent(gate, currentStepKey, 'attempt_started');
      ref.attemptStarted = true;
    }

    if (hm.meaningfulRiseSatisfied === 1 && !ref.meaningfulRise) {
      recordOverheadObservationEvent(gate, currentStepKey, 'meaningful_rise_satisfied');
      ref.meaningfulRise = true;
    }
    if (hm.topDetected === 1 && !ref.topDetected) {
      recordOverheadObservationEvent(gate, currentStepKey, 'top_detected');
      ref.topDetected = true;
    }
    if (hm.stableTopEntry === 1 && !ref.stableTop) {
      recordOverheadObservationEvent(gate, currentStepKey, 'stable_top_entered');
      ref.stableTop = true;
    }
    if (hm.holdStarted === 1 && !ref.holdStarted) {
      recordOverheadObservationEvent(gate, currentStepKey, 'hold_started');
      ref.holdStarted = true;
    }
    if (hm.holdSatisfied === 1 && !ref.holdSatisfied) {
      recordOverheadObservationEvent(gate, currentStepKey, 'hold_satisfied');
      ref.holdSatisfied = true;
    }

    if (ref.attemptStarted) {
      const cb = (hm.completionBlockedReason as string | null | undefined) ?? null;
      if (cb !== ref.completionBlocked && ref.completionBlocked != null) {
        recordOverheadObservationEvent(gate, currentStepKey, 'completion_blocked_changed', {
          priorCompletionBlockedReason: ref.completionBlocked,
        });
      }
      ref.completionBlocked = cb;

      const fp =
        typeof gate.finalPassBlockedReason === 'string' ? gate.finalPassBlockedReason : null;
      if (fp !== ref.finalPassBlocked && ref.finalPassBlocked != null) {
        recordOverheadObservationEvent(gate, currentStepKey, 'final_pass_blocked_changed', {
          priorFinalPassBlockedReason: ref.finalPassBlocked,
        });
      }
      ref.finalPassBlocked = fp;
    }
  }, [
    cameraReady,
    currentStepKey,
    effectivePassLatched,
    gate,
    permissionDenied,
    stats.sampledFrameCount,
  ]);
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
  const recentTailFramingHint = useMemo(() => getSetupFramingHint(landmarks), [landmarks]);
  const overheadReadinessFraming = useMemo(
    () =>
      resolveOverheadReadinessFramingHint({
        landmarks,
        windowStartMs: gate.guardrail.debug?.selectedWindowStartMs,
        windowEndMs: gate.guardrail.debug?.selectedWindowEndMs,
      }),
    [
      landmarks,
      gate.guardrail.debug?.selectedWindowStartMs,
      gate.guardrail.debug?.selectedWindowEndMs,
    ]
  );
  const liveReadinessSummary = useMemo(
    () =>
      getLiveReadinessSummary({
        success: effectivePassLatched,
        guardrail: gate.guardrail,
        framingHint: overheadReadinessFraming.framingHint,
      }),
    [effectivePassLatched, gate.guardrail, overheadReadinessFraming.framingHint]
  );
  const liveReadinessSummaryEvalWindow = useMemo(
    () =>
      getLiveReadinessSummary({
        success: effectivePassLatched,
        guardrail: gate.guardrail,
        framingHint: overheadReadinessFraming.evaluationWindowApplied
          ? overheadReadinessFraming.evaluationWindowFramingHintOnly
          : null,
      }),
    [
      effectivePassLatched,
      gate.guardrail,
      overheadReadinessFraming.evaluationWindowApplied,
      overheadReadinessFraming.evaluationWindowFramingHintOnly,
    ]
  );
  const liveReadinessSummaryRecentTail = useMemo(
    () =>
      getLiveReadinessSummary({
        success: effectivePassLatched,
        guardrail: gate.guardrail,
        framingHint: recentTailFramingHint,
      }),
    [effectivePassLatched, gate.guardrail, recentTailFramingHint]
  );
  const rawLiveReadiness = liveReadinessSummary.state;
  const primaryReadinessBlocker = getPrimaryReadinessBlocker(liveReadinessSummary);
  const evaluationWindowPrimaryBlocker = getPrimaryReadinessBlocker(liveReadinessSummaryEvalWindow);
  const recentTailPrimaryBlocker = getPrimaryReadinessBlocker(liveReadinessSummaryRecentTail);
  const { stableState: liveReadiness, smoothingApplied: readinessSmoothingApplied } =
    useStabilizedLiveReadiness(rawLiveReadiness);
  const readinessTraceSummary = useMemo(() => {
    const hm = gate.evaluatorResult?.debug?.highlightedMetrics as Record<string, unknown> | undefined;
    const meaningfulRiseSatisfied =
      hm?.meaningfulRiseSatisfied === 1 || hm?.meaningfulRiseSatisfied === true;
    const topDetected = Number(hm?.topDetected ?? 0) >= 1;
    const stableTopEntered =
      Number(hm?.stableTopEntry ?? 0) >= 1 || typeof hm?.stableTopEnteredAtMs === 'number';
    const holdStarted = Number(hm?.holdStarted ?? 0) >= 1;
    const holdDur = typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0;
    const holdSatisfied = Number(hm?.holdSatisfied ?? 0) >= 1 || holdDur >= 1200;
    const completionMachinePhase =
      typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : null;

    const motionSignalsAtLastBlocker = hm
      ? {
          meaningfulRiseSatisfied,
          topDetected,
          stableTopEntered,
          holdStarted,
          holdSatisfied,
          completionMachinePhase,
        }
      : null;

    if (primaryReadinessBlocker != null) {
      const now = Date.now();
      if (overheadBlockerTimeRef.current.firstSeenAtMs == null) {
        overheadBlockerTimeRef.current.firstSeenAtMs = now;
      }
      overheadBlockerTimeRef.current.lastSeenAtMs = now;
      if (motionSignalsAtLastBlocker) {
        overheadBlockerMotionLatchRef.current.lastSignals = motionSignalsAtLastBlocker;
      }
      if (meaningfulRiseSatisfied) {
        overheadBlockerMotionLatchRef.current.seenDuringActiveMotion = true;
      }
      if (holdSatisfied || gate.completionSatisfied) {
        overheadBlockerMotionLatchRef.current.seenAfterMotionWindow = true;
      }
    }

    const winStart = gate.guardrail.debug?.selectedWindowStartMs;
    const winEnd = gate.guardrail.debug?.selectedWindowEndMs;
    const evaluationWindowFramingHintForTrace = overheadReadinessFraming.evaluationWindowApplied
      ? overheadReadinessFraming.evaluationWindowFramingHintOnly
      : null;

    const displayedPrimaryBlockerSource = deriveDisplayedPrimaryBlockerSource({
      success: effectivePassLatched,
      rawReadinessState: rawLiveReadiness,
      activeBlockers: liveReadinessSummary.activeBlockers,
      severeFramingInvalid: liveReadinessSummary.blockers.severeFramingInvalid,
      framingHintSource: overheadReadinessFraming.source,
    });

    const blockerSeenNearTerminal =
      (gate.status === 'retry' || gate.status === 'fail') &&
      overheadBlockerTimeRef.current.lastSeenAtMs != null;

    const overheadReadinessBlockerTrace = buildOverheadReadinessBlockerTracePayload({
      displayedPrimaryBlocker: primaryReadinessBlocker,
      displayedPrimaryBlockerSource,
      evaluationWindowFramingHint: evaluationWindowFramingHintForTrace,
      evaluationWindowPrimaryBlocker,
      recentTailFramingHint,
      recentTailPrimaryBlocker,
      blockerFirstSeenAtMs: overheadBlockerTimeRef.current.firstSeenAtMs,
      blockerLastSeenAtMs: overheadBlockerTimeRef.current.lastSeenAtMs,
      motionLatch: { ...overheadBlockerMotionLatchRef.current },
      blockerSeenNearTerminal,
      motionSignalsAtLastBlocker: overheadBlockerMotionLatchRef.current.lastSignals,
      selectedWindowStartMs: typeof winStart === 'number' && Number.isFinite(winStart) ? winStart : null,
      selectedWindowEndMs: typeof winEnd === 'number' && Number.isFinite(winEnd) ? winEnd : null,
      traceWallClockMs: Date.now(),
    });

    return {
      state: liveReadiness,
      rawState: rawLiveReadiness,
      blocker: primaryReadinessBlocker,
      framingHint: liveReadinessSummary.framingHint,
      framingHintSource: overheadReadinessFraming.source,
      recentTailFramingHint,
      smoothingApplied: readinessSmoothingApplied,
      validFrameCount: liveReadinessSummary.inputs.validFrameCount,
      visibleJointsRatio: liveReadinessSummary.inputs.visibleJointsRatio,
      criticalJointsAvailability: liveReadinessSummary.inputs.criticalJointsAvailability,
      overheadReadinessBlockerTrace,
    };
  }, [
    effectivePassLatched,
    evaluationWindowPrimaryBlocker,
    gate.completionSatisfied,
    gate.evaluatorResult?.debug?.highlightedMetrics,
    gate.guardrail.debug?.selectedWindowEndMs,
    gate.guardrail.debug?.selectedWindowStartMs,
    gate.status,
    liveReadiness,
    liveReadinessSummary,
    overheadReadinessFraming.evaluationWindowApplied,
    overheadReadinessFraming.evaluationWindowFramingHintOnly,
    overheadReadinessFraming.source,
    primaryReadinessBlocker,
    rawLiveReadiness,
    recentTailFramingHint,
    recentTailPrimaryBlocker,
    readinessSmoothingApplied,
  ]);
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

  /**
   * OBS: 터미널 retry/fail·수동 재시도·성공 외 이탈 경로에서도 실캡처 시도 1회 기록.
   * terminalAttemptSnapshotRecordedStepKeyRef와 동일 래치로 중복 방지.
   */
  const persistAttemptSnapshotIfRealAttemptOnce = useCallback(
    (autoNextObservation: string) => {
      if (stats.sampledFrameCount <= 0) return;
      if (terminalAttemptSnapshotRecordedStepKeyRef.current === currentStepKey) return;
      terminalAttemptSnapshotRecordedStepKeyRef.current = currentStepKey;
      recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
        liveCueingEnabled: startSequenceComplete,
        autoNextObservation,
        poseCaptureStats: stats,
        ...(buildOverheadVisualTruthSnapshotRecordAttemptOptions(
          gate.guardrail.debug?.visualTruthCandidates,
          acceptedSnapshotDataUrlsRef.current
        ) ?? {}),
      });
      emitOverheadCaptureTerminalOnce(gate, autoNextObservation);
    },
    [
      currentStepKey,
      emitOverheadCaptureTerminalOnce,
      gate,
      readinessTraceSummary,
      startSequenceComplete,
      stats,
    ]
  );

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
    holdCuePlayedRef.current = false;
    setHoldCueActive(false);
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
    acceptedSnapshotDataUrlsRef.current = [];
  }, [clearAutoAdvanceTimer, currentStepKey]);

  const persistCurrentStep = useCallback(() => {
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
      liveCueingEnabled: startSequenceComplete,
      autoNextObservation: nextTriggerReason ?? 'pass_latched',
      holdCuePlayed: holdCuePlayedRef.current,
      successTriggeredAtMs: Date.now(),
      poseCaptureStats: stats,
      ...(buildOverheadVisualTruthSnapshotRecordAttemptOptions(
        gate.guardrail.debug?.visualTruthCandidates,
        acceptedSnapshotDataUrlsRef.current
      ) ?? {}),
    });
    /* latchPassEvent에서 setNextTriggerReason 직후 호출되므로 state는 한 틱 늦을 수 있음 — 성공 터미널 관측은 고정 라벨 */
    emitOverheadCaptureTerminalOnce(gate, 'pass_latched');
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
  }, [emitOverheadCaptureTerminalOnce, gate, nextTriggerReason, readinessTraceSummary, startSequenceComplete, stats]);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      previewVideoRef.current = video;
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        acceptedSnapshotDataUrlsRef.current = [];
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
      const idRef = { current: null as number | null };
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
        evaluatorResult: gate.evaluatorResult,
      },
      passLatched: effectivePassLatched,
      liveCueingEnabled: startSequenceComplete,
      holdCuePlayedRef,
      onHoldCueStateChange: setHoldCueActive,
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

  /* PR-COMP-04: 애매 재시도 음성 1회 — startSequenceComplete ≈ squat capturing */
  useEffect(() => {
    if (!startSequenceComplete || effectivePassLatched || permissionDenied) {
      return;
    }
    if (!captureCuingEnabled) return;
    if (liveReadiness !== 'ready') return;
    if (readyToShootAttemptedRef.current && !hasReadyToShootPlayedThisSession()) return;

    if (!deriveOverheadAmbiguousRetryReason(gate)) return;
    if (ambiguousRetryPlayedForStepRef.current === currentStepKey) return;

    const stepKeyAtSchedule = currentStepKey;
    const t = window.setTimeout(() => {
      if (ambiguousRetryPlayedForStepRef.current === stepKeyAtSchedule) return;
      const g = gateRef.current;
      if (!g || isFinalPassLatched(STEP_ID, g)) return;
      const reason = deriveOverheadAmbiguousRetryReason(g);
      if (!reason) return;
      ambiguousRetryPlayedForStepRef.current = stepKeyAtSchedule;
      void speakVoiceCue(getOverheadAmbiguousRetryVoiceCue(reason));
    }, 120);

    return () => window.clearTimeout(t);
  }, [
    captureCuingEnabled,
    currentStepKey,
    effectivePassLatched,
    gate,
    liveReadiness,
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

  const latchPassEvent = useCallback(
    (successOpenedBy: SuccessOpenedBy = 'effectivePassLatched', competingPaths: string[] = []) => {
      if (passLatchedStepKeyRef.current === currentStepKey || passLatched) {
        return;
      }

      const latchedAt = new Date().toISOString();
      const passLatchedAtMs = Date.now();
      passLatchedStepKeyRef.current = currentStepKey;
      settledRef.current = true;
      advanceLockRef.current = true;
      setPassLatched(true);
      setPassLatchedAt(latchedAt);
      setTransitionLocked(true);
      setNextTriggerReason('pass_latched');
      stop();
      /** PR success-diagnostic: success snapshot 저장 */
      recordOverheadSuccessSnapshot({
        gate,
        successOpenedBy,
        currentRoute: '/movement-test/camera/overhead-reach',
        passLatchedAtMs,
        pagePassReady: passReady,
        effectivePassLatched,
        competingPaths,
      });
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
    },
    [
      armElevation,
      armRange,
      compensation,
      currentStepKey,
      effectivePassLatched,
      gate,
      nextPath,
      passLatched,
      passReady,
      peakCount,
      persistCurrentStep,
      raiseCount,
      stop,
      symmetry,
    ]
  );

  /* PR G5: passConfirmed -> passLatched 공통 계약. effectivePassLatched(finalPassLatched || passLatched)로 latch. */
  /* PR-C4: hold cue 재생 중에는 success overlap 방지를 위해 latch 지연 */
  /* PR-CAM-11A: finalPassLatched(게이트 통과)이면 holdCueActive 대기 우회 — 데드락 방지 */
  useEffect(() => {
    if (permissionDenied || !cameraReady || passLatched || settledRef.current) {
      return;
    }

    if (effectivePassLatched) {
      if (holdCueActive && !finalPassLatched) return;
      latchPassEvent('effectivePassLatched', passReady ? ['passReady'] : []);
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
      latchPassEvent('passReady', effectivePassLatched ? ['effectivePassLatched'] : []);
      return;
    }

    if (gate.status !== 'retry' && gate.status !== 'fail') {
      overheadAccumulationGraceStartedAtRef.current = null;
      overheadTerminalDeferralOccurredRef.current = false;
    }

    if (gate.status === 'retry' || gate.status === 'fail') {
      const guardrailValidCount = gate.guardrail.debug?.validFrameCount ?? 0;
      const graceEligible = isOverheadAccumulationGraceEligible(
        stats.validFrameCount,
        guardrailValidCount
      );

      let deferTerminal = false;
      if (graceEligible) {
        const now = performance.now();
        const r = computeOverheadRetryFailDeferral({
          graceStartedAtMs: overheadAccumulationGraceStartedAtRef.current,
          nowMs: now,
          readinessValidFrameCount: readinessTraceSummary.validFrameCount,
        });
        overheadAccumulationGraceStartedAtRef.current = r.graceStartedAtMs;
        deferTerminal = r.deferTerminal;
        if (deferTerminal) {
          overheadTerminalDeferralOccurredRef.current = true;
        }
      } else {
        overheadAccumulationGraceStartedAtRef.current = null;
      }

      if (deferTerminal) {
        return;
      }

      const graceStartMs = overheadAccumulationGraceStartedAtRef.current;
      const accumulationGraceElapsedMs =
        graceStartMs != null ? performance.now() - graceStartMs : undefined;
      overheadAccumulationGraceStartedAtRef.current = null;

      let overheadAttemptFailureType: OverheadAttemptFailureType;
      if (stats.validFrameCount === 0) {
        overheadAttemptFailureType = 'adaptor_no_input';
      } else if (graceEligible) {
        overheadAttemptFailureType = 'early_cutoff_valid_support';
      } else {
        overheadAttemptFailureType = 'insufficient_signal_other';
      }

      const readinessVF = readinessTraceSummary.validFrameCount;
      const accumulationGraceApplied = overheadTerminalDeferralOccurredRef.current;
      overheadTerminalDeferralOccurredRef.current = false;

      const overheadInputStability = {
        overheadAttemptFailureType,
        accumulationGraceApplied,
        terminalReasonCategory: graceEligible
          ? 'dual_support_retry_fail'
          : 'no_dual_support_retry_fail',
        terminalDecisionPhase: 'page_retry_fail_terminal',
        accumulationGraceElapsedMs,
        terminalBeforeAccumulationComplete: readinessVF < OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE,
        adaptorFailureObserved: (stats.landmarkOrAdaptorFailedFrameCount ?? 0) > 0,
        firstHookAcceptedAtMs: stats.firstHookAcceptedAtMs ?? null,
        readinessMinValidFramesTarget: OH_READINESS_MIN_VALID_FRAMES_FOR_GRACE,
      };

      const terminalKindSuffix = accumulationGraceApplied ? ':after_grace_window' : '';
      if (terminalAttemptSnapshotRecordedStepKeyRef.current !== currentStepKey) {
        terminalAttemptSnapshotRecordedStepKeyRef.current = currentStepKey;
        recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
          liveCueingEnabled: startSequenceComplete,
          autoNextObservation: 'terminal_retry_or_fail',
          poseCaptureStats: stats,
          overheadInputStability,
          ...(buildOverheadVisualTruthSnapshotRecordAttemptOptions(
            gate.guardrail.debug?.visualTruthCandidates,
            acceptedSnapshotDataUrlsRef.current
          ) ?? {}),
        });
        emitOverheadCaptureTerminalOnce(
          gate,
          `terminal_retry_or_fail:${gate.status}:${gate.progressionState}${terminalKindSuffix}`
        );
      }
      settledRef.current = true;
      stop();
      setProgressionState((prev) => (prev === gate.progressionState ? prev : gate.progressionState));
      setStatusMessage((prev) => (prev === gate.uiMessage ? prev : gate.uiMessage));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordAttemptSnapshot은 gate.status 전환 시점의 gate 스냅샷 사용; gate 객체는 매 프레임 새 참조라 deps에 넣지 않음
  }, [
    cameraReady,
    currentStepKey,
    effectivePassLatched,
    emitOverheadCaptureTerminalOnce,
    gate.progressionState,
    gate.status,
    gate.uiMessage,
    holdCueActive,
    latchPassEvent,
    passReady,
    passLatched,
    permissionDenied,
    readinessTraceSummary,
    startSequenceComplete,
    stats,
    stop,
  ]);

  useEffect(() => {
    if (!effectivePassLatched) {
      return;
    }

    /* PR-C4: hold cue 재생 중 success overlap 방지 — latch 지연 */
    /* PR-CAM-11A: finalPassLatched이면 holdCue 대기 우회 (데드락 방지) */
    if (holdCueActive && !finalPassLatched) return;

    if (passLatchedStepKeyRef.current !== currentStepKey) {
      latchPassEvent('effectivePassLatched', []);
      return;
    }

    if (triggeredAdvanceStepKeyRef.current === currentStepKey || navigationTriggered) {
      return;
    }

    /* final step: outro owner가 이미 처리 중이면 다른 경로 진입 차단 */
    if (isFinalStep && finalStepOutroInProgressRef.current) {
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

    /* diagnostic freeze: overlay 표시, auto-advance 금지 */
    if (isDiagnosticFreezeMode()) {
      setShowSuccessFreezeOverlay(true);
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
      /* 마지막 단계: final outro가 navigation을 독점. 재진입 차단 */
      finalStepOutroInProgressRef.current = true;
      void (async () => {
        try {
          const timeout = new Promise<boolean>((r) =>
            setTimeout(() => r(false), FINAL_OUTRO_FALLBACK_MS)
          );
          await Promise.race([
            speakVoiceCueAndWait(getFinalSuccessVoiceCue()),
            timeout,
          ]);
        } finally {
          doNavigate();
        }
      })();
    } else {
      autoAdvanceTimerRef.current = window.setTimeout(doNavigate, gate.autoAdvanceDelayMs);
    }
  }, [
    clearAutoAdvanceTimer,
    currentStepKey,
    effectivePassLatched,
    gate.autoAdvanceDelayMs,
    holdCueActive,
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
    if (terminalAttemptSnapshotRecordedStepKeyRef.current !== currentStepKey) {
      terminalAttemptSnapshotRecordedStepKeyRef.current = currentStepKey;
      recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
        liveCueingEnabled: startSequenceComplete,
        autoNextObservation: 'retry',
        poseCaptureStats: stats,
        ...(buildOverheadVisualTruthSnapshotRecordAttemptOptions(
          gate.guardrail.debug?.visualTruthCandidates,
          acceptedSnapshotDataUrlsRef.current
        ) ?? {}),
      });
      emitOverheadCaptureTerminalOnce(gate, 'retry');
    }
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
    holdCuePlayedRef.current = false;
    setHoldCueActive(false);
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
    setShowSuccessFreezeOverlay(false);
    setPreviewKey((prev) => prev + 1);
  }, [
    clearAutoAdvanceTimer,
    currentStepKey,
    emitOverheadCaptureTerminalOnce,
    gate,
    readinessTraceSummary,
    startSequenceComplete,
    stats,
    stop,
  ]);

  const handleCameraError = useCallback(() => {
    persistAttemptSnapshotIfRealAttemptOnce('exit_camera_error');
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
    setShowSuccessFreezeOverlay(false);
  }, [clearAutoAdvanceTimer, persistAttemptSnapshotIfRealAttemptOnce]);

  const handleSurveyFallback = useCallback(() => {
    trackEvent('camera_refine_failed_or_fallback', {
      route_group: 'camera_refine',
      reason: 'manual_survey_fallback',
      completed_steps: 1,
    });
    persistAttemptSnapshotIfRealAttemptOnce('exit_survey_fallback');
    clearAutoAdvanceTimer();
    cancelVoiceGuidance();
    stop();
    router.push('/movement-test/survey');
  }, [clearAutoAdvanceTimer, persistAttemptSnapshotIfRealAttemptOnce, router, stop]);

  const handleDevOverride = useCallback(() => {
    if (!IS_DEV) return;
    latchPassEvent('effectivePassLatched', []);
  }, [latchPassEvent]);

  const handleSuccessFreezeContinue = useCallback(() => {
    setShowSuccessFreezeOverlay(false);
    const path = getNextStepPath(STEP_ID);
    if (path) router.push(path);
  }, [router]);

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
  /** PR-OH-CAPTURE-PROTOCOL-CONTRACT-05B: CameraPreview 하단 가이드 — 계산된 설정 문구가 실제 프리뷰로 전달됨 */
  const overheadPreviewInstructions = useMemo(() => {
    const merged: string[] = [];
    if (showPreCaptureHint) {
      if (preCaptureGuidance.primary) merged.push(preCaptureGuidance.primary);
      if (preCaptureGuidance.secondary) merged.push(preCaptureGuidance.secondary);
    }
    for (const line of setupGuide.instructions) {
      if (merged.length >= 4) break;
      merged.push(line);
    }
    return merged.length > 0 ? merged.slice(0, 4) : setupGuide.instructions.slice(0, 4);
  }, [
    showPreCaptureHint,
    preCaptureGuidance.primary,
    preCaptureGuidance.secondary,
    setupGuide.instructions,
  ]);
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
    <div className="relative min-h-[100svh] overflow-hidden flex flex-col mr-public-funnel-shell">
      {showSuccessFreezeOverlay && (
        <SuccessFreezeOverlay
          motionType="overhead_reach"
          onContinue={handleSuccessFreezeContinue}
        />
      )}
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
                showPoseDebugOverlay={IS_DEV}
                poseDiagnosticsMotionType="overhead-reach"
                guideTone={guideTone}
                guideHint={isMinimalCapture ? null : overlayGuide.hint}
                guideFocus={isMinimalCapture ? null : overlayGuide.focus}
                guideAnimated={isMinimalCapture ? false : overlayGuide.animated}
                guideVariant="overhead-reach"
                guideBadges={setupGuide.badges}
                guideReadinessLabel={setupGuide.readinessLabel}
                minimalCaptureMode={isMinimalCapture}
                showProtocolGuideInMinimal={isMinimalCapture}
                className="w-full"
              />
            </div>
            {!permissionDenied && overheadPreviewInstructions.length > 0 && (
              <ExternalCameraGuidePanel
                variant="overhead-reach"
                lines={overheadPreviewInstructions}
                className="w-full max-w-md mt-2 shrink-0"
              />
            )}
            {!isMinimalCapture && (
            <div className="w-full max-w-md mt-4 space-y-3">
              {visibleUserGuidance.length > 0 && (
                <div
                  className="space-y-1 text-xs text-slate-400 break-keep px-1"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {visibleUserGuidance.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}
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
                    <span>
                      holdSatisfied:{' '}
                      {String(gate.evaluatorResult.debug?.highlightedMetrics?.holdSatisfied === 1)}
                    </span>
                    <span>
                      completionPhase:{' '}
                      {String(
                        gate.evaluatorResult.debug?.highlightedMetrics?.completionMachinePhase ??
                          'n/a'
                      )}
                    </span>
                    <span>
                      completionBlocked:{' '}
                      {String(
                        gate.evaluatorResult.debug?.highlightedMetrics?.completionBlockedReason ??
                          'none'
                      )}
                    </span>
                    <span>
                      ambiguousRetryReason: {deriveOverheadAmbiguousRetryReason(gate) ?? '—'}
                    </span>
                    {gate.evaluatorResult.debug?.overheadInternalQuality && (
                      <>
                        <span>
                          internalQ tier:{' '}
                          {gate.evaluatorResult.debug.overheadInternalQuality.qualityTier}
                        </span>
                        <span className="col-span-2">
                          internalQ mob/ctl/sym/hold/conf:{' '}
                          {[
                            gate.evaluatorResult.debug.overheadInternalQuality.mobilityScore,
                            gate.evaluatorResult.debug.overheadInternalQuality.controlScore,
                            gate.evaluatorResult.debug.overheadInternalQuality.symmetryScore,
                            gate.evaluatorResult.debug.overheadInternalQuality.holdStabilityScore,
                            gate.evaluatorResult.debug.overheadInternalQuality.confidence,
                          ]
                            .map((n) => n.toFixed(2))
                            .join(' / ')}
                        </span>
                        <span className="col-span-2">
                          internalQ lim:{' '}
                          {gate.evaluatorResult.debug.overheadInternalQuality.limitations.join(', ') ||
                            'none'}
                        </span>
                      </>
                    )}
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
