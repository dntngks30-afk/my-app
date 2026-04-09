import type { ExerciseGateResult } from '../auto-progression';
import type { CaptureQuality } from '../guardrails';
import {
  CAMERA_DIAG_VERSION,
  hasShallowSquatObservation,
} from '../camera-success-diagnostic';
import { peekLastPoseCameraObservability } from '../camera-observability-pose-bridge';
import {
  getFrozenSquatPassSnapshot,
  getLiveSquatPassCoreTruth,
  noteSquatGateForCameraObservability,
} from '../camera-observability-squat-session';
import type { CameraPoseDelegateKind } from '@/lib/motion/pose-types';

export type SquatCameraObservabilityExport = {
  runtime: {
    latency_ms: number;
    fps_est: number;
    delegate: CameraPoseDelegateKind;
  };
  pose_quality: {
    median_landmark_conf: number;
    reproj_px: number | null;
    pose_world_present: boolean;
  };
  pass_snapshot: Record<string, unknown> | null;
  pass_core_truth: Record<string, unknown> | null;
  completion: Record<string, unknown>;
  eventCycle: Record<string, unknown>;
  reversal: Record<string, unknown>;
};

export function buildSquatCameraObservabilityExport(
  gate: ExerciseGateResult
): SquatCameraObservabilityExport | undefined {
  if (gate.evaluatorResult?.stepId !== 'squat') return undefined;

  const poseObs = peekLastPoseCameraObservability();
  const runtime = poseObs?.runtime ?? {
    latency_ms: 0,
    fps_est: 0,
    delegate: 'unknown' as CameraPoseDelegateKind,
  };
  const pose_quality = poseObs?.pose_quality ?? {
    median_landmark_conf: 0,
    reproj_px: null as number | null,
    pose_world_present: false,
  };

  noteSquatGateForCameraObservability(gate);
  const pass_snapshot = getFrozenSquatPassSnapshot();
  const pass_core_truth = getLiveSquatPassCoreTruth();
  const cs = gate.evaluatorResult.debug?.squatCompletionState;

  const completion: Record<string, unknown> =
    cs != null
      ? {
          completionSatisfied: cs.completionSatisfied === true,
          completionPassReason: cs.completionPassReason ?? null,
          completionBlockedReason: cs.completionBlockedReason ?? null,
          completionMachinePhase: cs.completionMachinePhase ?? null,
          descendConfirmed: cs.descendConfirmed === true,
          reversalConfirmedAfterDescend: cs.reversalConfirmedAfterDescend === true,
          recoveryConfirmedAfterReversal: cs.recoveryConfirmedAfterReversal === true,
          relativeDepthPeak: cs.relativeDepthPeak,
          rawDepthPeak: cs.rawDepthPeak,
          baselineStandingDepth: cs.baselineStandingDepth,
          standingRecoveryThreshold: cs.standingRecoveryThreshold,
          eventCyclePromoted: cs.eventCyclePromoted === true,
          peakLatchedAtIndex: cs.peakLatchedAtIndex ?? null,
          peakAtMs: cs.peakAtMs ?? null,
          reversalAtMs: cs.reversalAtMs ?? null,
          committedAtMs: cs.committedAtMs ?? null,
          finalPassEligible: gate.finalPassEligible,
        }
      : {};

  const ev = cs?.squatEventCycle;
  const eventCycle: Record<string, unknown> =
    ev != null && typeof ev === 'object' ? { ...(ev as Record<string, unknown>) } : {};

  const reversal: Record<string, unknown> =
    cs != null
      ? {
          reversalConfirmedBy: cs.reversalConfirmedBy ?? null,
          reversalDepthDrop: cs.reversalDepthDrop ?? null,
          reversalFrameCount: cs.reversalFrameCount ?? null,
          reversalAtMs: cs.reversalAtMs ?? null,
          reversalConfirmedAfterDescend: cs.reversalConfirmedAfterDescend === true,
          trajectoryReversalRescueApplied: cs.trajectoryReversalRescueApplied === true,
          reversalTailBackfillApplied: cs.reversalTailBackfillApplied === true,
          hmmReversalAssistApplied: cs.hmmReversalAssistApplied === true,
          hmmReversalAssistReason: cs.hmmReversalAssistReason ?? null,
        }
      : {};

  return { runtime, pose_quality, pass_snapshot, pass_core_truth, completion, eventCycle, reversal };
}

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
  | 'shallow_observed'
  | 'capture_session_terminal';

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
  captureTerminalKind?: string | null;
  progressionStateSnapshot?: string;
  gateStatusSnapshot?: string;
  completionMachinePhase?: string | null;
  baselineStandingDepth?: number;
  motionDescendDetected?: boolean;
  motionBottomDetected?: boolean;
  motionRecoveryDetected?: boolean;
  shallowObservationContract?: boolean;
  baselineFrozen?: boolean;
  peakLatched?: boolean;
  eventCycleDetected?: boolean;
  eventCyclePromoted?: boolean;
  observationTruthStage?: ObservationTruthStage;
  completionBlockedReasonAuthoritative?: boolean;
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
  officialShallowPathCandidate?: boolean;
  officialShallowPathAdmitted?: boolean;
  officialShallowPathClosed?: boolean;
  officialShallowPathReason?: string | null;
  officialShallowPathBlockedReason?: string | null;
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
  liveReadinessSummaryState?: string;
  readinessStableDwellSatisfied?: boolean;
  setupMotionBlocked?: boolean;
  setupMotionBlockReason?: string | null;
  attemptStartedAfterReady?: boolean;
  successSuppressedBySetupPhase?: boolean;
  debugVersion: string;
  squatCameraObservability?: SquatCameraObservabilityExport;
}

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

