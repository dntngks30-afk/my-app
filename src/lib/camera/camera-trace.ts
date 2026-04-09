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
import type { OverheadInputStabilityDiag } from './overhead/overhead-input-stability';
import type { OverheadReadinessBlockerTracePayload } from './overhead/overhead-readiness-blocker-trace';
import type { OverheadVisualTruthCandidatesExport } from './overhead/visual-truth-candidates';
import type { OverheadVisualTruthSnapshotBundle } from './overhead/visual-snapshot-export';
import {
  buildSquatResultSeveritySummary,
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
      lastCorrectiveCueCandidateKey: cueObs?.cueCandidate ?? null,
      correctiveCueActuallyPlayed: cueObs?.played ?? false,
      correctiveCueSuppressedReason: cueObs?.suppressedReason ?? null,
      correctiveCueAntiSpamEmittedAtMs: cueObs?.emittedAtMs ?? null,
      playbackSuccessIfKnown:
        typeof playbackObs?.success === 'boolean' ? playbackObs.success : null,
      lastPlaybackObservedCueKey: playbackObs?.cueKey ?? null,
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

    /** PR-CAM-RESULT-SEVERITY-SURFACE-01: diagnosis `base` = d, squatCycle.squatInternalQuality = ?덉슜 source留?*/
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

    // PR-HMM-01B: shadow decoder compact summary ??snapshot payload 怨쇰???諛⑹?
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

    // PR-HMM-03A: calibration compact ??HMM + completion state ??釉붾줉
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
    const holdArmingBlockedReason =
      hm?.holdArmingBlockedReason as string | null | undefined;
    const holdAccumulationMs = typeof hm?.holdAccumulationMs === 'number' ? hm.holdAccumulationMs : holdDurationMs;
    const holdSatisfiedAtMs = typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined;

    // PR-OH-MOTION-METRIC-TRACE-03C: separate true peak vs time-average vs rise peak ??no evaluator behavior change.
    const armRangeMetric = gate.evaluatorResult?.metrics?.find((m) => m.name === 'arm_range');
    const armElevationTimeAvgDeg =
      typeof armRangeMetric?.value === 'number' && Number.isFinite(armRangeMetric.value)
        ? armRangeMetric.value
        : undefined;
    const truePeakArmElevationDeg =
      typeof hm?.peakArmElevation === 'number' && Number.isFinite(hm.peakArmElevation)
        ? hm.peakArmElevation
        : undefined;
    const risePeakArmElevationDeg =
      typeof hm?.risePeakArmElevation === 'number' && Number.isFinite(hm.risePeakArmElevation)
        ? hm.risePeakArmElevation
        : undefined;
    /** Identical to pre-03C: prefer highlighted max peak, else arm_range (mean ??historically mislabeled as "peak"). */
    const peakElevation =
      truePeakArmElevationDeg !== undefined ? truePeakArmElevationDeg : armElevationTimeAvgDeg;
    const exportedPeakElevationProvenance: OverheadExportedPeakElevationProvenance =
      truePeakArmElevationDeg !== undefined
        ? 'highlighted_metrics_true_peak'
        : armElevationTimeAvgDeg !== undefined
          ? 'legacy_metrics_arm_range_time_average_fallback'
          : 'unavailable';
    const peakElevationRepresentsTimeAverageFallback =
      exportedPeakElevationProvenance === 'legacy_metrics_arm_range_time_average_fallback';

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
      legacyPeakElevationDeg: peakElevation,
      truePeakArmElevationDeg,
      risePeakArmElevationDeg,
      armElevationTimeAvgDeg,
      exportedPeakElevationProvenance,
      peakElevationRepresentsTimeAverageFallback,
      armRangeMetricSemantics: armRangeMetric !== undefined ? 'time_average_deg' : undefined,
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
      stableTopExitedAtMs,
      stableTopDwellMs,
      stableTopSegmentCount,
      holdComputationMode,
      completionMachinePhase:
        typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : undefined,
      completionBlockedReason:
        typeof hm?.completionBlockedReason === 'string' ? hm.completionBlockedReason : undefined,
      overheadInternalQuality: gate.evaluatorResult.debug?.overheadInternalQuality,
      /** PR-02: rise truth owner */
      meaningfulRiseSatisfied:
        hm?.meaningfulRiseSatisfied === 1 || hm?.meaningfulRiseSatisfied === true,
      riseStartedAtMs: typeof hm?.riseStartedAtMs === 'number' ? hm.riseStartedAtMs : undefined,
      riseBlockedReason:
        typeof hm?.riseBlockedReason === 'string' ? hm.riseBlockedReason : null,
      /** PR-02: final-pass blocked reason ??distinguishes Layer 1 vs Layer 2 failure */
      finalPassBlockedReason:
        typeof gate.finalPassBlockedReason === 'string' ? gate.finalPassBlockedReason : null,
      /** PR-OH-KINEMATIC-SIGNAL-04B */
      ohKinematicPeakShoulderWristElevationAvgDeg:
        typeof hm?.ohKinematicPeakShoulderWristElevationAvgDeg === 'number'
          ? hm.ohKinematicPeakShoulderWristElevationAvgDeg
          : undefined,
      ohKinematicMeanShoulderWristElevationAvgDeg:
        typeof hm?.ohKinematicMeanShoulderWristElevationAvgDeg === 'number'
          ? hm.ohKinematicMeanShoulderWristElevationAvgDeg
          : undefined,
      ohKinematicPeakWristAboveShoulderAvgNorm:
        typeof hm?.ohKinematicPeakWristAboveShoulderAvgNorm === 'number'
          ? hm.ohKinematicPeakWristAboveShoulderAvgNorm
          : undefined,
      ohKinematicMeanWristAboveShoulderAvgNorm:
        typeof hm?.ohKinematicMeanWristAboveShoulderAvgNorm === 'number'
          ? hm.ohKinematicMeanWristAboveShoulderAvgNorm
          : undefined,
      ohKinematicPeakElbowAboveShoulderAvgNorm:
        typeof hm?.ohKinematicPeakElbowAboveShoulderAvgNorm === 'number'
          ? hm.ohKinematicPeakElbowAboveShoulderAvgNorm
          : undefined,
      ohKinematicMeanElbowAboveShoulderAvgNorm:
        typeof hm?.ohKinematicMeanElbowAboveShoulderAvgNorm === 'number'
          ? hm.ohKinematicMeanElbowAboveShoulderAvgNorm
          : undefined,
      /** PR-OH-HEAD-RELATIVE-SIGNAL-04E */
      ohHeadRelativePeakWristAboveNoseAvgNorm:
        typeof hm?.ohHeadRelativePeakWristAboveNoseAvgNorm === 'number'
          ? hm.ohHeadRelativePeakWristAboveNoseAvgNorm
          : undefined,
      ohHeadRelativeMeanWristAboveNoseAvgNorm:
        typeof hm?.ohHeadRelativeMeanWristAboveNoseAvgNorm === 'number'
          ? hm.ohHeadRelativeMeanWristAboveNoseAvgNorm
          : undefined,
      ohHeadRelativePeakWristAboveEarAvgNorm:
        typeof hm?.ohHeadRelativePeakWristAboveEarAvgNorm === 'number'
          ? hm.ohHeadRelativePeakWristAboveEarAvgNorm
          : undefined,
      ohHeadRelativeMeanWristAboveEarAvgNorm:
        typeof hm?.ohHeadRelativeMeanWristAboveEarAvgNorm === 'number'
          ? hm.ohHeadRelativeMeanWristAboveEarAvgNorm
          : undefined,
      ohHeadRelativePeakWristAboveHeadTopProxyAvgNorm:
        typeof hm?.ohHeadRelativePeakWristAboveHeadTopProxyAvgNorm === 'number'
          ? hm.ohHeadRelativePeakWristAboveHeadTopProxyAvgNorm
          : undefined,
      ohHeadRelativeMeanWristAboveHeadTopProxyAvgNorm:
        typeof hm?.ohHeadRelativeMeanWristAboveHeadTopProxyAvgNorm === 'number'
          ? hm.ohHeadRelativeMeanWristAboveHeadTopProxyAvgNorm
          : undefined,
      ohHeadRelativePeakElbowAboveEarAvgNorm:
        typeof hm?.ohHeadRelativePeakElbowAboveEarAvgNorm === 'number'
          ? hm.ohHeadRelativePeakElbowAboveEarAvgNorm
          : undefined,
      ohHeadRelativeMeanElbowAboveEarAvgNorm:
        typeof hm?.ohHeadRelativeMeanElbowAboveEarAvgNorm === 'number'
          ? hm.ohHeadRelativeMeanElbowAboveEarAvgNorm
          : undefined,
    };

    const ohTruth = gate.guardrail.debug?.overheadInputTruthMap;
    if (ohTruth && base.overhead) {
      base.overhead.inputTruthMap = {
        ...ohTruth,
        layer4_readinessMotion: {
          ...ohTruth.layer4_readinessMotion,
          readinessState: context?.state,
          readinessBlocker: context?.blocker ?? null,
        },
      };
    }
    if (base.overhead) {
      base.overhead.visualTruthCandidates = gate.guardrail.debug?.visualTruthCandidates ?? null;
      base.overhead.visualTruthSnapshots = options?.overheadVisualTruthSnapshots ?? null;
    }
    if (options?.poseCaptureStats && base.overhead) {
      const ps = options.poseCaptureStats;
      base.overhead.pageHookStatsEcho = {
        sampledFrameCount: ps.sampledFrameCount,
        hookAcceptedFrameCount: ps.validFrameCount,
        droppedFrameCount: ps.droppedFrameCount,
        filteredLowQualityFrameCount: ps.filteredLowQualityFrameCount,
        unstableFrameCount: ps.unstableFrameCount,
      };
    }
    if (options?.overheadInputStability && base.overhead) {
      base.overhead.inputStability = options.overheadInputStability;
    }
    if (context?.overheadReadinessBlockerTrace && base.overhead) {
      base.overhead.readinessBlockerTrace = context.overheadReadinessBlockerTrace;
    }
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
