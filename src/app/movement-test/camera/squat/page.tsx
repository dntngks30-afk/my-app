'use client';

/**
 * 카메라 테스트 - 스쿼트
 * AI gate가 pass / retry / fail을 판단하고 자동 진행한다.
 */
import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import {
  StitchCameraGlassPanel,
  StitchCameraPrimaryButton,
  StitchCameraSquatHeader,
  StitchCameraSquatHeaderCenter,
  StitchCameraSquatRoot,
} from '@/components/stitch/camera/CameraSquat';
import { CameraPreview } from '@/components/public/CameraPreview';
import { ExternalCameraGuidePanel } from '@/components/public/ExternalCameraGuidePanel';
import {
  saveCameraTest,
  loadCameraTest,
  getNextStepPath,
  getPrevStepPath,
  type CameraStepId,
  type CameraPhase,
} from '@/lib/public/camera-test';
import { usePoseCapture, type PoseCaptureStats } from '@/lib/camera/use-pose-capture';
import { getSetupFramingHint } from '@/lib/camera/setup-framing';
import {
  evaluateExerciseAutoProgress,
  isFinalPassLatched,
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
import {
  deriveSquatObservabilitySignals,
  recordAttemptSnapshot,
  recordSquatObservationEvent,
  relativeDepthPeakBucket,
  squatDownwardCommitmentReachedObservable,
} from '@/lib/camera/camera-trace';
import { noteSquatGateForCameraObservability } from '@/lib/camera/camera-observability-squat-session';
import {
  recordCaptureSessionTerminalBundle,
  squatTerminalKindFromGate,
  getRecentCaptureSessionBundles,
  getLatestCaptureSessionBundle,
  copyLatestCaptureSessionBundleJson,
  clearCaptureSessionBundles,
} from '@/lib/camera/camera-trace-bundle';
import {
  recordSquatSuccessSnapshot,
  recordSquatFailedShallowSnapshot,
  hasShallowSquatObservation,
  hasSquatAttemptEvidence,
  isDiagnosticFreezeMode,
} from '@/lib/camera/camera-success-diagnostic';
import { SquatMobileDiagPanel } from '@/components/camera/SquatMobileDiagPanel';
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
  getSquatAmbiguousRetryVoiceCue,
  getStartVoiceCue,
  getSuccessVoiceCue,
  hasReadyToShootPlayedThisSession,
  markReadyToShootPlayed,
  resetVoiceGuidanceSession,
  setFunnelIntroPlayed,
  speakVoiceCue,
  speakVoiceCueAndWait,
  trySpeakCorrectiveCueWithAntiSpam,
  unlockVoiceGuidance,
} from '@/lib/camera/voice-guidance';
import {
  deriveSquatAmbiguousRetryReason,
  SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS,
} from '@/lib/camera/squat-ambiguous-retry';
import { TraceDebugPanel } from '@/components/camera/TraceDebugPanel';
import { SuccessFreezeOverlay } from '@/components/camera/SuccessFreezeOverlay';
import { FailureFreezeOverlay } from '@/components/camera/FailureFreezeOverlay';
import { SquatPostPassDebugModal } from '@/components/public/camera/SquatPostPassDebugModal';

const STEP_ID: CameraStepId = 'squat';
const IS_DEV = process.env.NODE_ENV !== 'production';

/** PR-CAM-30A: capturing 전 gate 입력 — usePoseCapture EMPTY_STATS 와 동일 형태 */
const SQUAT_PAGE_IDLE_CAPTURE_STATS: PoseCaptureStats = {
  sampledFrameCount: 0,
  droppedFrameCount: 0,
  filteredLowQualityFrameCount: 0,
  unstableFrameCount: 0,
  captureDurationMs: 0,
  validFrameCount: 0,
  averageLandmarkCount: 0,
  averageVisibleLandmarkRatio: 0,
  timestampDiscontinuityCount: 0,
};

/**
 * PR-CAM-30A: setup/arming/countdown 에서는 스쿼트 gate·pass latch·pose 누적을 소비하지 않는다.
 * 스모크·외부 도구가 page 정책과 동일한 판정을 쓰도록 export.
 */
