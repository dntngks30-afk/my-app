/**
 * PR-4: 카메라 시도 관측용 경량 trace
 * - pass/funnel/result 계약 변경 없음
 * - 요약 전용 snapshot, raw frame/landmark 저장 없음
 */
import type { ExerciseGateResult } from './auto-progression';
import type { CaptureQuality, OverheadInputTruthMap } from './guardrails';
import type { PoseCaptureStats } from './use-pose-capture';
import type { CameraStepId } from '@/lib/public/camera-test';
import {
  CAMERA_DIAG_VERSION,
} from './camera-success-diagnostic';
import { isFinalPassLatched } from './auto-progression';
import type { SquatInternalQuality } from './squat/squat-internal-quality';
import type { OverheadInternalQuality } from './overhead/overhead-internal-quality';
import type { OverheadInputStabilityDiag } from './overhead/overhead-input-stability';
import type { OverheadReadinessBlockerTracePayload } from './overhead/overhead-readiness-blocker-trace';
import type { OverheadVisualTruthCandidatesExport } from './overhead/visual-truth-candidates';
import type { OverheadVisualTruthSnapshotBundle } from './overhead/visual-snapshot-export';
import {
  type SquatPassSeverity,
  type SquatResultInterpretation,
} from './squat-result-severity';
import {
  clearStoredCameraTraceData,
  clearStoredOverheadObservations,
  clearStoredSquatObservations,
  getStoredRecentAttempts,
  getStoredRecentOverheadObservations,
  getStoredRecentSquatObservations,
  getStoredRecentSquatObservationsSnapshot,
  pushStoredAttemptSnapshot,
  pushStoredOverheadObservation,
  pushStoredSquatObservation,
} from './trace/camera-trace-storage';
import {
  buildOverheadAttemptObservation,
  buildSquatAttemptObservation,
  buildSquatCameraObservabilityExport,
  buildTopReasons,
  computeObservationTruthFields,
  deriveSquatObservabilitySignals,
  overheadObservationDedupSkip,
  observationDedupSkip,
  relativeDepthPeakBucket,
  squatDownwardCommitmentReachedObservable,
} from './trace/camera-trace-observation-builders';
import { buildDiagnosisSummary } from './trace/camera-trace-diagnosis-summary';
import { computeTraceQuickStats } from './trace/camera-trace-quick-stats';
import type {
  OverheadAttemptObservation,
  OverheadObservationEventType,
  SquatAttemptObservation,
  SquatCameraObservabilityExport,
  SquatObservationEventType,
} from './trace/camera-trace-observation-builders';

export {
  buildOverheadAttemptObservation,
  buildSquatAttemptObservation,
  buildSquatCameraObservabilityExport,
  computeObservationTruthFields,
  deriveSquatObservabilitySignals,
  relativeDepthPeakBucket,
  squatDownwardCommitmentReachedObservable,
};
export type {
  ObservationTruthStage,
  OverheadAttemptObservation,
  OverheadObservationEventType,
  SquatAttemptObservation,
  SquatCameraObservabilityExport,
  SquatObservationEventType,
} from './trace/camera-trace-observation-builders';

/** PR-4: movement type (squat, overhead_reach만 지원) */
export type TraceMovementType = 'squat' | 'overhead_reach';

/**
 * PR-OH-MOTION-METRIC-TRACE-03C: What `diagnosisSummary.overhead.peakElevation` (legacy) was sourced from.
 * Evaluator `metrics[].name === 'arm_range'` is **time-average** smoothed arm elevation (deg), not a peak.
 */