const OBS_DEBUG_VERSION = 'cam27-obs-1';

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
  const relBelowSlice = relPeak == null || relPeak < SHALLOW_FLOOR;
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
  const commitDelta =
    typeof hm?.downwardCommitmentDelta === 'number' ? hm.downwardCommitmentDelta : 0;
  if (commitDelta >= 0.012 && quietEvaluatorShallow) shallowReasons.push('downward_commitment_delta');

  if (
    sc?.descendDetected &&
    sc?.recoveryDetected &&
    (quietEvaluatorShallow ||
      descentCount >= 2 ||
      (typeof hm?.firstDescentIdx === 'number' && hm.firstDescentIdx >= 0))
  ) {
    shallowReasons.push('descend_and_recovery_cycle');
  }

  if (sc?.attemptStarted === true || hm?.attemptStarted === true) {
    attemptReasons.push('attempt_started_flag');
  }
  if (sc?.descendConfirmed === true || hm?.descendConfirmed === true) {
    attemptReasons.push('descend_confirmed');
  }
  if (descentCount >= 2) attemptReasons.push('descent_count_2plus');
  if (relPeak != null && relPeak >= 0.035) attemptReasons.push('relative_depth_ge_0.035');

  return {
    shallowCandidateObserved: shallowReasons.length > 0,
    attemptLikeMotionObserved: attemptReasons.length > 0,
    shallowCandidateReasons: shallowReasons.slice(0, 8),
    attemptLikeReasons: attemptReasons.slice(0, 8),
  };
}