function squatPageExerciseEvaluationActive(phase: CameraPhase): boolean {
  return phase === 'capturing';
}

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
/** diagnostic: capturing 4.5초 동안 pass 못 하면 failure freeze overlay */
const SQUAT_FAILURE_FREEZE_DELAY_MS = 4500;
/** CAM-27: 얕은 후보 후 attempt 마일스톤 없을 때 관측용 stall(스팸 방지 단발) */
const SQUAT_OBS_STALL_AFTER_MS = 3800;

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
  const [showSuccessFreezeOverlay, setShowSuccessFreezeOverlay] = useState(false);
  const [showFailureFreezeOverlay, setShowFailureFreezeOverlay] = useState(false);
  /** PR-DBG-01: dev-only 통과 후 debug modal */
  const [showSquatDebugModal, setShowSquatDebugModal] = useState(false);
  const [debugModalGate, setDebugModalGate] = useState<ExerciseGateResult | null>(null);
  /** 모달이 열려 있는 동안 navigation을 hold — setTimeout callback 내부에서 읽어야 하므로 ref */
  const debugModalHoldRef = useRef(false);
  const [passDetectedAt, setPassDetectedAt] = useState<string | null>(null);
  const [nextScheduledAt, setNextScheduledAt] = useState<string | null>(null);
  const [nextTriggeredAt, setNextTriggeredAt] = useState<string | null>(null);
  const [nextTriggerReason, setNextTriggerReason] = useState<string | null>(null);
  const [transitionHistory, setTransitionHistory] = useState<DebugTransitionEntry[]>([]);
  const { landmarks, stats, start, stop, pushFrame } = usePoseCapture();
  /** PR-CAM-30A: pushFrame 콜백이 stale closure 를 피하도록 항상 최신 phase */
  const cameraPhaseRef = useRef(cameraPhase);
  cameraPhaseRef.current = cameraPhase;
  /** PR-CAM-30A: unmount 시 terminal bundle — 실제 capturing 에 진입한 세션만 */
  const squatCaptureSessionEnteredRef = useRef(false);
  const settledRef = useRef(false);
  const advanceLockRef = useRef(false);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const armingTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const startCueAttemptedRef = useRef(false);
  const startSequenceRunIdRef = useRef(0);
  /* capturing 중 ready_to_shoot 완료 후 교정 음성 허용 여부.
   * ref가 아닌 state: true로 바뀔 때 corrective cue effect가 re-run되어야 하기 때문. */
  const [captureCuingEnabled, setCaptureCuingEnabled] = useState(false);
  /** PR HOTFIX-02: capturing 구간에서 직전 readiness 추적 (red→white 전환 감지용) */
  const prevCapturingReadinessRef = useRef<LiveReadinessState | null>(null);
  /** PR HOTFIX-02: ready_to_shoot 시도 여부 — async IIFE 재진입 방지 */
  const readyToShootAttemptedRef = useRef(false);
  /** PR HOTFIX-02: white 전환 one-shot 관측 state (dev only) */
  const [whiteTransitionDebug, setWhiteTransitionDebug] = useState<{
    prevReadiness: string | null;
    enteredWhite: boolean;
    played: boolean | null;
    suppressionReason: string | null;
  } | null>(null);
  const successCueAttemptedRef = useRef(false);
  const lastProgressionStateRef = useRef<ExerciseProgressionState>('idle');
  const passLatchedStepKeyRef = useRef<string | null>(null);
  const scheduledAdvanceStepKeyRef = useRef<string | null>(null);
  const triggeredAdvanceStepKeyRef = useRef<string | null>(null);
  const failureFreezeTimerRef = useRef<number | null>(null);
  const gateRef = useRef<ExerciseGateResult | null>(null);
  /** CAM-OBS: failure freeze 타이머가 최신 previewKey·finalPassLatched를 읽기 위한 ref */
  const previewKeyRef = useRef(previewKey);
  const finalPassLatchedRef = useRef(false);
  /** CAM-OBS: 동일 캡처 세션(previewKey)당 실패 스냅샷 1회만 저장 — 일반 retry/fail 과 freeze 중복 방지 */
  const failedSnapshotRecordedForPreviewKeyRef = useRef<number | null>(null);
  const statsRef = useRef(stats);
  /** PR-COMP-02: 애매 재시도 음성 후 diagnostic failure-freeze 4.5s 타이머 재시작 */
  const [failureFreezeRetryEpoch, setFailureFreezeRetryEpoch] = useState(0);
  const debugEnabled = IS_DEV;
  const currentStepKey = `${STEP_ID}:${previewKey}`;
  const latestStepKeyForBundleRef = useRef(currentStepKey);
  latestStepKeyForBundleRef.current = currentStepKey;
  const ambiguousRetryPlayedForStepRef = useRef<string | null>(null);
  const prevStepKeyForAmbiguousRef = useRef(currentStepKey);
  /** CAM-27: capturing 중 스쿼트 사전 관측 엣지(프레임당 기록 금지) */
  const squatObsEdgeRef = useRef({
    preAttemptRecorded: false,
    attemptStarted: false,
    downwardCommitment: false,
    descendConfirmed: false,
    reversal: false,
    recovery: false,
    evidenceLabel: null as string | null,
    completionBlocked: null as string | null,
    standardBlocked: null as string | null,
    depthBucket: null as string | null,
    stallTimer: null as number | null,
    stallRecorded: false,
  });
  /** CAM-27: 이번 capturing 세션에서 얕은 관측 신호가 있었는지(abandon 스팸 방지) */
  const squatObsHadShallowThisCaptureRef = useRef(false);
  /** 캡처 terminal 구간에서 attempt snapshot 1회 */
  const squatTerminalAttemptSnapshotRef = useRef<string | null>(null);
  /** capture_session_terminal 관측 이벤트 1회(shallow가 늦게 true여도 1회 기록) */
  const squatTerminalObservationRef = useRef<string | null>(null);
  /** PR-CAM-SNAPSHOT-BUNDLE-01: 동일 캡처 스텝당 터미널 번들 1회 */
  const squatSessionBundleRecordedForStepKeyRef = useRef<string | null>(null);
  /** hasShallowSquatObservation 최초 충족 엣지 — shallow_observed 이벤트 1회 */
  const squatShallowObservedEdgeRef = useRef(false);
  /** PR-CAM-10: 애매 재시도 음성 1회 + 이후 completion 관측(디버그) */
  const [squatAmbiguousRetryHud, setSquatAmbiguousRetryHud] = useState<{
    voicePlayed: boolean;
    reason: string | null;
    secondChanceCompletionSatisfied: boolean;
  }>({ voicePlayed: false, reason: null, secondChanceCompletionSatisfied: false });
  const nextPath = getNextStepPath(STEP_ID);

  useLayoutEffect(() => {
    if (prevStepKeyForAmbiguousRef.current !== currentStepKey) {
      ambiguousRetryPlayedForStepRef.current = null;
      prevStepKeyForAmbiguousRef.current = currentStepKey;
    }
  }, [currentStepKey]);

  const gate = useMemo(() => {
    const active = squatPageExerciseEvaluationActive(cameraPhase);
    return evaluateExerciseAutoProgress(
      STEP_ID,
      active ? landmarks : [],
      active ? stats : SQUAT_PAGE_IDLE_CAPTURE_STATS
    );
  }, [landmarks, stats, cameraPhase]);
  const finalPassLatched = isFinalPassLatched(STEP_ID, gate);
  previewKeyRef.current = previewKey;
  finalPassLatchedRef.current = finalPassLatched;
  statsRef.current = stats;
  const effectivePassLatched = finalPassLatched || passLatched;
  const setupFramingHint = useMemo(() => getSetupFramingHint(landmarks), [landmarks]);
  const liveReadinessSummary = useMemo(
    () =>
      getLiveReadinessSummary({
        success: cameraPhase === 'capturing' && effectivePassLatched,
        guardrail: gate.guardrail,
        framingHint: setupFramingHint,
      }),
    [cameraPhase, effectivePassLatched, gate.guardrail, setupFramingHint]
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
  const readinessTraceSummaryRef = useRef(readinessTraceSummary);
  readinessTraceSummaryRef.current = readinessTraceSummary;

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
    (ms: number, timerRef: { current: number | null }) =>
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
    prevCapturingReadinessRef.current = null;
    readyToShootAttemptedRef.current = false;
    setCaptureCuingEnabled(false);
    setWhiteTransitionDebug(null);
    setPassLatched(false);
    setPassLatchedAt(null);
    setNavigationTriggered(false);
    setTransitionLocked(false);
    setPassDetectedAt(null);
    setNextScheduledAt(null);
    setNextTriggeredAt(null);
    setNextTriggerReason(null);
    setTransitionHistory([]);
    setSquatAmbiguousRetryHud({
      voicePlayed: false,
      reason: null,
      secondChanceCompletionSatisfied: false,
    });
    /* PR-DBG-01: 스텝 리셋 시 debug modal 상태도 초기화 */
    setShowSquatDebugModal(false);
    setDebugModalGate(null);
    debugModalHoldRef.current = false;
    failedSnapshotRecordedForPreviewKeyRef.current = null;
    const o = squatObsEdgeRef.current;
    if (o.stallTimer) window.clearTimeout(o.stallTimer);
    squatObsEdgeRef.current = {
      preAttemptRecorded: false,
      attemptStarted: false,
      downwardCommitment: false,
      descendConfirmed: false,
      reversal: false,
      recovery: false,
      evidenceLabel: null,
      completionBlocked: null,
      standardBlocked: null,
      depthBucket: null,
      stallTimer: null,
      stallRecorded: false,
    };
    squatObsHadShallowThisCaptureRef.current = false;
    squatTerminalAttemptSnapshotRef.current = null;
    squatTerminalObservationRef.current = null;
    squatSessionBundleRecordedForStepKeyRef.current = null;
    squatShallowObservedEdgeRef.current = false;
    squatCaptureSessionEnteredRef.current = false;
  }, [clearAutoAdvanceTimer, currentStepKey]);

  useEffect(() => {
    if (cameraPhase === 'capturing') {
      squatCaptureSessionEnteredRef.current = true;
    }
  }, [cameraPhase]);

  const pushFrameDuringCapturingOnly = useCallback(
    (frame: Parameters<typeof pushFrame>[0]) => {
      if (cameraPhaseRef.current !== 'capturing') return;
      pushFrame(frame);
    },
    [pushFrame]
  );

  /** CAM-OBS: URL 진단 플래그 (?diag=1, ?debug=1, ?diag_modal=1, ?pose_overlay=1) */
  const [urlDebugFlags, setUrlDebugFlags] = useState({
    diag: false,
    debug: false,
    diagModal: false,
    poseOverlay: false,
  });
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      setUrlDebugFlags({
        diag: p.get('diag') === '1',
        debug: p.get('debug') === '1',
        diagModal: p.get('diag_modal') === '1',
        poseOverlay: p.get('pose_overlay') === '1',
      });
    } catch {
      setUrlDebugFlags({ diag: false, debug: false, diagModal: false, poseOverlay: false });
    }
  }, []);

  const [headerDiagTapCount, setHeaderDiagTapCount] = useState(0);
  const headerDiagTapResetRef = useRef<number | null>(null);
  const onHeaderAreaTapForDiag = useCallback(() => {
    if (headerDiagTapResetRef.current) window.clearTimeout(headerDiagTapResetRef.current);
    setHeaderDiagTapCount((c) => {
      const n = c + 1;
      headerDiagTapResetRef.current = window.setTimeout(() => setHeaderDiagTapCount(0), 2200);
      return n;
    });
  }, []);

  const mobileDiagUnlocked = urlDebugFlags.diag || urlDebugFlags.debug || headerDiagTapCount >= 5;

  const persistCurrentStep = useCallback(() => {
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
      liveCueingEnabled: cameraPhase === 'capturing',
      autoNextObservation: nextTriggerReason ?? 'pass_latched',
    });
    const current = loadCameraTest();
    const completed = current.completedSteps?.includes(STEP_ID)
      ? current.completedSteps
      : [...(current.completedSteps ?? []), STEP_ID];
    const sc = gate.squatCycleDebug;
    const evaluatorResultWithEvidence = sc
      ? {
          ...gate.evaluatorResult,
          debug: {
            ...(gate.evaluatorResult.debug ?? {}),
            squatEvidenceLevel: sc.squatEvidenceLevel,
            squatEvidenceReasons: sc.squatEvidenceReasons,
            cycleProofPassed: sc.cycleProofPassed,
            romBand: sc.romBand,
            confidenceDowngradeReason: sc.confidenceDowngradeReason,
            insufficientSignalReason: sc.insufficientSignalReason,
          },
        }
      : gate.evaluatorResult;
    const evaluatorResults = {
      ...(current.evaluatorResults ?? {}),
      [STEP_ID]: evaluatorResultWithEvidence,
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
  }, [cameraPhase, gate, nextTriggerReason, readinessTraceSummary]);

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement) => {
      videoRef.current = video;
      /* PR-CAM-30A: setup 단계에서 start(video) 금지 — pose 누적·gate 평가는 capturing 진입 시에만 */
      settledRef.current = false;
      setCameraReady(true);
      setProgressionState('camera_ready');
      setStatusMessage('동작을 시작해 주세요');
      appendTransition('camera_ready', 'video_ready');
      /* 음성 재생을 위해 가능한 시점에 unlock (카메라 권한 허용 시 사용자 제스처 있음) */
      unlockVoiceGuidance();
    },
    [appendTransition]
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
      /* PR G2: white 상태면 1000ms 확인 후 ready_to_shoot 재생 (setup 단계 전용).
       * 1회 재생 후 markReadyToShootPlayed()로 중복 차단.
       * capturing 진입 후 white 전환 시의 ready_to_shoot은 별도 useEffect가 담당한다. */
      if (isWhite) {
        await waitForTimer(1000, armingTimerRef);
        if (!isActive()) return;
        await speakVoiceCueAndWait(getReadyToShootVoiceCue());
        markReadyToShootPlayed();
        if (!isActive()) return;
      }
      /* captureCuingEnabled는 capturing 진입 후 useEffect가 관리하므로 여기서 설정하지 않는다. */

      setCountdownValue(0);
      await speakVoiceCueAndWait(getStartVoiceCue(STEP_ID));
      if (!isActive()) return;
      setFunnelIntroPlayed();

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

  /* PR HOTFIX-02: capturing 중 red → white 전환 감지 및 one-shot ready_to_shoot 재생
   *
   * - capturing 진입 시 prevCapturingReadinessRef 초기화
   * - red(not_ready): framing cue만 허용 (captureCuingEnabled=true)
   * - red → white(ready) 전환 감지(enteredWhite): 최초 1회만 ready_to_shoot 재생 후 movement cue 허용
   *   · hasReadyToShootPlayedThisSession() — setup 단계에서 이미 재생된 경우 스킵
   *   · readyToShootAttemptedRef — async IIFE 재진입 방지
   *   · !enteredWhite — white 상태 유지 중 재실행 시 재생 방지
   * - white → red 복귀: movement cue 차단, framing cue 허용
   * - success: effectivePassLatched로 corrective cue effect 자체가 막힘
   *
   * 루트 픽스: getReadyToShootVoiceCue()에 interrupt:true 추가 —
   *   playVoiceCue 내 decideVoicePlayback이 active framing cue(priority 5)에 의해
   *   ready_to_shoot(priority 3)을 lower_priority_active로 차단하던 문제 해소. */
  useEffect(() => {
    if (cameraPhase !== 'capturing') {
      /* capturing 이외 구간(setup/arming/countdown)에서는 추적 리셋 */
      prevCapturingReadinessRef.current = null;
      readyToShootAttemptedRef.current = false;
      return;
    }

    const prevReadiness = prevCapturingReadinessRef.current;
    const enteredWhite = prevReadiness !== 'ready' && liveReadiness === 'ready';
    prevCapturingReadinessRef.current = liveReadiness;

    if (liveReadiness === 'ready') {
      setCaptureCuingEnabled(false);

      /* 이미 처리된 케이스: 세션 재생 완료 / 이미 시도 중 / 전환 아님(white 유지 재실행) */
      const alreadyHandled =
        hasReadyToShootPlayedThisSession() ||
        readyToShootAttemptedRef.current ||
        !enteredWhite;

      if (alreadyHandled) {
        setCaptureCuingEnabled(true);
        return;
      }

      /* red → white 최초 전환: one-shot 발화 */
      readyToShootAttemptedRef.current = true;
      let cancelled = false;
      void (async () => {
        const played = await speakVoiceCueAndWait(getReadyToShootVoiceCue());
        markReadyToShootPlayed();
        if (IS_DEV) {
          const debugInfo = {
            prevReadiness,
            enteredWhite,
            played,
            suppressionReason: played ? null : 'playback_returned_false',
          };
          setWhiteTransitionDebug(debugInfo);
          console.info('[camera:squat-white-transition]', {
            ...debugInfo,
            readyToShootPlayedThisSession: true,
          });
        }
        if (!cancelled) setCaptureCuingEnabled(true);
      })();
      return () => { cancelled = true; };
    }

    if (liveReadiness === 'not_ready') {
      /* red phase: framing cue 허용을 위해 captureCuingEnabled=true */
      setCaptureCuingEnabled(true);
    }
  }, [cameraPhase, liveReadiness]);

  useEffect(() => {
    if (cameraPhase !== 'capturing' || effectivePassLatched || permissionDenied) {
      return;
    }
    /* ready_to_shoot 재생이 완료되기 전까지 교정 음성 차단 */
    if (!captureCuingEnabled) return;
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

  /* PR-COMP-02: completion phase·blockedReason 기반 애매 사이클 — 스텝당 음성 재시도 1회.
   * 짧은 지연으로 trySpeakCorrectiveCue와 같은 틱 경합을 줄인 뒤 gateRef로 최신 gate를 다시 본다. */
  useEffect(() => {
    if (cameraPhase !== 'capturing' || effectivePassLatched || permissionDenied) {
      return;
    }
    if (!captureCuingEnabled) return;
    if (liveReadiness !== 'ready') return;
    if (readyToShootAttemptedRef.current && !hasReadyToShootPlayedThisSession()) return;

    if (!deriveSquatAmbiguousRetryReason(gate, stats.captureDurationMs)) return;
    if (ambiguousRetryPlayedForStepRef.current === currentStepKey) return;

    const stepKeyAtSchedule = currentStepKey;
    const t = window.setTimeout(() => {
      if (ambiguousRetryPlayedForStepRef.current === stepKeyAtSchedule) return;
      const g = gateRef.current;
      if (!g || isFinalPassLatched(STEP_ID, g)) return;
      const reason = deriveSquatAmbiguousRetryReason(g, statsRef.current.captureDurationMs);
      if (!reason) return;
      ambiguousRetryPlayedForStepRef.current = stepKeyAtSchedule;
      setFailureFreezeRetryEpoch((n) => n + 1);
      setSquatAmbiguousRetryHud({
        voicePlayed: true,
        reason,
        secondChanceCompletionSatisfied: false,
      });
      void speakVoiceCue(getSquatAmbiguousRetryVoiceCue(reason));
    }, 120);

    return () => window.clearTimeout(t);
  }, [
    cameraPhase,
    captureCuingEnabled,
    currentStepKey,
    effectivePassLatched,
    gate,
    liveReadiness,
    permissionDenied,
    stats.captureDurationMs,
  ]);

  /* PR-CAM-10: 애매 재시도 음성 이후 completion 이 채워지면 second-chance 관측(스팸 없음, 1회) */
  useEffect(() => {
    if (cameraPhase !== 'capturing') return;
    if (!squatAmbiguousRetryHud.voicePlayed || squatAmbiguousRetryHud.secondChanceCompletionSatisfied) {
      return;
    }
    if (!gate.completionSatisfied) return;
    setSquatAmbiguousRetryHud((h) => ({ ...h, secondChanceCompletionSatisfied: true }));
    if (IS_DEV) {
      console.info('[camera:squat-second-chance]', {
        ambiguousRetryReason: squatAmbiguousRetryHud.reason,
        completionSatisfied: gate.completionSatisfied,
      });
    }
  }, [
    cameraPhase,
    gate.completionSatisfied,
    squatAmbiguousRetryHud.reason,
    squatAmbiguousRetryHud.secondChanceCompletionSatisfied,
    squatAmbiguousRetryHud.voicePlayed,
  ]);

  useEffect(() => {
    if (cameraPhase !== 'capturing') return;
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
  }, [cameraPhase, currentStepKey, effectivePassLatched]);

  const latchPassEvent = useCallback(() => {
    /* PR-CAM-30A: 이중 방어 — countdown/setup 에서 절대 latch·snapshot·terminal 기록 안 함 */
    if (cameraPhase !== 'capturing') return;
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
    setPassDetectedAt(latchedAt);
    setTransitionLocked(true);
    setNextTriggerReason('pass_latched');
    stop();
    /** PR success-diagnostic: success snapshot 저장 */
    recordSquatSuccessSnapshot({
      gate,
      successOpenedBy: 'effectivePassLatched',
      currentRoute: '/movement-test/camera/squat',
      passLatchedAtMs,
      effectivePassLatched,
      competingPaths: [],
    });
    persistCurrentStep();
    if (squatSessionBundleRecordedForStepKeyRef.current !== currentStepKey) {
      /* PR-CAM-OBS-FLUSH-HARDEN-01: bundle 직전 terminal 관측 1회(성공 경로는 effect captureTerminal 미도달) */
      if (squatTerminalObservationRef.current !== currentStepKey) {
        squatTerminalObservationRef.current = currentStepKey;
        recordSquatObservationEvent(gate, 'capture_session_terminal', {
          captureTerminalKind: 'pass_latched',
          shallowObservationContract: hasShallowSquatObservation(gate),
        });
      }
      recordCaptureSessionTerminalBundle({
        stepId: STEP_ID,
        gate,
        context: readinessTraceSummary,
        options: {
          liveCueingEnabled: cameraPhase === 'capturing',
          autoNextObservation: 'pass_latched',
          successTriggeredAtMs: passLatchedAtMs,
        },
        route: '/movement-test/camera/squat',
        terminalKind: 'success',
      });
      squatSessionBundleRecordedForStepKeyRef.current = currentStepKey;
    }
    setProgressionState('passed');
    setStatusMessage(gate.uiMessage);
    appendTransition('passed', 'pass_latched');
    /* 통과 직후 dev modal은 diag_modal=1 일 때만 자동 오픈(?debug=1 만으로는 모달 없음). */
    if (IS_DEV && urlDebugFlags.diagModal) {
      debugModalHoldRef.current = true;
      setDebugModalGate(gate);
      setShowSquatDebugModal(true);
    }
  }, [
    appendTransition,
    cameraPhase,
    currentStepKey,
    effectivePassLatched,
    gate,
    passLatched,
    persistCurrentStep,
    readinessTraceSummary,
    stop,
    urlDebugFlags.diagModal,
  ]);

  /**
   * 11D contract: route execution owner.
   * - Consumes already-latched success for currentStepKey only.
   * - Does NOT decide pass truth (domain/page latch truth are upstream).
   * - Enforces step-key idempotency for actual router.push.
   */
  const triggerLatchedNavigation = useCallback(
    (reason: 'route_push_next_step' | 'debug_modal_closed') => {
      if (!nextPath) return false;
      if (passLatchedStepKeyRef.current !== currentStepKey) return false;
      if (triggeredAdvanceStepKeyRef.current === currentStepKey) return false;

      triggeredAdvanceStepKeyRef.current = currentStepKey;
      setNavigationTriggered(true);
      setNextTriggeredAt(new Date().toISOString());
      setNextTriggerReason(reason);
      console.info('[camera:squat-next]', {
        currentStepKey,
        nextPath,
        triggeredAt: new Date().toISOString(),
        reason,
      });
      router.push(nextPath);
      return true;
    },
    [currentStepKey, nextPath, router]
  );

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

    const captureTerminal =
      gate.status === 'retry' ||
      gate.status === 'fail' ||
      gate.progressionState === 'insufficient_signal' ||
      gate.progressionState === 'retry_required' ||
      gate.progressionState === 'failed';

    if (captureTerminal) {
      const shallowObs = hasShallowSquatObservation(gate);
      const attemptEv = hasSquatAttemptEvidence(gate);
      const terminalKind =
        gate.status === 'retry'
          ? 'gate_retry'
          : gate.status === 'fail'
            ? 'gate_fail'
            : gate.progressionState;

      if (
        (shallowObs || attemptEv) &&
        squatTerminalAttemptSnapshotRef.current !== currentStepKey
      ) {
        /* PR-CAM-OBS-FLUSH-HARDEN-01: snapshot/bundle 직전 terminal 관측 1회(shallow-only도 attempt 경로와 동일 ref) */
        if (squatTerminalObservationRef.current !== currentStepKey) {
          squatTerminalObservationRef.current = currentStepKey;
          recordSquatObservationEvent(gate, 'capture_session_terminal', {
            captureTerminalKind: terminalKind,
            shallowObservationContract: shallowObs,
          });
        }
        squatTerminalAttemptSnapshotRef.current = currentStepKey;
        recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
          liveCueingEnabled: true,
          autoNextObservation: `capture_terminal:${gate.progressionState}:${gate.status}`,
        });
        if (squatSessionBundleRecordedForStepKeyRef.current !== currentStepKey) {
          recordCaptureSessionTerminalBundle({
            stepId: STEP_ID,
            gate,
            context: readinessTraceSummary,
            options: {
              liveCueingEnabled: true,
              autoNextObservation: `capture_terminal:${gate.progressionState}:${gate.status}`,
            },
            route: '/movement-test/camera/squat',
            terminalKind: squatTerminalKindFromGate(gate),
          });
          squatSessionBundleRecordedForStepKeyRef.current = currentStepKey;
        }
      }
    }

    if (gate.status === 'retry' || gate.status === 'fail') {
      settledRef.current = true;
      stop();
      /* 일반 retry/fail: freeze 없이도 실제 시도면 shallow 실패 스냅샷 1회(overlay 아님·차단 사유 기록) */
      if (hasSquatAttemptEvidence(gate) && failedSnapshotRecordedForPreviewKeyRef.current !== previewKey) {
        recordSquatFailedShallowSnapshot(gate, {
          failureOverlayArmed: false,
          failureOverlayBlockedReason:
            gate.squatCycleDebug?.completionBlockedReason ??
            gate.failureReasons[0] ??
            null,
          attemptOutcome: gate.status === 'retry' ? 'retry' : 'fail',
          finalPassLatched,
        });
        failedSnapshotRecordedForPreviewKeyRef.current = previewKey;
      } else if (
        hasShallowSquatObservation(gate) &&
        failedSnapshotRecordedForPreviewKeyRef.current !== previewKey
      ) {
        recordSquatFailedShallowSnapshot(gate, {
          failureOverlayArmed: false,
          failureOverlayBlockedReason: 'shallow_observed_below_attempt_evidence',
          attemptOutcome: gate.status === 'retry' ? 'retry' : 'fail',
          finalPassLatched,
        });
        failedSnapshotRecordedForPreviewKeyRef.current = previewKey;
      }
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
    finalPassLatched,
    permissionDenied,
    previewKey,
    stats.sampledFrameCount,
    stop,
    readinessTraceSummary,
  ]);

  useEffect(() => {
    /* PR-CAM-30A: pass latch effect 는 capturing 에서만 동작 */
    if (cameraPhase !== 'capturing') return;
    // 11D contract layer A: domain latch truth consumer (library-owned truth).
    const domainLatchOpen = effectivePassLatched;
    if (!domainLatchOpen) {
      return;
    }

    // 11D contract layer B: page success-event latch consumption (step-key one-shot).
    const pageSuccessConsumedForStep = passLatchedStepKeyRef.current === currentStepKey;
    if (!pageSuccessConsumedForStep) {
      latchPassEvent();
      return;
    }

    // 11D contract layer D: route execution idempotency for current step.
    const routeAlreadyTriggeredForStep =
      triggeredAdvanceStepKeyRef.current === currentStepKey || navigationTriggered;
    if (routeAlreadyTriggeredForStep) {
      return;
    }

    if (!nextPath) {
      setNextTriggerReason('transition_not_triggered');
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
      /* PR-DBG-01: dev modal이 열려 있으면 navigation hold — modal close 핸들러가 진행 */
      if (IS_DEV && debugModalHoldRef.current) {
        return;
      }

      triggerLatchedNavigation('route_push_next_step');
    }, SQUAT_AUTO_ADVANCE_MS);
  }, [
    cameraPhase,
    clearAutoAdvanceTimer,
    currentStepKey,
    effectivePassLatched,
    latchPassEvent,
    navigationTriggered,
    nextPath,
    triggerLatchedNavigation,
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

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  /**
   * CAM-OBS: 라이브 gate 갱신마다 freeze 후보 갱신(엣지 1회 고정은 observability 모듈 내부).
   * 터미널 JSON 은 `camera-trace` 의 `buildSquatCameraObservabilityExport` 가 export 직전에 동기 `note` 로도 보장함
   * (PR-CAM-OBS-PASS-SNAPSHOT-FREEZE-PERSIST-01 — effect 순서와 무관하게 persist).
   */
  useEffect(() => {
    noteSquatGateForCameraObservability(gate);
  }, [gate]);

  useEffect(() => {
    if (!IS_DEV || typeof window === 'undefined') return;
    type CamTraceApi = {
      getLatestCaptureSessionBundle: typeof getLatestCaptureSessionBundle;
      getRecentCaptureSessionBundles: typeof getRecentCaptureSessionBundles;
      copyLatestCaptureSessionBundleJson: typeof copyLatestCaptureSessionBundleJson;
      clearCaptureSessionBundles: typeof clearCaptureSessionBundles;
    };
    const api: CamTraceApi = {
      getLatestCaptureSessionBundle,
      getRecentCaptureSessionBundles,
      copyLatestCaptureSessionBundleJson,
      clearCaptureSessionBundles,
    };
    (window as Window & { __MOVE_RE_CAMERA_TRACE__?: CamTraceApi }).__MOVE_RE_CAMERA_TRACE__ = api;
    return () => {
      delete (window as Window & { __MOVE_RE_CAMERA_TRACE__?: CamTraceApi }).__MOVE_RE_CAMERA_TRACE__;
    };
  }, []);

  useEffect(() => {
    return () => {
      /* PR-CAM-30A: capturing 에 한 번도 들어가지 않은 세션은 terminal 번들 미기록 */
      if (!squatCaptureSessionEnteredRef.current) return;
      const stepKey = latestStepKeyForBundleRef.current;
      if (squatSessionBundleRecordedForStepKeyRef.current === stepKey) return;
      const g = gateRef.current;
      if (!g) return;
      if (statsRef.current.sampledFrameCount < 1) return;
      if (squatTerminalObservationRef.current !== stepKey) {
        squatTerminalObservationRef.current = stepKey;
        recordSquatObservationEvent(g, 'capture_session_terminal', {
          captureTerminalKind: 'unmount_abandoned',
          shallowObservationContract: hasShallowSquatObservation(g),
        });
      }
      recordCaptureSessionTerminalBundle({
        stepId: STEP_ID,
        gate: g,
        context: readinessTraceSummaryRef.current,
        options: { liveCueingEnabled: false, autoNextObservation: 'unmount_abandoned' },
        route: '/movement-test/camera/squat',
        terminalKind: 'abandoned',
      });
      squatSessionBundleRecordedForStepKeyRef.current = stepKey;
    };
  }, []);

  const prevCameraPhaseForShallowResetRef = useRef(cameraPhase);
  useEffect(() => {
    const prev = prevCameraPhaseForShallowResetRef.current;
    prevCameraPhaseForShallowResetRef.current = cameraPhase;
    if (cameraPhase === 'capturing' && prev !== 'capturing') {
      squatObsHadShallowThisCaptureRef.current = false;
    }
  }, [cameraPhase]);

  /* CAM-27: capturing 중 스쿼트 사전 관측 — 엣지·의미 있는 필드 변경만 기록(프레임 스팸 없음) */
  useEffect(() => {
    if (cameraPhase !== 'capturing' || effectivePassLatched || permissionDenied) {
      const o = squatObsEdgeRef.current;
      if (o.stallTimer) {
        window.clearTimeout(o.stallTimer);
        o.stallTimer = null;
      }
      return;
    }
    if (stats.sampledFrameCount < 1) return;

    const sc = gate.squatCycleDebug;
    const hm = gate.evaluatorResult?.debug?.highlightedMetrics as Record<string, unknown> | undefined;
    if (!sc && !hm) return;

    if (hasShallowSquatObservation(gate) && !squatShallowObservedEdgeRef.current) {
      squatShallowObservedEdgeRef.current = true;
      recordSquatObservationEvent(gate, 'shallow_observed', { shallowObservationContract: true });
    }

    const ref = squatObsEdgeRef.current;
    const signals = deriveSquatObservabilitySignals(gate);
    const relPeak = typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined;
    const bucket = relativeDepthPeakBucket(relPeak ?? null);
    const attemptStarted = !!(sc?.attemptStarted ?? hm?.attemptStarted);
    const downward = squatDownwardCommitmentReachedObservable(gate);
    const descendOk = !!(sc?.descendConfirmed ?? hm?.descendConfirmed);
    const reversalOk = !!sc?.reversalConfirmedAfterDescend;
    const recoveryOk = !!sc?.recoveryConfirmedAfterReversal;
    const evidenceLabel =
      (sc?.evidenceLabel as string | undefined) ?? (hm?.evidenceLabel as string | undefined) ?? null;
    const completionBlocked =
      sc?.completionBlockedReason ?? (hm?.completionBlockedReason as string | null | undefined) ?? null;
    const standardBlocked = sc?.standardPathBlockedReason ?? null;

    const scheduleStallIfNeeded = () => {
      if (ref.stallRecorded || ref.stallTimer) return;
      if (!ref.preAttemptRecorded) return;
      if (ref.attemptStarted || ref.descendConfirmed) return;
      ref.stallTimer = window.setTimeout(() => {
        ref.stallTimer = null;
        const g = gateRef.current;
        if (!g || isFinalPassLatched(STEP_ID, g)) return;
        const inner = squatObsEdgeRef.current;
        if (inner.stallRecorded) return;
        if (inner.descendConfirmed || inner.attemptStarted) return;
        if (!deriveSquatObservabilitySignals(g).shallowCandidateObserved) return;
        recordSquatObservationEvent(g, 'attempt_stalled');
        inner.stallRecorded = true;
      }, SQUAT_OBS_STALL_AFTER_MS);
    };

    if (signals.shallowCandidateObserved && !ref.preAttemptRecorded) {
      recordSquatObservationEvent(gate, 'pre_attempt_candidate');
      ref.preAttemptRecorded = true;
      squatObsHadShallowThisCaptureRef.current = true;
      scheduleStallIfNeeded();
    }

    const prevBucket = ref.depthBucket;
    if (bucket != null) {
      if (
        prevBucket != null &&
        bucket !== prevBucket &&
        relPeak != null &&
        relPeak >= 0.02
      ) {
        recordSquatObservationEvent(gate, 'relative_depth_bucket_changed', {
          priorRelativeDepthPeakBucket: prevBucket,
        });
        squatObsHadShallowThisCaptureRef.current = true;
      }
      ref.depthBucket = bucket;
      if (!ref.preAttemptRecorded && signals.shallowCandidateObserved) {
        ref.preAttemptRecorded = true;
        squatObsHadShallowThisCaptureRef.current = true;
        scheduleStallIfNeeded();
      }
    }

    if (attemptStarted && !ref.attemptStarted) {
      recordSquatObservationEvent(gate, 'attempt_started');
      ref.attemptStarted = true;
      if (ref.stallTimer) {
        window.clearTimeout(ref.stallTimer);
        ref.stallTimer = null;
      }
    }
    if (downward && !ref.downwardCommitment) {
      recordSquatObservationEvent(gate, 'downward_commitment_reached');
      ref.downwardCommitment = true;
    }
    if (descendOk && !ref.descendConfirmed) {
      recordSquatObservationEvent(gate, 'descent_detected');
      ref.descendConfirmed = true;
      if (ref.stallTimer) {
        window.clearTimeout(ref.stallTimer);
        ref.stallTimer = null;
      }
    }
    if (reversalOk && !ref.reversal) {
      recordSquatObservationEvent(gate, 'reversal_detected');
      ref.reversal = true;
    }
    if (recoveryOk && !ref.recovery) {
      recordSquatObservationEvent(gate, 'recovery_detected');
      ref.recovery = true;
    }

    const motionContext =
      signals.shallowCandidateObserved || descendOk || (relPeak != null && relPeak >= 0.02);

    if (evidenceLabel != null && evidenceLabel !== ref.evidenceLabel && ref.evidenceLabel != null) {
      if (motionContext) {
        recordSquatObservationEvent(gate, 'evidence_label_changed', {
          priorEvidenceLabel: ref.evidenceLabel ?? undefined,
        });
      }
    }
    if (evidenceLabel != null) ref.evidenceLabel = evidenceLabel;

    const meaningfulBlocked =
      completionBlocked != null && completionBlocked !== 'guardrail_not_complete';
    if (meaningfulBlocked && completionBlocked !== ref.completionBlocked && ref.completionBlocked != null) {
      if (motionContext) {
        recordSquatObservationEvent(gate, 'completion_blocked_changed', {
          priorCompletionBlockedReason: ref.completionBlocked,
        });
      }
    }
    if (completionBlocked !== ref.completionBlocked) {
      ref.completionBlocked = completionBlocked;
    }

    if (
      standardBlocked != null &&
      standardBlocked !== ref.standardBlocked &&
      ref.standardBlocked != null
    ) {
      if (motionContext) {
        recordSquatObservationEvent(gate, 'standard_path_blocked_changed', {
          priorStandardPathBlockedReason: ref.standardBlocked,
        });
      }
    }
    if (standardBlocked !== ref.standardBlocked) {
      ref.standardBlocked = standardBlocked;
    }
  }, [
    cameraPhase,
    effectivePassLatched,
    permissionDenied,
    gate,
    stats.sampledFrameCount,
  ]);

  const prevCameraPhaseForObsRef = useRef(cameraPhase);
  useEffect(() => {
    const prev = prevCameraPhaseForObsRef.current;
    prevCameraPhaseForObsRef.current = cameraPhase;
    if (prev !== 'capturing' || cameraPhase === 'capturing' || effectivePassLatched) return;

    const g = gateRef.current;
    const ref = squatObsEdgeRef.current;
    if (!g || ref.stallRecorded) return;
    if (!squatObsHadShallowThisCaptureRef.current) return;
    if (ref.descendConfirmed || ref.attemptStarted) return;
    recordSquatObservationEvent(g, 'attempt_abandoned');
  }, [cameraPhase, effectivePassLatched]);

  /* diagnostic: capturing 4.5초 동안 pass 못 하면 failure freeze overlay */
  useEffect(() => {
    if (
      cameraPhase !== 'capturing' ||
      effectivePassLatched ||
      !isDiagnosticFreezeMode() ||
      showFailureFreezeOverlay ||
      showSuccessFreezeOverlay
    ) {
      if (failureFreezeTimerRef.current) {
        window.clearTimeout(failureFreezeTimerRef.current);
        failureFreezeTimerRef.current = null;
      }
      return;
    }

    failureFreezeTimerRef.current = window.setTimeout(() => {
      failureFreezeTimerRef.current = null;
      const g = gateRef.current;
      if (!g) return;
      if (!hasSquatAttemptEvidence(g)) {
        return;
      }
      const pk = previewKeyRef.current;
      if (failedSnapshotRecordedForPreviewKeyRef.current === pk) {
        setShowFailureFreezeOverlay(true);
        return;
      }
      recordSquatFailedShallowSnapshot(g, {
        failureOverlayArmed: true,
        failureOverlayBlockedReason: null,
        attemptOutcome: 'fail',
        finalPassLatched: finalPassLatchedRef.current,
      });
      failedSnapshotRecordedForPreviewKeyRef.current = pk;
      setShowFailureFreezeOverlay(true);
    }, SQUAT_FAILURE_FREEZE_DELAY_MS);

    return () => {
      if (failureFreezeTimerRef.current) {
        window.clearTimeout(failureFreezeTimerRef.current);
        failureFreezeTimerRef.current = null;
      }
    };
  }, [
    cameraPhase,
    effectivePassLatched,
    failureFreezeRetryEpoch,
    showFailureFreezeOverlay,
    showSuccessFreezeOverlay,
  ]);

  const handleRetry = useCallback(() => {
    unlockVoiceGuidance();
    recordAttemptSnapshot(STEP_ID, gate, readinessTraceSummary, {
      liveCueingEnabled: cameraPhase === 'capturing',
      autoNextObservation: 'retry',
    });
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
    prevCapturingReadinessRef.current = null;
    readyToShootAttemptedRef.current = false;
    setCameraPhase('setup');
    setWhiteTransitionDebug(null);
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
    setShowSuccessFreezeOverlay(false);
    setShowFailureFreezeOverlay(false);
    /* PR-DBG-01: 재시도 시 debug modal 상태 초기화 */
    setShowSquatDebugModal(false);
    setDebugModalGate(null);
    debugModalHoldRef.current = false;
    setPreviewKey((prev) => prev + 1);
    appendTransition('idle', 'manual_retry');
  }, [cameraPhase, clearAutoAdvanceTimer, gate, readinessTraceSummary, stop]);

  const handleCameraError = useCallback(() => {
    clearAutoAdvanceTimer();
    if (failureFreezeTimerRef.current) {
      window.clearTimeout(failureFreezeTimerRef.current);
      failureFreezeTimerRef.current = null;
    }
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
    setShowFailureFreezeOverlay(false);
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

  /** PR-DBG-01: debug modal 닫기 → modal hold 해제 → navigation 이어서 실행 */
  const handleDebugModalClose = useCallback(() => {
    debugModalHoldRef.current = false;
    setShowSquatDebugModal(false);
    setDebugModalGate(null);
    /* 타이머가 이미 만료되어 hold로 중단됐거나, 아직 실행 전인 경우 모두 커버:
     * triggeredAdvanceStepKeyRef를 확인해 이미 navigation이 나간 경우 중복 방지 */
    triggerLatchedNavigation('debug_modal_closed');
  }, [triggerLatchedNavigation]);

  const handleSuccessFreezeContinue = useCallback(() => {
    setShowSuccessFreezeOverlay(false);
    const path = getNextStepPath(STEP_ID);
    if (path) router.push(path);
  }, [router]);

  const handleFailureFreezeClose = useCallback(() => {
    setShowFailureFreezeOverlay(false);
  }, []);

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
  const effectiveProgressionState =
    cameraPhase === 'capturing' && effectivePassLatched ? 'passed' : progressionState;
  const guideTone = getGuideToneFromLiveReadiness(liveReadiness);
  const overlayGuide = getSquatOverlayGuide(gate.failureReasons, effectiveProgressionState);
  const isPreCapturePhase =
    cameraPhase === 'setup' || cameraPhase === 'arming' || cameraPhase === 'countdown';
  const isMinimalCapture =
    cameraPhase === 'capturing' && !showRetryActions;
  const hasDebugQuery = urlDebugFlags.debug;
  const showPoseOverlayForDiagnostics =
    urlDebugFlags.debug || urlDebugFlags.diag || urlDebugFlags.poseOverlay;
  const showDebugPanel =
    debugEnabled &&
    (isPreCapturePhase || showRetryActions || hasDebugQuery);
  /** ?debug=1: minimal 캡처·재시도 중에도 모바일에서 볼 수 있는 컴팩트 스트립 */
  const showCompactMobileDebugStrip =
    hasDebugQuery && (isMinimalCapture || showRetryActions) && !permissionDenied;

  return (
    <StitchCameraSquatRoot>
      <SquatMobileDiagPanel unlocked={mobileDiagUnlocked} />
      {/* PR-DBG-01: dev-only 통과 후 debug modal — finalPassLatched 이후에만 렌더링 */}
      {IS_DEV && showSquatDebugModal && debugModalGate && (
        <SquatPostPassDebugModal
          gate={debugModalGate}
          finalPassLatched={finalPassLatched}
          onClose={handleDebugModalClose}
        />
      )}
      {showSuccessFreezeOverlay && (
        <SuccessFreezeOverlay
          motionType="squat"
          onContinue={handleSuccessFreezeContinue}
        />
      )}
      {showFailureFreezeOverlay && (
        <FailureFreezeOverlay onClose={handleFailureFreezeClose} />
      )}
      <StitchCameraSquatHeader
        left={
          <div className="w-12">
            {prevPath ? (
              <Link
                href={prevPath}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                aria-label="이전"
              >
                <ChevronLeft className="size-6 text-[#ffb77d]" />
              </Link>
            ) : (
              <Link
                href="/movement-test/camera"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-white/10"
                aria-label="이전"
              >
                <ChevronLeft className="size-6 text-[#ffb77d]" />
              </Link>
            )}
          </div>
        }
        center={
          <span className="inline-flex touch-manipulation" onClick={onHeaderAreaTapForDiag}>
            <StitchCameraSquatHeaderCenter stepLabel="1 / 2" />
          </span>
        }
      />

      <main className="relative z-10 flex-1 flex flex-col items-center px-6 py-4 overflow-hidden">
        {!isMinimalCapture && (
          <>
            <h1
              className="text-xl font-bold text-slate-100 mb-2 shrink-0 touch-manipulation"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
              onClick={onHeaderAreaTapForDiag}
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
            <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-sm text-slate-400">
              카메라 접근이 거부되었습니다.
              <br />
              브라우저 설정에서 카메라 권한을 허용해 주세요.
            </p>
            <div className="flex w-full flex-col gap-3">
              <StitchCameraPrimaryButton onClick={handleRetry}>다시 시도</StitchCameraPrimaryButton>
              <StitchCameraPrimaryButton variant="outline" onClick={handleSurveyFallback}>
                설문형으로 전환
              </StitchCameraPrimaryButton>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full max-w-md flex-1 min-h-0 flex flex-col items-center relative">
              <CameraPreview
                key={previewKey}
                onVideoReady={handleVideoReady}
                onPoseFrame={pushFrameDuringCapturingOnly}
                showPoseDebugOverlay={showPoseOverlayForDiagnostics}
                onError={handleCameraError}
                guideTone={isPreCapturePhase ? 'neutral' : guideTone}
                guideHint={isMinimalCapture ? null : isPreCapturePhase ? null : overlayGuide.hint}
                guideFocus={isMinimalCapture ? null : isPreCapturePhase ? null : overlayGuide.focus}
                guideAnimated={isMinimalCapture ? false : isPreCapturePhase ? false : overlayGuide.animated}
                guideVariant="default"
                guideBadges={isMinimalCapture ? [] : cameraPhase === 'setup' ? ['전신', '1.8~2m 거리', '폰 낮게'] : []}
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

            {cameraPhase === 'setup' && setupGuide.instructions.length > 0 && (
              <ExternalCameraGuidePanel
                variant="squat"
                lines={setupGuide.instructions}
                className="w-full max-w-md mt-2 shrink-0"
              />
            )}

            {showCompactMobileDebugStrip && (
              <div
                className="w-full max-w-md mt-2 shrink-0 rounded-xl border border-cyan-500/30 bg-black/55 px-3 py-2 text-[11px] text-slate-200"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                <p className="mb-1 font-medium text-cyan-200/90">debug (캡처)</p>
                <p className="break-all">gate: {gate.status}</p>
                <p className="break-all">
                  completionBlocked: {gate.squatCycleDebug?.completionBlockedReason ?? '—'}
                </p>
                <p className="break-all">
                  completionPassReason: {gate.squatCycleDebug?.completionPassReason ?? '—'}
                </p>
                <p className="break-all">
                  completionPathUsed: {gate.squatCycleDebug?.completionPathUsed ?? '—'}
                </p>
                {/* PR-04D1: pass vs quality-only — dev 관측 전용 */}
                <p className="break-all">
                  completionTruthPassed:{' '}
                  {String(gate.squatCycleDebug?.completionTruthPassed ?? '—')}
                </p>
                <p className="break-all">
                  lowQualityPassAllowed:{' '}
                  {String(gate.squatCycleDebug?.lowQualityPassAllowed ?? '—')}
                </p>
                <p className="break-all">passOwner: {gate.squatCycleDebug?.passOwner ?? '—'}</p>
                <p className="break-all">
                  qualityOnlyWarnings:{' '}
                  {(gate.squatCycleDebug?.qualityOnlyWarnings ?? []).join(', ') || '—'}
                </p>
                {/* PR-04E1: depth/arming 입력 — dev only */}
                <p className="mt-2 font-medium text-cyan-200/80">depth/arming (dev)</p>
                <p className="break-all">
                  peakPrimary%: {gate.squatCycleDebug?.squatDepthPeakPrimary ?? '—'} | peakBlended%:{' '}
                  {gate.squatCycleDebug?.squatDepthPeakBlended ?? '—'}
                </p>
                <p className="break-all">
                  armingDepthPeak: {gate.squatCycleDebug?.armingDepthPeak ?? '—'} | source:{' '}
                  {gate.squatCycleDebug?.armingDepthSource ?? '—'}
                </p>
                <p className="break-all">
                  depthBlendAssisted: {String(gate.squatCycleDebug?.armingDepthBlendAssisted ?? '—')} |
                  armingFallbackUsed: {String(gate.squatCycleDebug?.armingFallbackUsed ?? '—')}
                </p>
                <p>confidence: {gate.confidence}</p>
                <p>captureQuality: {gate.guardrail.captureQuality}</p>
                <p className="break-all">
                  failureReasons: {gate.failureReasons.join(', ') || '—'}
                </p>
                <p>
                  relativeDepthPeak:{' '}
                  {typeof gate.evaluatorResult.debug?.highlightedMetrics?.relativeDepthPeak === 'number'
                    ? gate.evaluatorResult.debug.highlightedMetrics.relativeDepthPeak
                    : '—'}
                </p>
                <p className="break-all">
                  PR-04E3A rel source: {gate.squatCycleDebug?.relativeDepthPeakSource ?? '—'} | rawPeak
                  primary: {gate.squatCycleDebug?.rawDepthPeakPrimary ?? '—'} | rawPeak blended:{' '}
                  {gate.squatCycleDebug?.rawDepthPeakBlended ?? '—'}
                </p>
                {/* PR-04E3B: baseline freeze / peak latch / event-cycle owner (dev) */}
                <p className="mt-2 font-medium text-cyan-200/80">event-cycle owner (dev)</p>
                <p className="break-all">
                  baselineFrozen: {String(gate.squatCycleDebug?.baselineFrozen ?? '—')} | frozenDepth:{' '}
                  {gate.squatCycleDebug?.baselineFrozenDepth ?? '—'} | peakLatched:{' '}
                  {String(gate.squatCycleDebug?.peakLatched ?? '—')} | peakIdx:{' '}
                  {gate.squatCycleDebug?.peakLatchedAtIndex ?? '—'}
                </p>
                <p className="break-all">
                  eventCycle: detected={String(gate.squatCycleDebug?.eventCycleDetected ?? '—')} | band:{' '}
                  {gate.squatCycleDebug?.eventCycleBand ?? '—'} | promoted:{' '}
                  {String(gate.squatCycleDebug?.eventCyclePromoted ?? '—')} | source:{' '}
                  {gate.squatCycleDebug?.eventCycleSource ?? '—'}
                </p>
                {/* PR-HMM-03A: dev-only calibration strip — production UX unchanged */}
                <p className="mt-2 font-medium text-cyan-200/80">calibration (dev)</p>
                <p className="break-all">
                  ruleBlocked: {gate.squatCycleDebug?.ruleCompletionBlockedReason ?? '—'}
                </p>
                <p className="break-all">
                  finalBlocked: {gate.squatCycleDebug?.postAssistCompletionBlockedReason ?? gate.squatCycleDebug?.completionBlockedReason ?? '—'}
                </p>
                <p>
                  assistEligible: {String(gate.squatCycleDebug?.hmmAssistEligible ?? false)} | assistApplied:{' '}
                  {String(gate.squatCycleDebug?.hmmAssistApplied ?? false)} | assistReason:{' '}
                  {gate.squatCycleDebug?.hmmAssistReason ?? '—'}
                </p>
                <p>
                  assistSuppressedByFinalize: {String(gate.squatCycleDebug?.assistSuppressedByFinalize ?? false)}
                </p>
                <p className="break-all">
                  finalizeReason: {gate.squatCycleDebug?.standingRecoveryFinalizeReason ?? '—'} | band:{' '}
                  {gate.squatCycleDebug?.standingRecoveryBand ?? '—'}
                </p>
                <p>
                  hmmConf: {gate.squatCycleDebug?.hmmConfidence ?? '—'} | hmmExc:{' '}
                  {gate.squatCycleDebug?.hmmExcursion ?? '—'}
                </p>
                {/* PR-HMM-04A: arming assist — dev only */}
                <p className="mt-2 font-medium text-cyan-200/80">arming (dev)</p>
                <p>
                  armed:{' '}
                  {String(Boolean(gate.evaluatorResult?.debug?.squatCompletionArming?.armed))} | effectiveArmed:{' '}
                  {String(gate.squatCycleDebug?.effectiveArmed ?? false)}
                </p>
                <p>
                  hmmArmingAssistEligible:{' '}
                  {String(gate.squatCycleDebug?.hmmArmingAssistEligible ?? false)} | applied:{' '}
                  {String(gate.squatCycleDebug?.hmmArmingAssistApplied ?? false)}
                </p>
                <p className="break-all">
                  hmmArmingAssistReason: {gate.squatCycleDebug?.hmmArmingAssistReason ?? '—'}
                </p>
                <p className="mt-2 font-medium text-cyan-200/80">reversal assist (dev)</p>
                <p>
                  hrae: {String(gate.squatCycleDebug?.hmmReversalAssistEligible ?? false)} | hraa:{' '}
                  {String(gate.squatCycleDebug?.hmmReversalAssistApplied ?? false)}
                </p>
                <p className="break-all">
                  hrar: {gate.squatCycleDebug?.hmmReversalAssistReason ?? '—'}
                </p>
                <p className="mt-2 font-medium text-cyan-200/80">reversal confirmation PR-04E2 (dev)</p>
                <p className="break-all">
                  confirmedBy: {gate.squatCycleDebug?.reversalConfirmedBy ?? '—'} | drop:{' '}
                  {gate.squatCycleDebug?.reversalDepthDrop ?? '—'} | frames:{' '}
                  {gate.squatCycleDebug?.reversalFrameCount ?? '—'}
                </p>
              </div>
            )}

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
                    <StitchCameraPrimaryButton onClick={handleSetupReady}>준비됐어요</StitchCameraPrimaryButton>
                  )}
                </div>
              ) : showRetryActions ? (
                <div className="flex flex-col gap-3">
                  <StitchCameraPrimaryButton onClick={handleRetry}>다시 해주세요</StitchCameraPrimaryButton>
                  <StitchCameraPrimaryButton variant="outline" onClick={handleSurveyFallback}>
                    설문형으로 전환
                  </StitchCameraPrimaryButton>
                </div>
              ) : (
                <>
              <StitchCameraGlassPanel>
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
              </StitchCameraGlassPanel>

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

            {IS_DEV && showDebugPanel && !isMinimalCapture && (
              <div className="w-full max-w-md mt-2 space-y-3 shrink-0">
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
                    <span>peakDepth: {depthProxy ?? 'n/a'}</span>
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
                    {whiteTransitionDebug && (
                      <>
                        <span>prevReadiness: {whiteTransitionDebug.prevReadiness ?? 'null'}</span>
                        <span>enteredWhite: {String(whiteTransitionDebug.enteredWhite)}</span>
                        <span>readyToShootPlayed: {String(whiteTransitionDebug.played ?? false)}</span>
                        <span>readyToShootSuppress: {whiteTransitionDebug.suppressionReason ?? 'none'}</span>
                      </>
                    )}
                    {gate.squatCycleDebug && (
                      <>
                        <span>armingSatisfied: {String(gate.squatCycleDebug.armingSatisfied)}</span>
                        <span>startPoseSatisfied: {String(gate.squatCycleDebug.startPoseSatisfied)}</span>
                        <span>startBeforeBottom: {String(gate.squatCycleDebug.startBeforeBottom)}</span>
                        <span>descendDetected: {String(gate.squatCycleDebug.descendDetected)}</span>
                        <span>bottomDetected: {String(gate.squatCycleDebug.bottomDetected)}</span>
                        <span>bottomTurningPointDetected: {String(gate.squatCycleDebug.bottomTurningPointDetected)}</span>
                        <span>ascendDetected: {String(gate.squatCycleDebug.ascendDetected)}</span>
                        <span>recoveryDetected: {String(gate.squatCycleDebug.recoveryDetected)}</span>
                        <span>cycleComplete: {String(gate.squatCycleDebug.cycleComplete)}</span>
                        <span>completionStatus: {gate.squatCycleDebug.completionStatus}</span>
                        <span>depthBand: {gate.squatCycleDebug.depthBand}</span>
                        <span>passBlockedReason: {gate.squatCycleDebug.passBlockedReason ?? 'none'}</span>
                        <span>qualityInterpretationReason: {gate.squatCycleDebug.qualityInterpretationReason ?? 'n/a'}</span>
                        <span>passTriggeredAtPhase: {gate.squatCycleDebug.passTriggeredAtPhase ?? 'n/a'}</span>
                        <span>
                          completionMachinePhase:{' '}
                          {gate.squatCycleDebug.completionMachinePhase ?? 'n/a'}
                        </span>
                        <span>
                          completionBlockedReason:{' '}
                          {gate.squatCycleDebug.completionBlockedReason ?? 'none'}
                        </span>
                        <span>
                          ambiguousRetryMinMs: {SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS}
                        </span>
                        <span>
                          ambiguousRetryReason:{' '}
                          {deriveSquatAmbiguousRetryReason(gate, stats.captureDurationMs) ?? '—'}
                        </span>
                        <span>
                          ambiguousVoicePlayed: {String(squatAmbiguousRetryHud.voicePlayed)}
                        </span>
                        <span>
                          ambiguousVoiceReason: {squatAmbiguousRetryHud.reason ?? '—'}
                        </span>
                        <span>
                          secondChanceSatisfied:{' '}
                          {String(squatAmbiguousRetryHud.secondChanceCompletionSatisfied)}
                        </span>
                        <span className="col-span-2">
                          retryContractObs:{' '}
                          {gate.squatCycleDebug?.squatRetryContractObservation
                            ? JSON.stringify(gate.squatCycleDebug.squatRetryContractObservation)
                            : '—'}
                        </span>
                        {gate.squatCycleDebug.squatInternalQuality && (
                          <>
                            <span>
                              internalQ tier: {gate.squatCycleDebug.squatInternalQuality.qualityTier}
                            </span>
                            <span className="col-span-2">
                              internalQ d/c/s/r/conf:{' '}
                              {[
                                gate.squatCycleDebug.squatInternalQuality.depthScore,
                                gate.squatCycleDebug.squatInternalQuality.controlScore,
                                gate.squatCycleDebug.squatInternalQuality.symmetryScore,
                                gate.squatCycleDebug.squatInternalQuality.recoveryScore,
                                gate.squatCycleDebug.squatInternalQuality.confidence,
                              ]
                                .map((n) => n.toFixed(2))
                                .join(' / ')}
                            </span>
                            <span className="col-span-2">
                              internalQ lim:{' '}
                              {gate.squatCycleDebug.squatInternalQuality.limitations.join(', ') ||
                                'none'}
                            </span>
                          </>
                        )}
                      </>
                    )}
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
                    liveCueingEnabled={cameraPhase === 'capturing'}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </StitchCameraSquatRoot>
  );
}

function getMetricValueFromList(
  metrics: Array<{ name: string; value: number }> | undefined,
  name: string
): number | null {
  const metric = metrics?.find((item) => item.name === name);
  return typeof metric?.value === 'number' ? metric.value : null;
}