export type OverheadExportedPeakElevationProvenance =
  | 'highlighted_metrics_true_peak'
  | 'legacy_metrics_arm_range_time_average_fallback'
  | 'unavailable';

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
    /** PR-OH-READINESS-BLOCKER-ALIGN-02B: readiness blocker framing ?낅젰???됯? 李?湲곗??몄? 瑗щ━ ?대갚?몄? */
    framingHintSource?: 'evaluation_window' | 'recent_tail_fallback';
    /** ?숈씪 ?쒖젏 理쒓렐 踰꾪띁 瑗щ━ framing ?뚰듃(吏꾨떒쨌tail ?ㅼ뿼 ?鍮꾩슜) */
    recentTailFramingHint?: string | null;
    smoothingApplied: boolean;
    validFrameCount?: number;
    visibleJointsRatio?: number;
    criticalJointsAvailability?: number;
    /** PR-OH-OBS-BLOCKER-TRACE-02C: displayed vs eval-window vs tail primary blocker + motion timing */
    overheadReadinessBlockerTrace?: OverheadReadinessBlockerTracePayload;
  };
  stabilitySummary?: {
    warmupExcludedFrameCount?: number;
    qualityFrameCount?: number;
    selectedWindowStartMs?: number | null;
    selectedWindowEndMs?: number | null;
    selectedWindowScore?: number | null;
  };
  /** dev-only: real-device diagnosis ??pass/cue/latch 吏곴껐 ?고???媛?*/
  diagnosisSummary?: {
    stepId: string;
    readinessState?: string;
    captureQuality: CaptureQuality;
    completionSatisfied: boolean;
    passConfirmed: boolean;
    passLatched: boolean;
    autoNextObservation?: string;
    sampledFrameCount?: number;
    /** squat ??PR-A4 cycle trace */
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
      /** PR-CAM-29A: final pass ??대컢留?李⑤떒( completion truth ? 遺꾨━ ) */
      finalPassTimingBlockedReason?: string | null;
      standardPathBlockedReason?: string | null;
      baselineStandingDepth?: number;
      rawDepthPeak?: number;
      relativeDepthPeak?: number;
      ultraLowRomPathDisabledOrGuarded?: boolean;
      /** PR evidence: completion怨?遺꾨━??evidence layer */
      squatEvidenceLevel?: string;
      squatEvidenceReasons?: string[];
      cycleProofPassed?: boolean;
      romBand?: string;
      confidenceDowngradeReason?: string | null;
      insufficientSignalReason?: string | null;
      /** PR failure-freeze: overlay arming ??attempt evidence 湲곕컲 */
      failureOverlayArmed?: boolean;
      failureOverlayBlockedReason?: string | null;
      attemptStarted?: boolean;
      downwardCommitmentReached?: boolean;
      evidenceLabel?: string;
      completionBlockedReason?: string | null;
      /** PR shallow: guardrail partial ???댁쑀 */
      guardrailPartialReason?: string;
      /** PR shallow: guardrail complete ??寃쎈줈 */
      guardrailCompletePath?: string;
      /** PR shallow: low-ROM recovery 誘명솗???댁쑀 */
      lowRomRejectionReason?: string | null;
      /** PR shallow: ultra-low-ROM recovery 誘명솗???댁쑀 */
      ultraLowRomRejectionReason?: string | null;
      /** PR-COMP-01 */
      completionMachinePhase?: string;
      completionPassReason?: string;
      /** PR-04D1: completion pass vs capture-quality 寃쎄퀬 遺꾨━(?ㅼ옘???꾩슜) */
      completionTruthPassed?: boolean;
      lowQualityPassAllowed?: boolean;
      passOwner?: string;
      /** PR-CAM-OWNER-FREEZE-01: success ?ㅻ깄?룹뿉??final vs shadow event 諛대뱶 遺꾨━ */
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
      /** Setup false-pass lock ??squatCycleDebug 誘몃윭 */
      liveReadinessSummaryState?: string;
      readinessStableDwellSatisfied?: boolean;
      setupMotionBlocked?: boolean;
      setupMotionBlockReason?: string | null;
      attemptStartedAfterReady?: boolean;
      successSuppressedBySetupPhase?: boolean;
      qualityOnlyWarnings?: string[];
      /** PR-04E1: depth/arming ?낅젰 trace */
      armingDepthSource?: string | null;
      armingDepthPeak?: number | null;
      squatDepthPeakPrimary?: number | null;
      squatDepthPeakBlended?: number | null;
      armingDepthBlendAssisted?: boolean;
      armingFallbackUsed?: boolean;
      /** PR-04E2: ??쟾 ?뺤씤 愿痢?*/
      reversalConfirmedBy?: string | null;
      reversalDepthDrop?: number | null;
      reversalFrameCount?: number | null;
      /** PR-04E3A: relative depth truth */
      relativeDepthPeakSource?: string | null;
      rawDepthPeakPrimary?: number | null;
      rawDepthPeakBlended?: number | null;
      /** PR-CAM-29: shallow depth source stabilization ??compact ?ㅼ뭡?쇰쭔 */
      squatDepthObsFallbackPeak?: number | null;
      squatDepthObsTravelPeak?: number | null;
      squatDepthBlendOfferedCount?: number;
      squatDepthBlendCapHitCount?: number;
      squatDepthBlendActiveFrameCount?: number;
      squatDepthSourceFlipCount?: number;
      /** PR-04E3B: shallow event-cycle owner 愿痢?*/
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
      /** PR-CAM-CORE: completion-state trajectory descent ?대갚 truth */
      eventBasedDescentPath?: boolean;
      /**
       * PR-02 Assist lock: completion-state ?뺣낯 ??assist / promoted finalize / reversal provenance.
       * pass owner쨌PR-01 lineage ? ?쇰룞 湲덉?.
       */
      completionFinalizeMode?: string | null;
      completionAssistApplied?: boolean;
      completionAssistSources?: string[];
      completionAssistMode?: string | null;
      promotionBaseRuleBlockedReason?: string | null;
      reversalEvidenceProvenance?: string | null;
      trajectoryReversalRescueApplied?: boolean;
      /** squatCompletionState.reversalTailBackfillApplied (squatCycleDebug 誘몃윭 ?놁쓬) */
      reversalTailBackfillApplied?: boolean;
      /**
       * PR-SQUAT-COMPLETION-REARCH-01 ??Subcontract A trace (admission / shallow gate)
       * + C ?쇰?: ?꾨옒 closed/blocked/drift ??C 異?
       */
      officialShallowPathCandidate?: boolean;
      officialShallowPathAdmitted?: boolean;
      officialShallowPathClosed?: boolean;
      officialShallowPathReason?: string | null;
      officialShallowPathBlockedReason?: string | null;
      /** PR-03: event ?밴꺽???꾨땶 怨듭떇 cycle 濡??ロ옒 ?щ?( pass reason 湲곗? ) */
      closedAsOfficialRomCycle?: boolean;
      /** PR-03: residue event_cycle ?쇰꺼濡??ロ옒(?꾩옱???밴꺽??cycle 濡??듭씪?섏뼱 二쇰줈 false) */
      closedAsEventRescuePassReason?: boolean;
      /** PR-SQUAT-COMPLETION-REARCH-01 ??Subcontract B trace (reversal / ascent-equivalent / provenance) */
      officialShallowStreamBridgeApplied?: boolean;
      officialShallowAscentEquivalentSatisfied?: boolean;
      officialShallowClosureProofSatisfied?: boolean;
      /** PR-03 shallow closure final: primary-stream ?대갚?쇰줈 shallow 踰덈뱾留??깅┰(愿痢? */
      officialShallowPrimaryDropClosureFallback?: boolean;
      /** PR-03 final: shallow closure 異?????쟾 truth */
      officialShallowReversalSatisfied?: boolean;
      /** PR-03 final: 愿痢??꾩슜 ??shallow ?낆옣 ??踰꾪띁 源딆뼱??standard_cycle 濡쒕쭔 ?ロ엺 ?붿뿬 */
      officialShallowDriftedToStandard?: boolean;
      officialShallowDriftReason?: string | null;
      officialShallowPreferredPrefixFrameCount?: number | null;
      /** PR-CAM-OBS-NORMALIZE-01: ?쒕㈃ ?쇱꽑 諛⑹????댁꽍 ?쇰꺼(媛뮻룹궛??蹂寃??꾨떂) */
      displayDepthTruth?: 'evaluator_peak_metric';
      ownerDepthTruth?: 'completion_relative_depth';
      cycleDecisionTruth?: 'completion_state';
      /** PR-COMP-03 */
      squatInternalQuality?: SquatInternalQuality;
      /** PR-CAM-SQUAT-RESULT-SEVERITY-01: pass truth + quality truth 湲곕컲 ?댁꽍(?먯젙 蹂寃??놁쓬) */
      passSeverity?: SquatPassSeverity;
      resultInterpretation?: SquatResultInterpretation;
      qualityWarningCount?: number;
      limitationCount?: number;
      /** CAM-shallow-obs: attempt-evidence蹂대떎 ?쏀븳 愿痢?怨꾩빟(??Β룹쭊???꾩슜) */
      shallowObservationEligible?: boolean;
      /** PR-HMM-03A: 而댄뙥??calibration (吏㏃? ?? */
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
    /** overhead ??PR-C4 trace, PR overhead-dwell */
    overhead?: {
      /**
       * Legacy field: max smoothed arm elevation (deg) when `highlightedMetrics.peakArmElevation` exists;
       * otherwise falls back to `metrics.arm_range` which is a **time average**, not a peak.
       * PR-03C: use `truePeakArmElevationDeg`, `armElevationTimeAvgDeg`, `exportedPeakElevationProvenance`.
       */
      peakElevation?: number;
      /** PR-03C: same numeric value as `peakElevation` when present ??explicit label for legacy consumers. */
      legacyPeakElevationDeg?: number;
      /** PR-03C: max over valid frames ??`highlightedMetrics.peakArmElevation` (smoothed armElevationAvg space). */
      truePeakArmElevationDeg?: number;
      /** PR-03C: rise-truth module peak ??`highlightedMetrics.risePeakArmElevation` (same input stream; diagnostic parity). */
      risePeakArmElevationDeg?: number;
      /** PR-03C: `metrics.arm_range` value = mean time-average of armElevationAvg (deg), NOT peak ROM. */
      armElevationTimeAvgDeg?: number;
      /** PR-03C: documents how `peakElevation` / `legacyPeakElevationDeg` was chosen. */
      exportedPeakElevationProvenance?: OverheadExportedPeakElevationProvenance;
      /** PR-03C: true iff legacy peak field was filled from arm_range (time average). */
      peakElevationRepresentsTimeAverageFallback?: boolean;
      /** PR-03C: when arm_range metric row exists, its value semantics (always time average for this name). */
      armRangeMetricSemantics?: 'time_average_deg';
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
      /** PR overhead-dwell: dwell vs legacy span 鍮꾧탳??*/
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
      /** PR-02: rise truth owner observability */
      meaningfulRiseSatisfied?: boolean;
      riseStartedAtMs?: number;
      riseBlockedReason?: string | null;
      /** PR-02: final-pass layer blocked reason (Layer 2 ??from gate.finalPassBlockedReason) */
      finalPassBlockedReason?: string | null;
      /** OBS: guardrail.debug.overheadInputTruthMap + readiness 蹂묓빀 */
      inputTruthMap?: OverheadInputTruthMap;
      /** OBS: ?섏씠吏 ??stats ?먯퐫(寃뚯씠?몄? ?숈씪 ?꾨젅?꾩씠硫??섏튂 ?쇱튂) */
      pageHookStatsEcho?: {
        sampledFrameCount: number;
        hookAcceptedFrameCount: number;
        droppedFrameCount: number;
        filteredLowQualityFrameCount: number;
        unstableFrameCount: number;
      };
      /** PR-OH-INPUT-STABILITY-02A: adaptor vs early-cutoff terminal / grace (page-supplied) */
      inputStability?: OverheadInputStabilityDiag;
      /** PR-OH-OBS-BLOCKER-TRACE-02C: readinessSummary ? ?숈씪 payload ?먯퐫 (motion 釉붾줉怨??④퍡 ?댁꽍) */
      readinessBlockerTrace?: OverheadReadinessBlockerTracePayload;
      /**
       * PR-OH-KINEMATIC-SIGNAL-04B: Session aggregates of overhead-only candidate kinematics (highlightedMetrics).
       * Diagnostic only ??not used for gates. Compare to truePeakArmElevationDeg (legacy hip?뱒houlder?밻lbow).
       */
      ohKinematicPeakShoulderWristElevationAvgDeg?: number | null;
      ohKinematicMeanShoulderWristElevationAvgDeg?: number | null;
      ohKinematicPeakWristAboveShoulderAvgNorm?: number | null;
      ohKinematicMeanWristAboveShoulderAvgNorm?: number | null;
      ohKinematicPeakElbowAboveShoulderAvgNorm?: number | null;
      ohKinematicMeanElbowAboveShoulderAvgNorm?: number | null;
      /**
       * PR-OH-HEAD-RELATIVE-SIGNAL-04E: Session aggregates ??face/head-relative wrist & elbow evidence.
       * Diagnostic only; not used for gates. Compare to 04B shoulder-relative + legacy arm elevation.
       */
      ohHeadRelativePeakWristAboveNoseAvgNorm?: number | null;
      ohHeadRelativeMeanWristAboveNoseAvgNorm?: number | null;
      ohHeadRelativePeakWristAboveEarAvgNorm?: number | null;
      ohHeadRelativeMeanWristAboveEarAvgNorm?: number | null;
      ohHeadRelativePeakWristAboveHeadTopProxyAvgNorm?: number | null;
      ohHeadRelativeMeanWristAboveHeadTopProxyAvgNorm?: number | null;
      ohHeadRelativePeakElbowAboveEarAvgNorm?: number | null;
      ohHeadRelativeMeanElbowAboveEarAvgNorm?: number | null;
      /** PR-OH-VISUAL-TRUTH-OBS-06B: selected-window vs global top-like diagnostics (export-only) */
      visualTruthCandidates?: OverheadVisualTruthCandidatesExport | null;
      /** PR-OH-VISUAL-SNAPSHOT-06C: JPEG + overlay tied to visualTruthCandidates tags/indices */
      visualTruthSnapshots?: OverheadVisualTruthSnapshotBundle | null;
    };
    /** cue */
    cue?: {
      chosenCueKey: string | null;
      chosenClipKey: string | null;
      suppressedReason: string | null;
      liveCueingEnabled: boolean;
      /** PR-OH-OBS-BLOCKER-TRACE-02C: 紐낆떆???꾨낫 ?? chosenCueKey ? ?숈씪 媛? ?섎? 怨좎젙??) */
      lastCorrectiveCueCandidateKey?: string | null;
      /** 援먯젙 猷⑦봽媛 留덉?留됱쑝濡??ъ깮 ?깃났?쇰줈 湲곕줉???щ? */
      correctiveCueActuallyPlayed?: boolean;
      /** ?듭젣 ???ъ쑀( ?ъ깮 ????) */
      correctiveCueSuppressedReason?: string | null;
      /** anti-spam 痢?留덉?留?emit ?쒓컖(ms) ???ъ깮 ?쒕룄 吏곸쟾 ??꾩뒪?ы봽 */
      correctiveCueAntiSpamEmittedAtMs?: number | null;
      /** ?대┰/TTS ?ъ깮 愿痢??깃났 ?щ?( ?????놁쑝硫?null ) */
      playbackSuccessIfKnown?: boolean | null;
      /** 留덉?留??ъ깮 愿痢≪뿉 ?곌껐??cue ??*/
      lastPlaybackObservedCueKey?: string | null;
    };
  };
  debugVersion: string;
  /** CAM-OBS: ?ㅼ옘?몄씪 ?뚮쭔 梨꾩? */
  squatCameraObservability?: SquatCameraObservabilityExport;
}

