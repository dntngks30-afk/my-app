/**
 * PR-4: 카메라 시도 관측용 경량 trace
 * - pass/funnel/result 계약 변경 없음
 * - 요약 전용 snapshot, raw frame/landmark 저장 없음
 */
import type { ExerciseGateResult } from './auto-progression';
import type { CaptureQuality } from './guardrails';
import type { CameraStepId } from '@/lib/public/camera-test';
import {
  CAMERA_DIAG_VERSION,
  hasShallowSquatObservation,
  hasSquatAttemptEvidence,
} from './camera-success-diagnostic';
import { isFinalPassLatched } from './auto-progression';
import { getCorrectiveCueObservability } from './voice-guidance';
import { getLastPlaybackObservability } from './korean-audio-pack';
import type { SquatInternalQuality } from './squat/squat-internal-quality';
import { buildSquatCalibrationTraceCompact } from '@/lib/camera/squat/squat-calibration-trace';
import { buildSquatArmingAssistTraceCompact } from '@/lib/camera/squat/squat-arming-assist';
import { buildSquatReversalAssistTraceCompact } from '@/lib/camera/squat/squat-reversal-assist';
import type { OverheadInternalQuality } from './overhead/overhead-internal-quality';
import {
  buildSquatResultSeveritySummary,
  type SquatPassSeverity,
  type SquatResultInterpretation,
} from './squat-result-severity';

/** PR-4: movement type (squat, overhead_reach만 지원) */
export type TraceMovementType = 'squat' | 'overhead_reach';

/** PR-4: 최종 결과 카테고리 */
export type TraceOutcome =
  | 'ok'
  | 'low'
  | 'invalid'
  | 'retry_required'
  | 'retry_optional'
  | 'failed';

/** PR-4: 경량 attempt snapshot */
export interface AttemptSnapshot {
  id: string;
  ts: string;
  movementType: TraceMovementType;
  outcome: TraceOutcome;
  captureQuality: CaptureQuality;
  confidence: number;
  motionCompleteness: string;
  progressionPassed: boolean;
  finalPassLatched: boolean;
  fallbackType: string | null;
  flags: string[];
  topReasons: string[];
  perStepSummary?: Record<string, unknown>;
  readinessSummary?: {
    state: 'not_ready' | 'ready' | 'success';
    rawState?: 'not_ready' | 'ready' | 'success';
    blocker: string | null;
    framingHint: string | null;
    smoothingApplied: boolean;
    validFrameCount?: number;
    visibleJointsRatio?: number;
    criticalJointsAvailability?: number;
  };
  stabilitySummary?: {
    warmupExcludedFrameCount?: number;
    qualityFrameCount?: number;
    selectedWindowStartMs?: number | null;
    selectedWindowEndMs?: number | null;
    selectedWindowScore?: number | null;
  };
  /** dev-only: real-device diagnosis — pass/cue/latch 직결 런타임 값 */
  diagnosisSummary?: {
    stepId: string;
    readinessState?: string;
    captureQuality: CaptureQuality;
    completionSatisfied: boolean;
    passConfirmed: boolean;
    passLatched: boolean;
    autoNextObservation?: string;
    sampledFrameCount?: number;
    /** squat — PR-A4 cycle trace */
    squatCycle?: {
      peakDepth?: number;
      depthBand?: string;
      currentSquatPhase?: string;
      descendDetected: boolean;
      bottomDetected: boolean;
      recoveryDetected: boolean;
      startBeforeBottom: boolean;
      cycleComplete: boolean;
      passBlockedReason: string | null;
      completionPathUsed?: string;
      completionRejectedReason?: string | null;
      descendStartAtMs?: number;
      downwardCommitmentAtMs?: number;
      committedAtMs?: number;
      reversalAtMs?: number;
      ascendStartAtMs?: number;
      recoveryAtMs?: number;
      standingRecoveredAtMs?: number;
      standingRecoveryHoldMs?: number;
      successPhaseAtOpen?: string;
      cycleDurationMs?: number;
      downwardCommitmentDelta?: number;
      ultraLowRomCandidate?: boolean;
      ultraLowRomGuardPassed?: boolean;
      ultraLowRomRejectReason?: string | null;
      standingStillRejected?: boolean;
      falsePositiveBlockReason?: string | null;
      descendConfirmed?: boolean;
      ascendConfirmed?: boolean;
      reversalConfirmedAfterDescend?: boolean;
      recoveryConfirmedAfterReversal?: boolean;
      minimumCycleDurationSatisfied?: boolean;
      captureArmingSatisfied?: boolean;
      /** PR-CAM-29A: final pass 타이밍만 차단( completion truth 와 분리 ) */
      finalPassTimingBlockedReason?: string | null;
      standardPathBlockedReason?: string | null;
      baselineStandingDepth?: number;
      rawDepthPeak?: number;
      relativeDepthPeak?: number;
      ultraLowRomPathDisabledOrGuarded?: boolean;
      /** PR evidence: completion과 분리된 evidence layer */
      squatEvidenceLevel?: string;
      squatEvidenceReasons?: string[];
      cycleProofPassed?: boolean;
      romBand?: string;
      confidenceDowngradeReason?: string | null;
      insufficientSignalReason?: string | null;
      /** PR failure-freeze: overlay arming — attempt evidence 기반 */
      failureOverlayArmed?: boolean;
      failureOverlayBlockedReason?: string | null;
      attemptStarted?: boolean;
      downwardCommitmentReached?: boolean;
      evidenceLabel?: string;
      completionBlockedReason?: string | null;
      /** PR shallow: guardrail partial 시 이유 */
      guardrailPartialReason?: string;
      /** PR shallow: guardrail complete 시 경로 */
      guardrailCompletePath?: string;
      /** PR shallow: low-ROM recovery 미확인 이유 */
      lowRomRejectionReason?: string | null;
      /** PR shallow: ultra-low-ROM recovery 미확인 이유 */
      ultraLowRomRejectionReason?: string | null;
      /** PR-COMP-01 */
      completionMachinePhase?: string;
      completionPassReason?: string;
      /** PR-04D1: completion pass vs capture-quality 경고 분리(스쿼트 전용) */
      completionTruthPassed?: boolean;
      lowQualityPassAllowed?: boolean;
      passOwner?: string;
      /** PR-CAM-OWNER-FREEZE-01: success 스냅샷에서 final vs shadow event 밴드 분리 */
      finalSuccessOwner?: string;
      standardOwnerEligible?: boolean;
      shadowEventOwnerEligible?: boolean;
      ownerFreezeVersion?: string;
      /** PR-01: completion truth owner vs UI progression gate */
      completionOwnerPassed?: boolean;
      completionOwnerReason?: string | null;
      completionOwnerBlockedReason?: string | null;
      uiProgressionAllowed?: boolean;
      uiProgressionBlockedReason?: string | null;
      /** Setup false-pass lock — squatCycleDebug 미러 */
      liveReadinessSummaryState?: string;
      readinessStableDwellSatisfied?: boolean;
      setupMotionBlocked?: boolean;
      setupMotionBlockReason?: string | null;
      attemptStartedAfterReady?: boolean;
      successSuppressedBySetupPhase?: boolean;
      qualityOnlyWarnings?: string[];
      /** PR-04E1: depth/arming 입력 trace */
      armingDepthSource?: string | null;
      armingDepthPeak?: number | null;
      squatDepthPeakPrimary?: number | null;
      squatDepthPeakBlended?: number | null;
      armingDepthBlendAssisted?: boolean;
      armingFallbackUsed?: boolean;
      /** PR-04E2: 역전 확인 관측 */
      reversalConfirmedBy?: string | null;
      reversalDepthDrop?: number | null;
      reversalFrameCount?: number | null;
      /** PR-04E3A: relative depth truth */
      relativeDepthPeakSource?: string | null;
      rawDepthPeakPrimary?: number | null;
      rawDepthPeakBlended?: number | null;
      /** PR-CAM-29: shallow depth source stabilization — compact 스칼라만 */
      squatDepthObsFallbackPeak?: number | null;
      squatDepthObsTravelPeak?: number | null;
      squatDepthBlendOfferedCount?: number;
      squatDepthBlendCapHitCount?: number;
      squatDepthBlendActiveFrameCount?: number;
      squatDepthSourceFlipCount?: number;
      /** PR-04E3B: shallow event-cycle owner 관측 */
      baselineFrozen?: boolean;
      baselineFrozenDepth?: number | null;
      peakLatched?: boolean;
      peakLatchedAtIndex?: number | null;
      /** PR-CAM-PEAK-ANCHOR-INTEGRITY-02 */
      peakAnchorTruth?: 'committed_or_post_commit_peak';
      eventCycleDetected?: boolean;
      eventCycleBand?: string | null;
      eventCyclePromoted?: boolean;
      eventCycleSource?: string | null;
      /** PR-CAM-CORE: completion-state trajectory descent 폴백 truth */
      eventBasedDescentPath?: boolean;
      /**
       * PR-02 Assist lock: completion-state 정본 — assist / promoted finalize / reversal provenance.
       * pass owner·PR-01 lineage 와 혼동 금지.
       */
      completionFinalizeMode?: string | null;
      completionAssistApplied?: boolean;
      completionAssistSources?: string[];
      completionAssistMode?: string | null;
      promotionBaseRuleBlockedReason?: string | null;
      reversalEvidenceProvenance?: string | null;
      trajectoryReversalRescueApplied?: boolean;
      /** squatCompletionState.reversalTailBackfillApplied (squatCycleDebug 미러 없음) */
      reversalTailBackfillApplied?: boolean;
      /** PR-03: 공식 shallow / ultra-low completion path 관측 */
      officialShallowPathCandidate?: boolean;
      officialShallowPathAdmitted?: boolean;
      officialShallowPathClosed?: boolean;
      officialShallowPathReason?: string | null;
      officialShallowPathBlockedReason?: string | null;
      /** PR-03: event 승격이 아닌 공식 cycle 로 닫힘 여부( pass reason 기준 ) */
      closedAsOfficialRomCycle?: boolean;
      /** PR-03: residue event_cycle 라벨로 닫힘(현재는 승격도 cycle 로 통일되어 주로 false) */
      closedAsEventRescuePassReason?: boolean;
      /** PR-03 rework: shallow 전용 completion-stream reversal 브리지·등가 상승·closure 증거 번들 */
      officialShallowStreamBridgeApplied?: boolean;
      officialShallowAscentEquivalentSatisfied?: boolean;
      officialShallowClosureProofSatisfied?: boolean;
      /** PR-03 shallow closure final: primary-stream 폴백으로 shallow 번들만 성립(관측) */
      officialShallowPrimaryDropClosureFallback?: boolean;
      /** PR-03 final: shallow closure 축 — 역전 truth */
      officialShallowReversalSatisfied?: boolean;
      /** PR-03 final: 관측 전용 — shallow 입장 후 버퍼 깊어져 standard_cycle 로만 닫힌 잔여 */
      officialShallowDriftedToStandard?: boolean;
      officialShallowDriftReason?: string | null;
      officialShallowPreferredPrefixFrameCount?: number | null;
      /** PR-CAM-OBS-NORMALIZE-01: 표면 혼선 방지용 해석 라벨(값·산식 변경 아님) */
      displayDepthTruth?: 'evaluator_peak_metric';
      ownerDepthTruth?: 'completion_relative_depth';
      cycleDecisionTruth?: 'completion_state';
      /** PR-COMP-03 */
      squatInternalQuality?: SquatInternalQuality;
      /** PR-CAM-SQUAT-RESULT-SEVERITY-01: pass truth + quality truth 기반 해석(판정 변경 없음) */
      passSeverity?: SquatPassSeverity;
      resultInterpretation?: SquatResultInterpretation;
      qualityWarningCount?: number;
      limitationCount?: number;
      /** CAM-shallow-obs: attempt-evidence보다 약한 관측 계약(저장·진단 전용) */
      shallowObservationEligible?: boolean;
      /** PR-HMM-03A: 컴팩트 calibration (짧은 키) */
      calib?: {
        rb: string | null;
        fb: string | null;
        ae: boolean;
        aa: boolean;
        asbf: boolean;
        ar: string | null;
        fr: string | null;
        fbnd: string | null;
        hc: number;
        he: number;
        hcnts: { s: number; d: number; b: number; a: number };
        htc: number;
      };
    };
    /** overhead — PR-C4 trace, PR overhead-dwell */
    overhead?: {
      peakElevation?: number;
      peakCount?: number;
      holdDurationMs?: number;
      holdAccumulationMs?: number;
      holdTooShort: boolean;
      topReachDetected: boolean;
      upwardMotionDetected: boolean;
      topDetectedAtMs?: number;
      topEntryAtMs?: number;
      stableTopEntryAtMs?: number;
      holdArmedAtMs?: number;
      holdAccumulationStartedAtMs?: number;
      holdSatisfiedAtMs?: number;
      holdArmingBlockedReason?: string | null;
      holdRemainingMsAtCue?: number;
      holdCuePlayed?: boolean;
      holdCueSuppressedReason?: string | null;
      successEligibleAtMs?: number;
      successTriggeredAtMs?: number;
      successBlockedReason?: string;
      /** PR overhead-dwell: dwell vs legacy span 비교용 */
      holdDurationMsLegacySpan?: number;
      dwellHoldDurationMs?: number;
      legacyHoldDurationMs?: number;
      stableTopEnteredAtMs?: number;
      stableTopExitedAtMs?: number;
      stableTopDwellMs?: number;
      stableTopSegmentCount?: number;
      holdComputationMode?: string;
      /** PR-COMP-04 */
      completionMachinePhase?: string;
      completionBlockedReason?: string | null;
      overheadInternalQuality?: OverheadInternalQuality;
    };
    /** cue */
    cue?: {
      chosenCueKey: string | null;
      chosenClipKey: string | null;
      suppressedReason: string | null;
      liveCueingEnabled: boolean;
    };
  };
  debugVersion: string;
}

