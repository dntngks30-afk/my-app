import type { ExerciseGateResult } from '../auto-progression';
import { isFinalPassLatched } from '../auto-progression';
import {
  hasShallowSquatObservation,
  hasSquatAttemptEvidence,
} from '../camera-success-diagnostic';
import { getLastPlaybackObservability } from '../korean-audio-pack';
import {
  buildSquatResultSeveritySummary,
  type SquatPassSeverity,
  type SquatResultInterpretation,
} from '../squat-result-severity';
import { getCorrectiveCueObservability } from '../voice-guidance';
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildSquatArmingAssistTraceCompact } from '@/lib/camera/squat/squat-arming-assist';
import { buildSquatCalibrationTraceCompact } from '@/lib/camera/squat/squat-calibration-trace';
import { buildSquatReversalAssistTraceCompact } from '@/lib/camera/squat/squat-reversal-assist';
import type {
  AttemptSnapshot,
  OverheadExportedPeakElevationProvenance,
  RecordAttemptOptions,
} from '../camera-trace';

export function buildDiagnosisSummary(
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
      baselineStandingDepth:
        typeof hm?.baselineStandingDepth === 'number' ? hm.baselineStandingDepth : undefined,
      rawDepthPeak: typeof hm?.rawDepthPeak === 'number' ? hm.rawDepthPeak : undefined,
      relativeDepthPeak:
        typeof hm?.relativeDepthPeak === 'number' ? hm.relativeDepthPeak : undefined,
      failureOverlayArmed: hasSquatAttemptEvidence(gate),
      failureOverlayBlockedReason: hasSquatAttemptEvidence(gate)
        ? null
        : hasShallowSquatObservation(gate)
          ? 'no_attempt_evidence_shallow_observed'
          : 'no_attempt_evidence',
      shallowObservationEligible: hasShallowSquatObservation(gate),
      attemptStarted:
        sc.attemptStarted ?? ((sc.descendConfirmed ?? false) || (hm?.descentCount as number) > 0),
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
        typeof hm?.squatDepthBlendOfferedCount === 'number'
          ? hm.squatDepthBlendOfferedCount
          : undefined,
      squatDepthBlendCapHitCount:
        typeof hm?.squatDepthBlendCapHitCount === 'number'
          ? hm.squatDepthBlendCapHitCount
          : undefined,
      squatDepthBlendActiveFrameCount:
        typeof hm?.squatDepthBlendActiveFrameCount === 'number'
          ? hm.squatDepthBlendActiveFrameCount
          : undefined,
      squatDepthSourceFlipCount:
        typeof hm?.squatDepthSourceFlipCount === 'number'
          ? hm.squatDepthSourceFlipCount
          : undefined,
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
      officialShallowAscentEquivalentSatisfied:
        cs?.officialShallowAscentEquivalentSatisfied === true,
      officialShallowClosureProofSatisfied:
        cs?.officialShallowClosureProofSatisfied === true,
      officialShallowPrimaryDropClosureFallback:
        cs?.officialShallowPrimaryDropClosureFallback === true,
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

    const resultSeverity = buildSquatResultSeveritySummary({
      completionTruthPassed: sc.completionTruthPassed === true,
      captureQuality: String(base.captureQuality ?? ''),
      qualityOnlyWarnings: sc.qualityOnlyWarnings,
      qualityTier: base.squatCycle.squatInternalQuality?.qualityTier ?? null,
      limitations: base.squatCycle.squatInternalQuality?.limitations,
    });
    base.squatCycle.passSeverity = resultSeverity.passSeverity as SquatPassSeverity;
    base.squatCycle.resultInterpretation =
      resultSeverity.resultInterpretation as SquatResultInterpretation;
    base.squatCycle.qualityWarningCount = resultSeverity.qualityWarningCount;
    base.squatCycle.limitationCount = resultSeverity.limitationCount;

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
      const squatCompletionState = gate.evaluatorResult.debug?.squatCompletionState;
      squatCycleExt.hra = buildSquatReversalAssistTraceCompact(
        squatCompletionState?.hmmReversalAssistEligible,
        squatCompletionState?.hmmReversalAssistApplied,
        squatCompletionState?.hmmReversalAssistReason ?? null
      );
    }
  }

  if (stepId === 'overhead-reach') {
    const REQUIRED_HOLD_MS = 1200;
    const raiseCount = typeof hm?.raiseCount === 'number' ? hm.raiseCount : 0;
    const peakCount = typeof hm?.peakCount === 'number' ? hm.peakCount : 0;
    const holdDurationMs = typeof hm?.holdDurationMs === 'number' ? hm.holdDurationMs : 0;
    const topDetectedAtMs =
      typeof hm?.topDetectedAtMs === 'number' ? hm.topDetectedAtMs : undefined;
    const topEntryAtMs = typeof hm?.topEntryAtMs === 'number' ? hm.topEntryAtMs : undefined;
    const stableTopEntryAtMs =
      typeof hm?.stableTopEntryAtMs === 'number' ? hm.stableTopEntryAtMs : undefined;
    const holdArmedAtMs = typeof hm?.holdArmedAtMs === 'number' ? hm.holdArmedAtMs : undefined;
    const holdAccumulationStartedAtMs =
      typeof hm?.holdAccumulationStartedAtMs === 'number'
        ? hm.holdAccumulationStartedAtMs
        : undefined;
    const holdArmingBlockedReason = hm?.holdArmingBlockedReason as string | null | undefined;
    const holdAccumulationMs =
      typeof hm?.holdAccumulationMs === 'number' ? hm.holdAccumulationMs : holdDurationMs;
    const holdSatisfiedAtMs =
      typeof hm?.holdSatisfiedAtMs === 'number' ? hm.holdSatisfiedAtMs : undefined;

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
    const holdDurationMsLegacySpan =
      typeof hm?.holdDurationMsLegacySpan === 'number' ? hm.holdDurationMsLegacySpan : undefined;
    const dwellHoldDurationMs =
      typeof hm?.dwellHoldDurationMs === 'number' ? hm.dwellHoldDurationMs : holdDurationMs;
    const legacyHoldDurationMs =
      typeof hm?.legacyHoldDurationMs === 'number'
        ? hm.legacyHoldDurationMs
        : holdDurationMsLegacySpan;
    const stableTopEnteredAtMs =
      typeof hm?.stableTopEnteredAtMs === 'number' ? hm.stableTopEnteredAtMs : undefined;
    const stableTopExitedAtMs =
      typeof hm?.stableTopExitedAtMs === 'number' ? hm.stableTopExitedAtMs : undefined;
    const stableTopDwellMs =
      typeof hm?.stableTopDwellMs === 'number' ? hm.stableTopDwellMs : undefined;
    const stableTopSegmentCount =
      typeof hm?.stableTopSegmentCount === 'number' ? hm.stableTopSegmentCount : undefined;
    const holdComputationMode =
      typeof hm?.holdComputationMode === 'string' ? hm.holdComputationMode : undefined;

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
      meaningfulRiseSatisfied:
        hm?.meaningfulRiseSatisfied === 1 || hm?.meaningfulRiseSatisfied === true,
      riseStartedAtMs: typeof hm?.riseStartedAtMs === 'number' ? hm.riseStartedAtMs : undefined,
      riseBlockedReason: typeof hm?.riseBlockedReason === 'string' ? hm.riseBlockedReason : null,
      finalPassBlockedReason:
        typeof gate.finalPassBlockedReason === 'string' ? gate.finalPassBlockedReason : null,
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
      const poseCaptureStats = options.poseCaptureStats;
      base.overhead.pageHookStatsEcho = {
        sampledFrameCount: poseCaptureStats.sampledFrameCount,
        hookAcceptedFrameCount: poseCaptureStats.validFrameCount,
        droppedFrameCount: poseCaptureStats.droppedFrameCount,
        filteredLowQualityFrameCount: poseCaptureStats.filteredLowQualityFrameCount,
        unstableFrameCount: poseCaptureStats.unstableFrameCount,
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