export function squatDownwardCommitmentReachedObservable(gate: ExerciseGateResult): boolean {
  const sc = gate.squatCycleDebug;
  const hm = readHighlighted(gate);
  if (sc?.reversalConfirmedAfterDescend) return true;
  if (sc?.downwardCommitmentAtMs != null && sc.downwardCommitmentAtMs > 0) return true;
  const d = typeof hm?.downwardCommitmentDelta === 'number' ? hm.downwardCommitmentDelta : 0;
  return d >= 0.02;
}

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
    sc?.completionBlockedReason ??
    (hm?.completionBlockedReason as string | null | undefined) ??
    null;
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
    squatCameraObservability: buildSquatCameraObservabilityExport(gate),
    debugVersion: `${OBS_DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

export function observationDedupSkip(
  list: SquatAttemptObservation[],
  next: SquatAttemptObservation
): boolean {
  if (next.eventType === 'capture_session_terminal' || next.eventType === 'shallow_observed') {
    return false;
  }
  const last = list[list.length - 1];
  if (!last || last.eventType !== next.eventType) return false;
  const prevMs = Date.parse(last.ts);
  if (Number.isNaN(prevMs)) return false;
  return Date.now() - prevMs < 140;
}

export type OverheadObservationEventType =
  | 'attempt_started'
  | 'meaningful_rise_satisfied'
  | 'top_detected'
  | 'stable_top_entered'
  | 'hold_started'
  | 'hold_satisfied'
  | 'completion_blocked_changed'
  | 'final_pass_blocked_changed'
  | 'capture_session_terminal';

export interface OverheadAttemptObservation {
  traceKind: 'attempt_observation';
  id: string;
  ts: string;
  movementType: 'overhead_reach';
  eventType: OverheadObservationEventType;
  attemptCorrelationId: string;
  captureQuality: CaptureQuality;
  confidence: number;
  gateStatusSnapshot: string;
  progressionStateSnapshot: string;
  meaningfulRiseSatisfied: boolean;
  completionBlockedReason: string | null;
  finalPassBlockedReason: string | null;
  riseStartedAtMs?: number | null;
  riseElevationDeltaFromBaseline?: number | null;
  topDetected?: boolean;
  stableTopEntered?: boolean;
  holdStarted?: boolean;
  holdSatisfied?: boolean;
  holdArmingBlockedReason?: string | null;
  completionMachinePhase?: string | null;
  captureTerminalKind?: string | null;
  priorCompletionBlockedReason?: string | null;
  priorFinalPassBlockedReason?: string | null;
  debugVersion: string;
}

const OVERHEAD_OBS_DEBUG_VERSION = 'overhead-obs-1';

export function buildOverheadAttemptObservation(
  gate: ExerciseGateResult,
  attemptCorrelationId: string,
  eventType: OverheadObservationEventType,
  options?: {
    captureTerminalKind?: string | null;
    priorCompletionBlockedReason?: string | null;
    priorFinalPassBlockedReason?: string | null;
  }
): OverheadAttemptObservation | null {
  if (gate.evaluatorResult?.stepId !== 'overhead-reach') return null;

  const hm = readHighlighted(gate);
  const riseStartedAtMs = typeof hm?.riseStartedAtMs === 'number' ? hm.riseStartedAtMs : null;
  const riseElevationDeltaFromBaseline =
    typeof hm?.riseElevationDeltaFromBaseline === 'number' ? hm.riseElevationDeltaFromBaseline : null;
  const meaningfulRiseSatisfied = hm?.meaningfulRiseSatisfied === 1;
  const topDetected = hm?.topDetected === 1;
  const stableTopEntered = hm?.stableTopEntry === 1;
  const holdStarted = hm?.holdStarted === 1;
  const holdSatisfied = hm?.holdSatisfied === 1;
  const completionBlockedReason =
    (hm?.completionBlockedReason as string | null | undefined) ?? null;
  const completionMachinePhase =
    typeof hm?.completionMachinePhase === 'string' ? hm.completionMachinePhase : null;
  const holdArmingBlockedReason =
    (hm?.holdArmingBlockedReason as string | null | undefined) ?? null;
  const finalPassBlockedReason =
    typeof gate.finalPassBlockedReason === 'string' ? gate.finalPassBlockedReason : null;

  return {
    traceKind: 'attempt_observation',
    id: `obs-oh-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    ts: new Date().toISOString(),
    movementType: 'overhead_reach',
    eventType,
    attemptCorrelationId,
    captureQuality: gate.guardrail.captureQuality,
    confidence: gate.confidence,
    gateStatusSnapshot: gate.status,
    progressionStateSnapshot: gate.progressionState,
    meaningfulRiseSatisfied,
    completionBlockedReason,
    finalPassBlockedReason,
    riseStartedAtMs: riseStartedAtMs ?? undefined,
    riseElevationDeltaFromBaseline: riseElevationDeltaFromBaseline ?? undefined,
    topDetected,
    stableTopEntered,
    holdStarted,
    holdSatisfied,
    holdArmingBlockedReason: holdArmingBlockedReason ?? undefined,
    completionMachinePhase: completionMachinePhase ?? undefined,
    captureTerminalKind: options?.captureTerminalKind ?? undefined,
    priorCompletionBlockedReason: options?.priorCompletionBlockedReason ?? undefined,
    priorFinalPassBlockedReason: options?.priorFinalPassBlockedReason ?? undefined,
    debugVersion: `${OVERHEAD_OBS_DEBUG_VERSION}:${CAMERA_DIAG_VERSION}`,
  };
}

export function overheadObservationDedupSkip(
  list: OverheadAttemptObservation[],
  next: OverheadAttemptObservation
): boolean {
  if (next.eventType === 'capture_session_terminal') return false;
  const last = list[list.length - 1];
  if (!last || last.eventType !== next.eventType) return false;
  const prevMs = Date.parse(last.ts);
  if (Number.isNaN(prevMs)) return false;
  return Date.now() - prevMs < 140;
}

export function buildTopReasons(gate: ExerciseGateResult): string[] {
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