/** bounded localStorage ???ㅽ뙣 ??臾댁떆 */
export function pushSquatObservation(obs: SquatAttemptObservation): void {
  pushStoredSquatObservation(obs, observationDedupSkip);
}

export function getRecentSquatObservations(): SquatAttemptObservation[] {
  return getStoredRecentSquatObservations();
}

/**
 * Terminal bundle 吏곸쟾???몄텧 ??LS ?뺣낯 ?곗꽑, ?뚯떛 ?ㅽ뙣쨌鍮꾩뼱 ?덉쓬쨌?곌린 ?ㅽ뙣濡?罹먯떆媛 ??湲몃㈃ 罹먯떆 ?ъ슜.
 * ?곗떇 蹂寃??놁쓬, ?쎄린 寃쎈줈留?紐낆떆.
 */
export function getRecentSquatObservationsSnapshot(): SquatAttemptObservation[] {
  return getStoredRecentSquatObservationsSnapshot();
}

export function clearSquatObservations(): void {
  clearStoredSquatObservations();
}

/** ?ㅼ옘??愿痢?1嫄?湲곕줉(?섏씠吏 effect?먯꽌 ?몄텧). ?듦낵 ?꾧퀎쨌?댁꽍 蹂寃??놁쓬. */
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

export function pushOverheadObservation(obs: OverheadAttemptObservation): void {
  pushStoredOverheadObservation(obs, overheadObservationDedupSkip);
}