/** CAM-27: 스쿼트 사전 관측(통과/재시도/최종 스냅샷과 분리). landmark·프레임 배열·blob 없음. */
export type SquatObservationEventType =
  | 'pre_attempt_candidate'
  | 'attempt_started'
  | 'downward_commitment_reached'
  | 'descent_detected'
  | 'reversal_detected'
  | 'recovery_detected'
  | 'attempt_stalled'
  | 'attempt_abandoned'
  | 'evidence_label_changed'
  | 'completion_blocked_changed'
  | 'standard_path_blocked_changed'
  | 'relative_depth_bucket_changed'
  /** 얕은 동작 계약 충족 시 1회(세션당 엣지) */
  | 'shallow_observed'
  /** 캡처 세션 종료(retry/fail/insufficient 등) 시 1회 */
  | 'capture_session_terminal';

/** PR-CAM-OBS-TRUTH-STAGE-01: 관측 JSON에서 completionBlockedReason 해석 단계 */
export type ObservationTruthStage = 'pre_attempt_hint' | 'attempt_truth' | 'terminal_truth';

export interface SquatAttemptObservation {
  traceKind: 'attempt_observation';
  id: string;
  ts: string;
  movementType: 'squat';
  eventType: SquatObservationEventType;
  captureQuality: CaptureQuality;
  confidence: number;
  phaseHint?: string;
  attemptStarted?: boolean;
  downwardCommitmentReached?: boolean;
  descendConfirmed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  evidenceLabel?: string;
  completionBlockedReason?: string | null;
  standardPathBlockedReason?: string | null;
  relativeDepthPeak?: number;
  rawDepthPeak?: number;
  currentDepth?: number;
  relativeDepthPeakBucket?: string | null;
  shallowCandidateObserved?: boolean;
  attemptLikeMotionObserved?: boolean;
  shallowCandidateReasons?: string[];
  attemptLikeReasons?: string[];
  flags?: string[];
  topReasons?: string[];
  priorEvidenceLabel?: string;
  priorCompletionBlockedReason?: string | null;
  priorStandardPathBlockedReason?: string | null;
  priorRelativeDepthPeakBucket?: string | null;
  /** capture_session_terminal 전용 */
  captureTerminalKind?: string | null;
  progressionStateSnapshot?: string;
  gateStatusSnapshot?: string;
  completionMachinePhase?: string | null;
  baselineStandingDepth?: number;
  motionDescendDetected?: boolean;
  motionBottomDetected?: boolean;
  motionRecoveryDetected?: boolean;
  /** 기록 시점 hasShallowSquatObservation(gate) */
  shallowObservationContract?: boolean;
  /** PR-04E3B: blocked reason 전환 시점 canonical cycle owner 추적 */
  baselineFrozen?: boolean;
  peakLatched?: boolean;
  eventCycleDetected?: boolean;
  eventCyclePromoted?: boolean;
  /**
   * PR-CAM-OBS-TRUTH-STAGE-01: completionBlockedReason이 completion truth인지 vs motion hint 단계인지 구분.
   * 값·판정 로직 변경 없음 — 해석용 메타만 추가.
   */
  observationTruthStage?: ObservationTruthStage;
  completionBlockedReasonAuthoritative?: boolean;
  /** PR-02: completion-state assist provenance(관측 JSON) */
  completionFinalizeMode?: string | null;
  completionAssistApplied?: boolean;
  completionAssistSources?: string[];
  completionAssistMode?: string | null;
  ruleCompletionBlockedReasonObs?: string | null;
  postAssistCompletionBlockedReasonObs?: string | null;
  promotionBaseRuleBlockedReason?: string | null;
  reversalEvidenceProvenance?: string | null;
  trajectoryReversalRescueApplied?: boolean;
  reversalTailBackfillAppliedObs?: boolean;
  /** PR-03 */
  officialShallowPathCandidate?: boolean;
  officialShallowPathAdmitted?: boolean;
  officialShallowPathClosed?: boolean;
  officialShallowPathReason?: string | null;
  officialShallowPathBlockedReason?: string | null;
  /** PR-03 rework: completionState.officialShallowPathClosed 와 동기 */
  closedAsOfficialRomCycle?: boolean;
  closedAsEventRescuePassReason?: boolean;
  officialShallowStreamBridgeApplied?: boolean;
  officialShallowAscentEquivalentSatisfied?: boolean;
  officialShallowClosureProofSatisfied?: boolean;
  officialShallowPrimaryDropClosureFallback?: boolean;
  officialShallowReversalSatisfied?: boolean;
  officialShallowDriftedToStandard?: boolean;
  officialShallowDriftReason?: string | null;
  officialShallowPreferredPrefixFrameCount?: number | null;
  /** Setup false-pass lock — diagnosis 미러 */
  liveReadinessSummaryState?: string;
  readinessStableDwellSatisfied?: boolean;
  setupMotionBlocked?: boolean;
  setupMotionBlockReason?: string | null;
  attemptStartedAfterReady?: boolean;
  successSuppressedBySetupPhase?: boolean;
  debugVersion: string;
}

/**
 * PR-CAM-OBS-TRUTH-STAGE-01: completionBlockedReason 권위 여부·관측 단계(판정 산식·blocked 문자열 불변).
 * terminal 이벤트는 observationTruthStage만 terminal_truth로 덮어쓴다.
 */
export function computeObservationTruthFields(args: {
  eventType: SquatObservationEventType;
  attemptStarted: boolean;
  baselineFrozen?: boolean;
}): { observationTruthStage: ObservationTruthStage; completionBlockedReasonAuthoritative: boolean } {
  const attemptStarted = args.attemptStarted === true;
  const baselineFrozen = args.baselineFrozen === true;

  let observationTruthStage: ObservationTruthStage;
  if (args.eventType === 'capture_session_terminal') {
    observationTruthStage = 'terminal_truth';
  } else if (!attemptStarted) {
    observationTruthStage = 'pre_attempt_hint';
  } else if (!baselineFrozen) {
    observationTruthStage = 'pre_attempt_hint';
  } else {
    observationTruthStage = 'attempt_truth';
  }

  return {
    observationTruthStage,
    completionBlockedReasonAuthoritative: attemptStarted && baselineFrozen,
  };
}

const TRACE_STORAGE_KEY = 'moveReCameraTrace:v1';
const OBSERVATION_STORAGE_KEY = 'moveReCameraSquatObservation:v1';

/** PR-CAM-OBS-FLUSH-HARDEN-01: LS 실패/레이스 시에도 terminal bundle이 비지 않도록 보조(LS가 정본) */
let lastKnownSquatObservationsCache: SquatAttemptObservation[] = [];

/** 브라우저·Node 스모크 공통 — `window` 없이 globalThis.localStorage만 있는 환경 지원 */
function getObservationStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') return ls;
  } catch {
    /* ignore */
  }
  return null;
}
const MAX_ATTEMPTS = 50;
const MAX_SQUAT_OBSERVATIONS = 80;
const DEBUG_VERSION = 'pr4-2';
const OBS_DEBUG_VERSION = 'cam27-obs-1';

/** 관측 전용: 얕은 후보 depth 구간 버킷(임계 통과와 무관). */
export function relativeDepthPeakBucket(relativeDepthPeak: number | undefined | null): string | null {
  if (relativeDepthPeak == null || Number.isNaN(relativeDepthPeak)) return null;
  if (relativeDepthPeak < 0.02) return 'lt_0.02';
  if (relativeDepthPeak < 0.04) return '0.02_0.04';
  if (relativeDepthPeak < 0.07) return '0.04_0.07';
  if (relativeDepthPeak < 0.1) return '0.07_0.10';
  return 'ge_0.10';
}

function readHighlighted(gate: ExerciseGateResult): Record<string, unknown> | undefined {
  return gate.evaluatorResult?.debug?.highlightedMetrics as Record<string, unknown> | undefined;
}

/**
 * 통과/재시도 판정과 분리된 얕은 움직임 관측 신호(디버그·트레이스 전용).
 * — shallowCandidate: 초기 얕은 움직임 후보
 * — attemptLike: 하강 확정·attempt 플래그 등 더 강한 시도 흔적
 */
export function deriveSquatObservabilitySignals(gate: ExerciseGateResult): {
  shallowCandidateObserved: boolean;
  attemptLikeMotionObserved: boolean;
  shallowCandidateReasons: string[];
  attemptLikeReasons: string[];
} {
  const sc = gate.squatCycleDebug;
  const hm = readHighlighted(gate);
  const relPeak = typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined;
  const globalDepthPeak =
    typeof hm?.globalDepthPeak === 'number' ? hm.globalDepthPeak : undefined;
  const descentCount = typeof hm?.descentCount === 'number' ? hm.descentCount : 0;
  const shallowReasons: string[] = [];
  const attemptReasons: string[] = [];

  const SHALLOW_FLOOR = 0.02;
  const SHALLOW_CEIL = 0.14;
  /**
   * 관측 전용: completion 슬라이스 relativePeak가 낮아도 전역 depth 피크와 하강/무장 신호가 있으면 얕은 후보 허용.
   * - descentCount: phaseHint descent 다수
   * - descendDetected: squatCycleDebug( phase !== idle 등 ) — 미완 시퀀스에서 relPeak만으로 누락 방지
   * standing-only는 보통 미무장·descendDetected false → 여기 걸리지 않음.
   */
  const relBelowSlice = relPeak == null || relPeak < SHALLOW_FLOOR;
  /** evaluator highlighted: `depthPeak` = round(max squatDepthProxy * 100) */
  const depthPeakPct = typeof hm?.depthPeak === 'number' ? hm.depthPeak : null;
  const completionArmingArmed =
    hm?.effectiveArmed === 1 || hm?.completionArmingArmed === 1;
  const quietEvaluatorShallow =
    (relPeak != null && relPeak >= SHALLOW_FLOOR) ||
    (globalDepthPeak != null &&
      globalDepthPeak >= SHALLOW_FLOOR &&
      descentCount > 0 &&
      relBelowSlice) ||
    (globalDepthPeak != null &&
      globalDepthPeak >= SHALLOW_FLOOR &&
      sc?.descendDetected === true &&
      relBelowSlice) ||
    // 슬라이스 relative는 0이어도 전역 피크·무장·최대%가 얕은 밴드면 관측 허용(통과와 무관)
    (globalDepthPeak != null &&
      globalDepthPeak >= SHALLOW_FLOOR &&
      completionArmingArmed &&
      depthPeakPct != null &&
      depthPeakPct >= SHALLOW_FLOOR * 100 &&
      relBelowSlice);
  if (relPeak != null && relPeak >= SHALLOW_FLOOR && relPeak < SHALLOW_CEIL) {
    shallowReasons.push('relative_depth_shallow_band');
  }
  if (sc?.depthBand === 'shallow' && quietEvaluatorShallow) shallowReasons.push('depth_band_shallow');
  if (sc?.descendDetected && quietEvaluatorShallow) shallowReasons.push('descend_detected_flag');
  const phase = sc?.currentSquatPhase ?? (hm?.currentSquatPhase as string | undefined);
  if (
    (phase === 'descending' || phase === 'committed_bottom_or_downward_commitment') &&
    quietEvaluatorShallow
  ) {
    shallowReasons.push('phase_descent_related');
  }
  if (descentCount > 0 && (quietEvaluatorShallow || descentCount >= 2)) {
    shallowReasons.push('descent_count_positive');
  }
  const commitDelta = typeof hm?.downwardCommitmentDelta === 'number' ? hm.downwardCommitmentDelta : 0;
  if (commitDelta >= 0.012 && quietEvaluatorShallow) shallowReasons.push('downward_commitment_delta');

  if (
    sc?.descendDetected &&
    sc?.recoveryDetected &&
    (quietEvaluatorShallow || descentCount >= 2 || (typeof hm?.firstDescentIdx === 'number' && hm.firstDescentIdx >= 0))
  ) {
    shallowReasons.push('descend_and_recovery_cycle');
  }

  if (sc?.attemptStarted === true || hm?.attemptStarted === true) attemptReasons.push('attempt_started_flag');
  if (sc?.descendConfirmed === true || hm?.descendConfirmed === true) attemptReasons.push('descend_confirmed');
  if (descentCount >= 2) attemptReasons.push('descent_count_2plus');
  if (relPeak != null && relPeak >= 0.035) attemptReasons.push('relative_depth_ge_0.035');

  return {
    shallowCandidateObserved: shallowReasons.length > 0,
    attemptLikeMotionObserved: attemptReasons.length > 0,
    shallowCandidateReasons: shallowReasons.slice(0, 8),
    attemptLikeReasons: attemptReasons.slice(0, 8),
  };
}