export function getRecentOverheadObservations(): OverheadAttemptObservation[] {
  return getStoredRecentOverheadObservations();
}

export function clearOverheadObservations(): void {
  clearStoredOverheadObservations();
}

/** ?ㅻ쾭?ㅻ뱶 愿痢?1嫄?湲곕줉(?섏씠吏 effect쨌?곕???寃쎈줈). */
export function recordOverheadObservationEvent(
  gate: ExerciseGateResult,
  attemptCorrelationId: string,
  eventType: OverheadObservationEventType,
  options?: Parameters<typeof buildOverheadAttemptObservation>[3]
): void {
  try {
    const obs = buildOverheadAttemptObservation(gate, attemptCorrelationId, eventType, options);
    if (obs) pushOverheadObservation(obs);
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


const DEBUG_VERSION = 'pr4-2';

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
  /** PR-C4: overhead hold cue ?ъ깮 ?щ? */
  holdCuePlayed?: boolean;
  /** PR-C4: success latch ?쒖젏 (ms) */
  successTriggeredAtMs?: number;
  /** OBS: overhead ?낅젰 truth ??usePoseCapture stats ?먯퐫 */
  poseCaptureStats?: PoseCaptureStats;
  /** PR-OH-INPUT-STABILITY-02A: overhead terminal deferral / failure class (optional) */
  overheadInputStability?: OverheadInputStabilityDiag;
  /** PR-OH-VISUAL-SNAPSHOT-06C: bounded JPEGs for 06B candidates (terminal attempt, client-built) */
  overheadVisualTruthSnapshots?: OverheadVisualTruthSnapshotBundle;
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
    squatCameraObservability: buildSquatCameraObservabilityExport(gate),
    debugVersion: `${DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

/**
 * snapshot을 bounded localStorage에 추가 (non-blocking)
 */
export function pushAttemptSnapshot(snapshot: AttemptSnapshot): void {
  pushStoredAttemptSnapshot(snapshot);
}

/**
 * 최근 attempt 목록 조회
 */
export function getRecentAttempts(): AttemptSnapshot[] {
  return getStoredRecentAttempts();
}

/**
 * trace 저장소 초기화
 */
export function clearAttempts(): void {
  clearStoredCameraTraceData();
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
  return computeTraceQuickStats(snapshots);
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