/** 페이지 관측 엣지용 — 통과 로직과 동일한 산식을 쓰지 않고 “관측 가능한 하향 확약” 근사만 표시 */
export function squatDownwardCommitmentReachedObservable(gate: ExerciseGateResult): boolean {
  const sc = gate.squatCycleDebug;
  const hm = readHighlighted(gate);
  if (sc?.reversalConfirmedAfterDescend) return true;
  if (sc?.downwardCommitmentAtMs != null && sc.downwardCommitmentAtMs > 0) return true;
  const d = typeof hm?.downwardCommitmentDelta === 'number' ? hm.downwardCommitmentDelta : 0;
  return d >= 0.02;
}

/**
 * 현재 gate 스냅샷으로 compact observation 레코드 생성(squat 단계만).
 */
export function buildSquatAttemptObservation(
  gate: ExerciseGateResult,
  eventType: SquatObservationEventType,
  options?: {
    priorEvidenceLabel?: string;
    priorCompletionBlockedReason?: string | null;
    priorStandardPathBlockedReason?: string | null;
    priorRelativeDepthPeakBucket?: string | null;
    captureTerminalKind?: string | null;
    shallowObservationContract?: boolean;
  }
): SquatAttemptObservation | null {
  if (gate.evaluatorResult?.stepId !== 'squat') return null;

  const sc = gate.squatCycleDebug;
  const cs = gate.evaluatorResult?.debug?.squatCompletionState;
  const hm = readHighlighted(gate);
  const signals = deriveSquatObservabilitySignals(gate);
  const relPeak = typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined;
  const rawPeak = typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : undefined;
  const depthPeakMetric = gate.evaluatorResult?.metrics?.find((m) => m.name === 'depth')?.value;
  const currentDepth =
    typeof depthPeakMetric === 'number'
      ? depthPeakMetric
      : typeof hm?.depthPeak === 'number'
        ? hm.depthPeak
        : undefined;

  const evidenceLabel =
    (sc?.evidenceLabel as string | undefined) ?? (hm?.evidenceLabel as string | undefined);
  const completionBlocked =
    sc?.completionBlockedReason ?? (hm?.completionBlockedReason as string | null | undefined) ?? null;
  const standardBlocked = sc?.standardPathBlockedReason ?? null;
  const phaseHint =
    (sc?.currentSquatPhase as string | undefined) ?? (hm?.currentSquatPhase as string | undefined);
  const completionMachinePhase =
    (typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : null) ??
    (typeof sc?.completionMachinePhase === 'string' ? sc.completionMachinePhase : null);
  const baselineStandingDepth =
    typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : undefined;
  const shallowContract =
    options?.shallowObservationContract ?? hasShallowSquatObservation(gate);

  const attemptStartedBool = !!(sc?.attemptStarted ?? hm?.attemptStarted);
  const baselineFrozenBool = gate.evaluatorResult?.debug?.squatCompletionState?.baselineFrozen === true;
  const truthMeta = computeObservationTruthFields({
    eventType,
    attemptStarted: attemptStartedBool,
    baselineFrozen: baselineFrozenBool,
  });

  return {
    traceKind: 'attempt_observation',
    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    movementType: 'squat',
    eventType,
    captureQuality: gate.guardrail.captureQuality,
    confidence: gate.confidence,
    phaseHint,
    attemptStarted: attemptStartedBool,
    downwardCommitmentReached: squatDownwardCommitmentReachedObservable(gate),
    descendConfirmed: !!(sc?.descendConfirmed ?? hm?.descendConfirmed),
    reversalConfirmedAfterDescend: !!sc?.reversalConfirmedAfterDescend,
    recoveryConfirmedAfterReversal: !!sc?.recoveryConfirmedAfterReversal,
    evidenceLabel,
    completionBlockedReason: completionBlocked,
    standardPathBlockedReason: standardBlocked,
    relativeDepthPeak: relPeak,
    rawDepthPeak: rawPeak,
    currentDepth,
    relativeDepthPeakBucket: relativeDepthPeakBucket(relPeak ?? null),
    shallowCandidateObserved: signals.shallowCandidateObserved,
    attemptLikeMotionObserved: signals.attemptLikeMotionObserved,
    shallowCandidateReasons: signals.shallowCandidateReasons,
    attemptLikeReasons: signals.attemptLikeReasons,
    flags: [...(gate.flags ?? []), ...(gate.guardrail.flags ?? [])].filter(
      (f, i, arr) => f && arr.indexOf(f) === i
    ) as string[],
    topReasons: buildTopReasons(gate).slice(0, 8),
    priorEvidenceLabel: options?.priorEvidenceLabel,
    priorCompletionBlockedReason: options?.priorCompletionBlockedReason,
    priorStandardPathBlockedReason: options?.priorStandardPathBlockedReason,
    priorRelativeDepthPeakBucket: options?.priorRelativeDepthPeakBucket,
    captureTerminalKind: options?.captureTerminalKind ?? null,
    progressionStateSnapshot: gate.progressionState,
    gateStatusSnapshot: gate.status,
    completionMachinePhase,
    baselineStandingDepth,
    motionDescendDetected: !!sc?.descendDetected,
    motionBottomDetected: !!sc?.bottomDetected,
    motionRecoveryDetected: !!sc?.recoveryDetected,
    shallowObservationContract: shallowContract,
    baselineFrozen: gate.evaluatorResult?.debug?.squatCompletionState?.baselineFrozen,
    peakLatched: gate.evaluatorResult?.debug?.squatCompletionState?.peakLatched,
    eventCycleDetected: gate.evaluatorResult?.debug?.squatCompletionState?.squatEventCycle?.detected,
    eventCyclePromoted: gate.evaluatorResult?.debug?.squatCompletionState?.eventCyclePromoted,
    observationTruthStage: truthMeta.observationTruthStage,
    completionBlockedReasonAuthoritative: truthMeta.completionBlockedReasonAuthoritative,
    completionFinalizeMode: cs?.completionFinalizeMode ?? null,
    completionAssistApplied: cs?.completionAssistApplied === true,
    completionAssistSources: cs?.completionAssistSources ?? [],
    completionAssistMode: cs?.completionAssistMode ?? null,
    ruleCompletionBlockedReasonObs: cs?.ruleCompletionBlockedReason ?? null,
    postAssistCompletionBlockedReasonObs: cs?.postAssistCompletionBlockedReason ?? null,
    promotionBaseRuleBlockedReason: cs?.promotionBaseRuleBlockedReason ?? null,
    reversalEvidenceProvenance: cs?.reversalEvidenceProvenance ?? null,
    trajectoryReversalRescueApplied: cs?.trajectoryReversalRescueApplied === true,
    reversalTailBackfillAppliedObs: cs?.reversalTailBackfillApplied === true,
    officialShallowPathCandidate: cs?.officialShallowPathCandidate === true,
    officialShallowPathAdmitted: cs?.officialShallowPathAdmitted === true,
    officialShallowPathClosed: cs?.officialShallowPathClosed === true,
    officialShallowPathReason: cs?.officialShallowPathReason ?? null,
    officialShallowPathBlockedReason: cs?.officialShallowPathBlockedReason ?? null,
    closedAsOfficialRomCycle: cs?.officialShallowPathClosed === true,
    closedAsEventRescuePassReason:
      cs?.completionPassReason === 'low_rom_event_cycle' ||
      cs?.completionPassReason === 'ultra_low_rom_event_cycle',
    officialShallowStreamBridgeApplied: cs?.officialShallowStreamBridgeApplied === true,
    officialShallowAscentEquivalentSatisfied: cs?.officialShallowAscentEquivalentSatisfied === true,
    officialShallowClosureProofSatisfied: cs?.officialShallowClosureProofSatisfied === true,
    officialShallowPrimaryDropClosureFallback: cs?.officialShallowPrimaryDropClosureFallback === true,
    officialShallowReversalSatisfied: cs?.officialShallowReversalSatisfied === true,
    officialShallowDriftedToStandard: cs?.officialShallowDriftedToStandard === true,
    officialShallowDriftReason: cs?.officialShallowDriftReason ?? null,
    officialShallowPreferredPrefixFrameCount:
      typeof cs?.officialShallowPreferredPrefixFrameCount === 'number'
        ? cs.officialShallowPreferredPrefixFrameCount
        : null,
    liveReadinessSummaryState: gate.squatCycleDebug?.liveReadinessSummaryState,
    readinessStableDwellSatisfied: gate.squatCycleDebug?.readinessStableDwellSatisfied,
    setupMotionBlocked: gate.squatCycleDebug?.setupMotionBlocked,
    setupMotionBlockReason: gate.squatCycleDebug?.setupMotionBlockReason ?? null,
    attemptStartedAfterReady: gate.squatCycleDebug?.attemptStartedAfterReady,
    successSuppressedBySetupPhase: gate.squatCycleDebug?.successSuppressedBySetupPhase,
    debugVersion: `${OBS_DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

function observationDedupSkip(list: SquatAttemptObservation[], next: SquatAttemptObservation): boolean {
  if (next.eventType === 'capture_session_terminal' || next.eventType === 'shallow_observed') return false;
  const last = list[list.length - 1];
  if (!last || last.eventType !== next.eventType) return false;
  const prevMs = Date.parse(last.ts);
  if (Number.isNaN(prevMs)) return false;
  return Date.now() - prevMs < 140;
}

/** bounded localStorage — 실패 시 무시 */
export function pushSquatObservation(obs: SquatAttemptObservation): void {
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    const list: SquatAttemptObservation[] = raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
    if (observationDedupSkip(list, obs)) return;
    list.push(obs);
    const trimmed = list.slice(-MAX_SQUAT_OBSERVATIONS);
    lastKnownSquatObservationsCache = trimmed.slice();
    try {
      ls.setItem(OBSERVATION_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* LS 쓰기 실패 — 캐시는 이미 최신 목록 */
    }
  } catch {
    try {
      const list = [...lastKnownSquatObservationsCache];
      if (observationDedupSkip(list, obs)) return;
      list.push(obs);
      lastKnownSquatObservationsCache = list.slice(-MAX_SQUAT_OBSERVATIONS);
    } catch {
      // ignore
    }
  }
}

export function getRecentSquatObservations(): SquatAttemptObservation[] {
  const ls = getObservationStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
  } catch {
    return [];
  }
}

/**
 * Terminal bundle 직전에 호출 — LS 정본 우선, 파싱 실패·비어 있음·쓰기 실패로 캐시가 더 길면 캐시 사용.
 * 산식 변경 없음, 읽기 경로만 명시.
 */
export function getRecentSquatObservationsSnapshot(): SquatAttemptObservation[] {
  let fromLs: SquatAttemptObservation[] = [];
  let readOk = false;
  try {
    const ls = getObservationStorage();
    if (!ls) {
      return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
    }
    const raw = ls.getItem(OBSERVATION_STORAGE_KEY);
    fromLs = raw ? (JSON.parse(raw) as SquatAttemptObservation[]) : [];
    readOk = true;
  } catch {
    fromLs = [];
  }
  if (!readOk) {
    return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
  }
  if (lastKnownSquatObservationsCache.length > fromLs.length) {
    return lastKnownSquatObservationsCache.slice();
  }
  if (fromLs.length > 0) return fromLs;
  return lastKnownSquatObservationsCache.length > 0 ? lastKnownSquatObservationsCache.slice() : [];
}

export function clearSquatObservations(): void {
  lastKnownSquatObservationsCache = [];
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    ls.removeItem(OBSERVATION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 스쿼트 관측 1건 기록(페이지 effect에서 호출). 통과 임계·해석 변경 없음. */
export function recordSquatObservationEvent(
  gate: ExerciseGateResult,
  eventType: SquatObservationEventType,
  options?: Parameters<typeof buildSquatAttemptObservation>[2]
): void {
  try {
    const obs = buildSquatAttemptObservation(gate, eventType, options);
    if (obs) pushSquatObservation(obs);
  } catch {
    // ignore
  }
}

function stepIdToMovementType(stepId: CameraStepId): TraceMovementType | null {
  if (stepId === 'squat') return 'squat';
  if (stepId === 'overhead-reach') return 'overhead_reach';
  return null;
}

function gateToOutcome(gate: ExerciseGateResult): TraceOutcome {
  if (gate.status === 'pass' && gate.progressionState === 'passed') return 'ok';
  if (gate.progressionState === 'failed') return 'failed';
  if (gate.progressionState === 'insufficient_signal') return 'invalid';
  if (gate.progressionState === 'retry_required') return 'retry_required';
  if (gate.status === 'retry' && gate.retryRecommended) return 'retry_optional';
  if (gate.guardrail.captureQuality === 'invalid') return 'invalid';
  if (gate.guardrail.captureQuality === 'low') return 'low';
  return 'retry_optional';
}

function buildTopReasons(gate: ExerciseGateResult): string[] {
  const reasons: string[] = [];
  const fr = gate.failureReasons ?? [];
  const flags = gate.guardrail.flags ?? [];

  for (const r of fr) {
    if (r && !reasons.includes(r)) reasons.push(r);
  }
  for (const f of flags) {
    if (f && !reasons.includes(f)) reasons.push(f);
  }
  if (gate.evaluatorResult?.completionHints?.length) {
    for (const h of gate.evaluatorResult.completionHints) {
      const s = `completion:${h}`;
      if (!reasons.includes(s)) reasons.push(s);
    }
  }
  if (gate.evaluatorResult?.qualityHints?.length) {
    for (const h of gate.evaluatorResult.qualityHints) {
      const s = `quality:${h}`;
      if (!reasons.includes(s)) reasons.push(s);
    }
  }

  return reasons.slice(0, 8);
}

function extractStabilitySummary(gate: ExerciseGateResult): AttemptSnapshot['stabilitySummary'] {
  const d = gate.guardrail.debug;
  if (!d) return undefined;
  return {
    warmupExcludedFrameCount: d.warmupExcludedFrameCount,
    qualityFrameCount: d.qualityFrameCount,
    selectedWindowStartMs: d.selectedWindowStartMs ?? undefined,
    selectedWindowEndMs: d.selectedWindowEndMs ?? undefined,
    selectedWindowScore: d.selectedWindowScore ?? undefined,
  };
}

function extractPerStepSummary(gate: ExerciseGateResult): Record<string, unknown> | undefined {
  const diag = gate.evaluatorResult?.debug?.perStepDiagnostics;
  const guardrailDiag = gate.guardrail.debug?.perStepDiagnostics;
  if (!diag && !guardrailDiag) return undefined;
  return {
    ...(diag ?? {}),
    ...(guardrailDiag ?? {}),
  } as Record<string, unknown>;
}

export interface RecordAttemptOptions {
  liveCueingEnabled?: boolean;
  autoNextObservation?: string;
  /** PR-C4: overhead hold cue 재생 여부 */
  holdCuePlayed?: boolean;
  /** PR-C4: success latch 시점 (ms) */
  successTriggeredAtMs?: number;
}

function buildDiagnosisSummary(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context: AttemptSnapshot['readinessSummary'] | undefined,
  options?: RecordAttemptOptions
): AttemptSnapshot['diagnosisSummary'] {
  const hm = gate.evaluatorResult?.debug?.highlightedMetrics;
  const passLatched = isFinalPassLatched(stepId, gate);

  let cueObs: ReturnType<typeof getCorrectiveCueObservability> = null;
  let playbackObs: ReturnType<typeof getLastPlaybackObservability> = null;
  if (typeof window !== 'undefined') {
    cueObs = getCorrectiveCueObservability();
    playbackObs = getLastPlaybackObservability();
  }

  const base: NonNullable<AttemptSnapshot['diagnosisSummary']> = {
    stepId,
    readinessState: context?.state,
    captureQuality: gate.guardrail.captureQuality,
    completionSatisfied: gate.completionSatisfied,
    passConfirmed: gate.passConfirmationSatisfied,
    passLatched,
    autoNextObservation: options?.autoNextObservation,
    sampledFrameCount: gate.guardrail.debug?.sampledFrameCount,
    cue: {
      chosenCueKey: cueObs?.cueCandidate ?? null,
      chosenClipKey: playbackObs?.clipKey ?? null,
      suppressedReason: cueObs?.suppressedReason ?? null,
      liveCueingEnabled: options?.liveCueingEnabled ?? false,
    },
  };

  if (stepId === 'squat' && gate.squatCycleDebug) {
    const sc = gate.squatCycleDebug;
    const cs = gate.evaluatorResult?.debug?.squatCompletionState;
    const siq = gate.evaluatorResult.debug?.squatInternalQuality;
    const peakDepth =
      typeof hm?.depthPeak === 'number'
        ? hm.depthPeak
        : gate.evaluatorResult?.metrics?.find((m) => m.name === 'depth')?.value;
    base.squatCycle = {
      peakDepth,
      depthBand: sc.depthBand,
      currentSquatPhase: sc.currentSquatPhase,
      descendDetected: sc.descendDetected,
      bottomDetected: sc.bottomDetected,
      recoveryDetected: sc.recoveryDetected,
      startBeforeBottom: sc.startBeforeBottom,
      cycleComplete: sc.cycleComplete,
      passBlockedReason: sc.passBlockedReason,
      completionPathUsed: sc.completionPathUsed,
      completionRejectedReason: sc.completionRejectedReason,
      descendStartAtMs: sc.descendStartAtMs,
      downwardCommitmentAtMs: sc.downwardCommitmentAtMs,
      committedAtMs: sc.committedAtMs,
      reversalAtMs: sc.reversalAtMs,
      ascendStartAtMs: sc.ascendStartAtMs,
      recoveryAtMs: sc.recoveryAtMs,
      standingRecoveredAtMs: sc.standingRecoveredAtMs,
      standingRecoveryHoldMs: sc.standingRecoveryHoldMs,
      successPhaseAtOpen: sc.successPhaseAtOpen,
      cycleDurationMs: sc.cycleDurationMs,
      downwardCommitmentDelta: sc.downwardCommitmentDelta,
      ultraLowRomCandidate: sc.ultraLowRomCandidate,
      ultraLowRomGuardPassed: sc.ultraLowRomGuardPassed,
      ultraLowRomRejectReason: sc.ultraLowRomRejectReason,
      standingStillRejected: sc.standingStillRejected,
      falsePositiveBlockReason: sc.falsePositiveBlockReason,
      descendConfirmed: sc.descendConfirmed,
      ascendConfirmed: sc.ascendConfirmed,
      reversalConfirmedAfterDescend: sc.reversalConfirmedAfterDescend,
      recoveryConfirmedAfterReversal: sc.recoveryConfirmedAfterReversal,
      minimumCycleDurationSatisfied: sc.minimumCycleDurationSatisfied,
      captureArmingSatisfied: sc.captureArmingSatisfied,
      finalPassTimingBlockedReason: sc.finalPassTimingBlockedReason ?? null,
      standardPathBlockedReason: sc.standardPathBlockedReason,
      baselineStandingDepth: typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : undefined,
      rawDepthPeak: typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : undefined,
      relativeDepthPeak: typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined,
      failureOverlayArmed: hasSquatAttemptEvidence(gate),
      failureOverlayBlockedReason: hasSquatAttemptEvidence(gate)
        ? null
        : hasShallowSquatObservation(gate)
          ? 'no_attempt_evidence_shallow_observed'
          : 'no_attempt_evidence',
      shallowObservationEligible: hasShallowSquatObservation(gate),
      attemptStarted: sc.attemptStarted ?? ((sc.descendConfirmed ?? false) || (hm?.descentCount as number) > 0),
      downwardCommitmentReached:
        (sc.reversalConfirmedAfterDescend ?? false) ||
        ((hm?.downwardCommitmentDelta as number) ?? 0) >= 0.02,
      evidenceLabel: sc.evidenceLabel,
      completionBlockedReason: sc.completionBlockedReason,
      ultraLowRomPathDisabledOrGuarded: sc.ultraLowRomPathDisabledOrGuarded,
      squatEvidenceLevel: sc.squatEvidenceLevel,
      squatEvidenceReasons: sc.squatEvidenceReasons,
      cycleProofPassed: sc.cycleProofPassed,
      romBand: sc.romBand,
      confidenceDowngradeReason: sc.confidenceDowngradeReason,
      insufficientSignalReason: sc.insufficientSignalReason,
      guardrailPartialReason: sc.guardrailPartialReason,
      guardrailCompletePath: sc.guardrailCompletePath,
      lowRomRejectionReason: sc.lowRomRejectionReason,
      ultraLowRomRejectionReason: sc.ultraLowRomRejectionReason,
      completionMachinePhase: sc.completionMachinePhase,
      completionPassReason: sc.completionPassReason,
      completionTruthPassed: sc.completionTruthPassed,
      lowQualityPassAllowed: sc.lowQualityPassAllowed,
      passOwner: sc.passOwner,
      finalSuccessOwner: sc.finalSuccessOwner,
      standardOwnerEligible: sc.standardOwnerEligible,
      shadowEventOwnerEligible: sc.shadowEventOwnerEligible,
      ownerFreezeVersion: sc.ownerFreezeVersion,
      completionOwnerPassed: sc.completionOwnerPassed,
      completionOwnerReason: sc.completionOwnerReason ?? null,
      completionOwnerBlockedReason: sc.completionOwnerBlockedReason ?? null,
      uiProgressionAllowed: sc.uiProgressionAllowed,
      uiProgressionBlockedReason: sc.uiProgressionBlockedReason ?? null,
      liveReadinessSummaryState: sc.liveReadinessSummaryState,
      readinessStableDwellSatisfied: sc.readinessStableDwellSatisfied,
      setupMotionBlocked: sc.setupMotionBlocked,
      setupMotionBlockReason: sc.setupMotionBlockReason ?? null,
      attemptStartedAfterReady: sc.attemptStartedAfterReady,
      successSuppressedBySetupPhase: sc.successSuppressedBySetupPhase,
      qualityOnlyWarnings: sc.qualityOnlyWarnings,
      armingDepthSource: sc.armingDepthSource,
      armingDepthPeak: sc.armingDepthPeak,
      squatDepthPeakPrimary: sc.squatDepthPeakPrimary,
      squatDepthPeakBlended: sc.squatDepthPeakBlended,
      armingDepthBlendAssisted: sc.armingDepthBlendAssisted,
      armingFallbackUsed: sc.armingFallbackUsed,
      reversalConfirmedBy: sc.reversalConfirmedBy ?? null,
      reversalDepthDrop: sc.reversalDepthDrop ?? null,
      reversalFrameCount: sc.reversalFrameCount ?? null,
      relativeDepthPeakSource: sc.relativeDepthPeakSource ?? null,
      rawDepthPeakPrimary:
        typeof sc.rawDepthPeakPrimary === 'number' ? sc.rawDepthPeakPrimary : null,
      rawDepthPeakBlended:
        typeof sc.rawDepthPeakBlended === 'number' ? sc.rawDepthPeakBlended : null,
      squatDepthObsFallbackPeak:
        typeof hm?.squatDepthObsFallbackPeak === 'number' ? hm.squatDepthObsFallbackPeak : null,
      squatDepthObsTravelPeak:
        typeof hm?.squatDepthObsTravelPeak === 'number' ? hm.squatDepthObsTravelPeak : null,
      squatDepthBlendOfferedCount:
        typeof hm?.squatDepthBlendOfferedCount === 'number' ? hm.squatDepthBlendOfferedCount : undefined,
      squatDepthBlendCapHitCount:
        typeof hm?.squatDepthBlendCapHitCount === 'number' ? hm.squatDepthBlendCapHitCount : undefined,
      squatDepthBlendActiveFrameCount:
        typeof hm?.squatDepthBlendActiveFrameCount === 'number'
          ? hm.squatDepthBlendActiveFrameCount
          : undefined,
      squatDepthSourceFlipCount:
        typeof hm?.squatDepthSourceFlipCount === 'number' ? hm.squatDepthSourceFlipCount : undefined,
      baselineFrozen: sc.baselineFrozen,
      baselineFrozenDepth: sc.baselineFrozenDepth ?? null,
      peakLatched: sc.peakLatched,
      peakLatchedAtIndex: sc.peakLatchedAtIndex ?? null,
      peakAnchorTruth: sc.peakAnchorTruth,
      eventCycleDetected: sc.eventCycleDetected,
      eventCycleBand: sc.eventCycleBand ?? null,
      eventCyclePromoted: sc.eventCyclePromoted,
      eventCycleSource: sc.eventCycleSource ?? null,
      eventBasedDescentPath: sc.eventBasedDescentPath,
      completionFinalizeMode: cs?.completionFinalizeMode ?? null,
      completionAssistApplied: cs?.completionAssistApplied === true,
      completionAssistSources: (cs?.completionAssistSources ?? []) as string[],
      completionAssistMode: cs?.completionAssistMode ?? null,
      promotionBaseRuleBlockedReason: cs?.promotionBaseRuleBlockedReason ?? null,
      reversalEvidenceProvenance: cs?.reversalEvidenceProvenance ?? null,
      trajectoryReversalRescueApplied: cs?.trajectoryReversalRescueApplied === true,
      reversalTailBackfillApplied: cs?.reversalTailBackfillApplied === true,
      officialShallowPathCandidate: cs?.officialShallowPathCandidate === true,
      officialShallowPathAdmitted: cs?.officialShallowPathAdmitted === true,
      officialShallowPathClosed: cs?.officialShallowPathClosed === true,
      officialShallowPathReason: cs?.officialShallowPathReason ?? null,
      officialShallowPathBlockedReason: cs?.officialShallowPathBlockedReason ?? null,
      closedAsOfficialRomCycle: cs?.officialShallowPathClosed === true,
      closedAsEventRescuePassReason:
        cs?.completionPassReason === 'low_rom_event_cycle' ||
        cs?.completionPassReason === 'ultra_low_rom_event_cycle',
      officialShallowStreamBridgeApplied: cs?.officialShallowStreamBridgeApplied === true,
      officialShallowAscentEquivalentSatisfied: cs?.officialShallowAscentEquivalentSatisfied === true,
      officialShallowClosureProofSatisfied: cs?.officialShallowClosureProofSatisfied === true,
      officialShallowPrimaryDropClosureFallback: cs?.officialShallowPrimaryDropClosureFallback === true,
      officialShallowReversalSatisfied: cs?.officialShallowReversalSatisfied === true,
      officialShallowDriftedToStandard: cs?.officialShallowDriftedToStandard === true,
      officialShallowDriftReason: cs?.officialShallowDriftReason ?? null,
      officialShallowPreferredPrefixFrameCount:
        typeof cs?.officialShallowPreferredPrefixFrameCount === 'number'
          ? cs.officialShallowPreferredPrefixFrameCount
          : null,
      displayDepthTruth: 'evaluator_peak_metric',
      ownerDepthTruth: 'completion_relative_depth',
      cycleDecisionTruth: 'completion_state',
      squatInternalQuality: siq,
    };

    /** PR-CAM-RESULT-SEVERITY-SURFACE-01: diagnosis `base` = d, squatCycle.squatInternalQuality = 허용 source만 */
    const resultSeverity = buildSquatResultSeveritySummary({
      completionTruthPassed: sc.completionTruthPassed === true,
      captureQuality: String(base.captureQuality ?? ''),
      qualityOnlyWarnings: sc.qualityOnlyWarnings,
      qualityTier: base.squatCycle.squatInternalQuality?.qualityTier ?? null,
      limitations: base.squatCycle.squatInternalQuality?.limitations,
    });
    base.squatCycle.passSeverity = resultSeverity.passSeverity;
    base.squatCycle.resultInterpretation = resultSeverity.resultInterpretation;
    base.squatCycle.qualityWarningCount = resultSeverity.qualityWarningCount;
    base.squatCycle.limitationCount = resultSeverity.limitationCount;

    // PR-HMM-01B: shadow decoder compact summary — snapshot payload 과대화 방지
    const squatHmm = gate.evaluatorResult.debug?.squatHmm;
    if (squatHmm != null && base.squatCycle != null) {
      const squatCycleExt = base.squatCycle as typeof base.squatCycle & {
        hmmShadow?: {
          confidence: number;
          completionCandidate: boolean;
          counts: Record<string, number>;
          excursion: number;
        };
      };
      squatCycleExt.hmmShadow = {
        confidence: squatHmm.confidence,
        completionCandidate: squatHmm.completionCandidate,
        counts: {
          standing: squatHmm.dominantStateCounts.standing,
          descent: squatHmm.dominantStateCounts.descent,
          bottom: squatHmm.dominantStateCounts.bottom,
          ascent: squatHmm.dominantStateCounts.ascent,
        },
        excursion: squatHmm.effectiveExcursion,
      };
    }

    // PR-HMM-03A: calibration compact — HMM + completion state 한 블록
    if (base.squatCycle != null) {
      const squatCycleExt = base.squatCycle as typeof base.squatCycle & {
        calib?: ReturnType<typeof buildSquatCalibrationTraceCompact>;
        arm?: ReturnType<typeof buildSquatArmingAssistTraceCompact>;
        hra?: ReturnType<typeof buildSquatReversalAssistTraceCompact>;
      };
      squatCycleExt.calib = buildSquatCalibrationTraceCompact(
        gate.evaluatorResult.debug?.squatCompletionState,
        gate.evaluatorResult.debug?.squatHmm
      );
      squatCycleExt.arm = buildSquatArmingAssistTraceCompact(
        gate.evaluatorResult.debug?.squatCompletionArming
      );
      const cs = gate.evaluatorResult.debug?.squatCompletionState;
      squatCycleExt.hra = buildSquatReversalAssistTraceCompact(
        cs?.hmmReversalAssistEligible,
        cs?.hmmReversalAssistApplied,
        cs?.hmmReversalAssistReason ?? null
      );
    }
  }

  if (stepId === 'overhead-reach') {
    const REQUIRED_HOLD_MS = 1200;
    const raiseCount = typeof hm?.raiseCount === 'number' ? hm.raiseCount : 0;
    const peakCount = typeof hm?.peakCount === 'number' ? hm.peakCount : 0;
    const holdDurationMs = typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0;
    const topDetectedAtMs = typeof hm?.topDetectedAtMs === 'number' ? hm.topDetectedAtMs : undefined;
    const topEntryAtMs = typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined;
    const stableTopEntryAtMs =
      typeof hm?.stableTopEntryAtMs === 'number' ? hm.stableTopEntryAtMs : undefined;
    const holdArmedAtMs = typeof hm?.holdArmedAtMs === 'number' ? hm.holdArmedAtMs : undefined;
    const holdAccumulationStartedAtMs =
      typeof hm?.holdAccumulationStartedAtMs === 'number' ? hm.holdAccumulationStartedAtMs : undefined;
    const holdArmingBlockedReason = hm?.holdArmingBlockedReason ?? undefined;
    const holdAccumulationMs = typeof hm?.holdAccumulationMs === 'number' ? hm.holdAccumulationMs : holdDurationMs;
    const holdSatisfiedAtMs = typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined;
    const peakElevation =
      typeof hm?.peakArmElevation === 'number'
        ? hm.peakArmElevation
        : gate.evaluatorResult?.metrics?.find((m) => m.name === 'arm_range')?.value;
    const holdSatisfied = holdDurationMs >= REQUIRED_HOLD_MS;
    const isHoldCue = cueObs?.cueCandidate === 'correction:hold:overhead-reach';
    const successBlockedReason = passLatched
      ? undefined
      : !gate.completionSatisfied
        ? gate.guardrail.flags?.includes('hold_too_short')
          ? 'hold_too_short'
          : gate.guardrail.flags?.includes('rep_incomplete')
            ? 'rep_incomplete'
            : 'completion_not_satisfied'
        : gate.guardrail.captureQuality === 'invalid'
          ? 'capture_quality_invalid'
          : gate.confidence < 0.72
            ? 'confidence_too_low'
            : !gate.passConfirmationSatisfied
              ? 'pass_confirmation_pending'
              : undefined;
    const holdDurationMsLegacySpan = typeof hm?.holdDurationMsLegacySpan === 'number' ? hm.holdDurationMsLegacySpan : undefined;
    const dwellHoldDurationMs = typeof hm?.dwellHoldDurationMs === 'number' ? hm.dwellHoldDurationMs : holdDurationMs;
    const legacyHoldDurationMs = typeof hm?.legacyHoldDurationMs === 'number' ? hm.legacyHoldDurationMs : holdDurationMsLegacySpan;
    const stableTopEnteredAtMs = typeof hm?.stableTopEnteredAtMs === 'number' ? hm.stableTopEnteredAtMs : undefined;
    const stableTopExitedAtMs = typeof hm?.stableTopExitedAtMs === 'number' ? hm.stableTopExitedAtMs : undefined;
    const stableTopDwellMs = typeof hm?.stableTopDwellMs === 'number' ? hm.stableTopDwellMs : undefined;
    const stableTopSegmentCount = typeof hm?.stableTopSegmentCount === 'number' ? hm.stableTopSegmentCount : undefined;
    const holdComputationMode = typeof hm?.holdComputationMode === 'string' ? hm.holdComputationMode : undefined;

    base.overhead = {
      peakElevation,
      peakCount,
      holdDurationMs,
      holdAccumulationMs,
      holdTooShort: gate.failureReasons?.includes('hold_too_short') ?? false,
      topReachDetected: peakCount > 0,
      upwardMotionDetected: raiseCount > 0,
      topDetectedAtMs,
      topEntryAtMs,
      stableTopEntryAtMs,
      holdArmedAtMs,
      holdAccumulationStartedAtMs,
      holdSatisfiedAtMs:
        holdSatisfiedAtMs ??
        (holdSatisfied && holdArmedAtMs != null ? holdArmedAtMs + REQUIRED_HOLD_MS : undefined),
      holdArmingBlockedReason: holdArmingBlockedReason ?? undefined,
      holdRemainingMsAtCue: REQUIRED_HOLD_MS - holdDurationMs,
      holdCuePlayed: options?.holdCuePlayed,
      holdCueSuppressedReason: isHoldCue ? (cueObs?.suppressedReason ?? null) : undefined,
      successEligibleAtMs: passLatched ? (options?.successTriggeredAtMs ?? Date.now()) : undefined,
      successTriggeredAtMs: options?.successTriggeredAtMs,
      successBlockedReason: successBlockedReason ?? undefined,
      holdDurationMsLegacySpan,
      dwellHoldDurationMs,
      legacyHoldDurationMs,
      stableTopEnteredAtMs,
      holdArmedAtMs,
      stableTopExitedAtMs,
      stableTopDwellMs,
      stableTopSegmentCount,
      holdComputationMode,
      completionMachinePhase:
        typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : undefined,
      completionBlockedReason:
        typeof hm?.completionBlockedReason === 'string' ? hm.completionBlockedReason : undefined,
      overheadInternalQuality: gate.evaluatorResult.debug?.overheadInternalQuality,
    };
  }

  return base;
}

/**
 * gate 결과로부터 compact attempt snapshot 생성
 */
export function buildAttemptSnapshot(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context?: AttemptSnapshot['readinessSummary'],
  options?: RecordAttemptOptions
): AttemptSnapshot | null {
  const movementType = stepIdToMovementType(stepId);
  if (!movementType) return null;

  const outcome = gateToOutcome(gate);
  const finalPassLatched = isFinalPassLatched(stepId, gate);
  const progressionPassed =
    gate.status === 'pass' &&
    gate.completionSatisfied &&
    gate.guardrail.captureQuality !== 'invalid';

  return {
    id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    movementType,
    outcome,
    captureQuality: gate.guardrail.captureQuality,
    confidence: gate.confidence,
    motionCompleteness: gate.guardrail.completionStatus ?? 'unknown',
    progressionPassed,
    finalPassLatched,
    fallbackType: gate.guardrail.fallbackMode,
    flags: [...(gate.flags ?? []), ...(gate.guardrail.flags ?? [])].filter(
      (f, i, arr) => arr.indexOf(f) === i
    ),
    topReasons: buildTopReasons(gate),
    perStepSummary: extractPerStepSummary(gate),
    readinessSummary: context,
    stabilitySummary: extractStabilitySummary(gate),
    diagnosisSummary: buildDiagnosisSummary(stepId, gate, context, options),
    debugVersion: `${DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

/**
 * snapshot을 bounded localStorage에 추가 (non-blocking)
 */
export function pushAttemptSnapshot(snapshot: AttemptSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    const list: AttemptSnapshot[] = raw ? (JSON.parse(raw) as AttemptSnapshot[]) : [];
    list.push(snapshot);
    const trimmed = list.slice(-MAX_ATTEMPTS);
    localStorage.setItem(TRACE_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // trace 실패 시 카메라 플로우는 정상 동작해야 함
  }
}

/**
 * 최근 attempt 목록 조회
 */
export function getRecentAttempts(): AttemptSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRACE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AttemptSnapshot[]) : [];
  } catch {
    return [];
  }
}

/**
 * trace 저장소 초기화
 */
export function clearAttempts(): void {
  lastKnownSquatObservationsCache = [];
  const ls = getObservationStorage();
  if (!ls) return;
  try {
    ls.removeItem(TRACE_STORAGE_KEY);
    ls.removeItem(OBSERVATION_STORAGE_KEY);
    /** PR-CAM-SNAPSHOT-BUNDLE-01: 번들 저장소 — camera-trace-bundle.ts BUNDLE_STORAGE_KEY 와 동일 문자열 */
    ls.removeItem('moveReCameraTraceBundle:v1');
  } catch {
    // ignore
  }
}

/** dogfooding용 quick stats */
export interface TraceQuickStats {
  byMovement: Record<TraceMovementType, number>;
  byOutcome: Record<TraceOutcome, number>;
  topRetryReasons: { reason: string; count: number }[];
  topFlags: { flag: string; count: number }[];
  okLowInvalidByMovement: Record<
    TraceMovementType,
    { ok: number; low: number; invalid: number }
  >;
}

export function getQuickStats(snapshots: AttemptSnapshot[]): TraceQuickStats {
  const byMovement: Record<TraceMovementType, number> = {
    squat: 0,
    overhead_reach: 0,
  };
  const byOutcome: Record<TraceOutcome, number> = {
    ok: 0,
    low: 0,
    invalid: 0,
    retry_required: 0,
    retry_optional: 0,
    failed: 0,
  };
  const reasonCounts: Record<string, number> = {};
  const flagCounts: Record<string, number> = {};
  const okLowInvalidByMovement: Record<
    TraceMovementType,
    { ok: number; low: number; invalid: number }
  > = {
    squat: { ok: 0, low: 0, invalid: 0 },
    overhead_reach: { ok: 0, low: 0, invalid: 0 },
  };

  for (const s of snapshots) {
    byMovement[s.movementType] = (byMovement[s.movementType] ?? 0) + 1;
    byOutcome[s.outcome] = (byOutcome[s.outcome] ?? 0) + 1;

    const dist = okLowInvalidByMovement[s.movementType];
    if (dist) {
      if (s.outcome === 'ok') dist.ok += 1;
      else if (
        s.outcome === 'low' ||
        s.outcome === 'retry_optional' ||
        s.outcome === 'retry_required'
      )
        dist.low += 1;
      else dist.invalid += 1;
    }

    for (const r of s.topReasons ?? []) {
      reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
    }
    for (const f of s.flags ?? []) {
      flagCounts[f] = (flagCounts[f] ?? 0) + 1;
    }
  }

  const topRetryReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const topFlags = Object.entries(flagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  return {
    byMovement,
    byOutcome,
    topRetryReasons,
    topFlags,
    okLowInvalidByMovement,
  };
}

/**
 * gate가 있을 때 snapshot을 생성하고 저장 (non-blocking)
 * 실패해도 예외를 던지지 않음
 */
export function recordAttemptSnapshot(
  stepId: CameraStepId,
  gate: ExerciseGateResult,
  context?: AttemptSnapshot['readinessSummary'],
  options?: RecordAttemptOptions
): void {
  try {
    const snapshot = buildAttemptSnapshot(stepId, gate, context, options);
    if (snapshot) pushAttemptSnapshot(snapshot);
  } catch {
    // trace 실패 시 카메라 플로우는 정상 동작해야 함
  }
}
