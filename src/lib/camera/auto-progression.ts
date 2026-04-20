import type { EvaluatorMetric, EvaluatorResult } from './evaluators/types';
import type { StepGuardrailResult } from './guardrails';
import type { PoseLandmarks } from '@/lib/motion/pose-types';
import type { PoseCaptureStats } from './use-pose-capture';
import type { CameraStepId } from '@/lib/public/camera-test';
import { buildPoseFeaturesFrames } from './pose-features';
import { getLiveReadinessSummary } from './live-readiness';
import { getSetupFramingHint } from './setup-framing';
import { runEvaluator } from './run-evaluators';
import { assessStepGuardrail } from './guardrails';
import type { SquatInternalQuality } from './squat/squat-internal-quality';
import {
  OVERHEAD_MIN_PEAK_FRAMES,
  OVERHEAD_REQUIRED_HOLD_MS,
  OVERHEAD_EASY_PASS_CONFIDENCE,
  OVERHEAD_EASY_LATCH_STABLE_FRAMES,
  OVERHEAD_EASY_MIN_PEAK_FRAMES,
} from '@/lib/camera/overhead/overhead-constants';
import {
  type SquatEvidenceLevel,
  evidenceLabelToSquatEvidenceLevel,
  squatEvidenceLevelToReasons,
  squatEvidenceLevelToConfidenceDowngradeReason,
  applySquatQualityCap,
} from './squat-evidence';
import { completionBlockedReasonToFailureTags } from './squat-retry-reason';
import {
  getSquatRawStandardCycleSignalIntegrityBlock,
  getSquatQualityOnlyWarnings,
  isSquatLowQualityPassDecoupleEligible,
  computeSquatCompletionOwnerTruth,
  resolveSquatCompletionLineageOwner,
  squatCompletionTruthPassed,
  squatPassProgressionIntegrityBlock,
  squatRetryTriggeredByPartialFramingReasons,
  type SquatPassOwner,
} from './squat/squat-progression-contract';
import type {
  ShallowAuthoritativeContractStatus,
  ShallowClosureProofTrace,
  ShallowCompletionTicket,
  ShallowNormalizedBlockerFamily,
} from './squat/squat-completion-debug-types';
import type { SquatOwnerTruthSource, SquatOwnerTruthStage } from '@/lib/camera/squat/squat-owner-trace';
import type { SquatPassCoreResult } from '@/lib/camera/squat/pass-core';
import {
  computeSquatUiProgressionLatchGate,
  type SquatUiProgressionLatchGateInput,
  type SquatUiProgressionLatchGateResult,
} from './squat/squat-ui-progression-latch-gate';

export type ExerciseProgressionState =
  | 'idle'
  | 'camera_ready'
  | 'detecting'
  | 'insufficient_signal'
  | 'capturing_valid_motion'
  | 'passed'
  | 'retry_required'
  | 'failed';

export type ExerciseGateStatus = 'pass' | 'retry' | 'fail' | 'detecting';
export type CameraGuideTone = 'neutral' | 'warning' | 'success';

/** PR G3: squat full-cycle observability (dev/debug only) */
/** PR-A4: squat completion trace + unified standing-recovered final state */
/** PR evidence: completion과 evidence strength 분리 — result layer가 입력 품질 읽기 */
/** PR-CAM-09: SquatEvidenceLevel 은 squat-evidence.ts 에 정의. 타입 re-export */
export type { SquatEvidenceLevel };

/**
 * PR-A — Final Pass Truth Surface Freeze (parent: `docs/pr/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md`).
 *
 * Canonical squat **product** pass/fail at the post-owner + UI gate layer (including
 * `applySquatFinalBlockerVetoLayer`). Same contract as `ExerciseGateResult.finalPassEligible` /
 * `progressionPassed` for squat when produced by `evaluateExerciseAutoProgress`.
 *
 * `completionTruthPassed`, `completionPassReason`, `completionBlockedReason`, and `cycleComplete`
 * are **not** this surface — they remain debug / compat sinks (PR-B may rebind consumers only).
 *
 * Additive trace fields (`finalPassTruthSource`, `motionOwnerSource`, `finalPassGrantedReason`)
 * are sink-only and must **never** be read as gate inputs.
 */
export interface SquatFinalPassTruthSurface {
  finalPassGranted: boolean;
  finalPassBlockedReason: string | null;
  finalPassTruthSource: 'post_owner_ui_gate';
  motionOwnerSource: 'pass_core' | 'completion_state' | 'none';
  /** Additive trace only — not a gate input. */
  finalPassGrantedReason: string | null;
}

export interface SquatCycleDebug {
  armingSatisfied: boolean;
  currentSquatPhase?:
    | 'idle'
    | 'armed'
    | 'descending'
    | 'committed_bottom_or_downward_commitment'
    | 'ascending'
    | 'standing_recovered';
  attemptStarted?: boolean;
  startPoseSatisfied: boolean;
  startBeforeBottom: boolean;
  descendDetected: boolean;
  bottomDetected: boolean;
  bottomTurningPointDetected: boolean;
  ascendDetected: boolean;
  recoveryDetected: boolean;
  cycleComplete: boolean;
  completionStatus: string;
  depthBand: 'shallow' | 'moderate' | 'deep';
  passBlockedReason: string | null;
  qualityInterpretationReason: string | null;
  passTriggeredAtPhase?: string;
  completionPathUsed?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  completionRejectedReason?: string | null;
  completionBlockedReason?: string | null;
  evidenceLabel?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  ultraLowRomCandidate?: boolean;
  ultraLowRomGuardPassed?: boolean;
  ultraLowRomRejectReason?: string | null;
  /** PR-A6: standing false positive trace */
  standingStillRejected?: boolean;
  falsePositiveBlockReason?: string | null;
  descendConfirmed?: boolean;
  ascendConfirmed?: boolean;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  minimumCycleDurationSatisfied?: boolean;
  /**
   * PR-01: 캡처 세션 arming — stats.captureDurationMs >= SQUAT_ARMING_MS.
   * latch/UI 타이밍 정본(모션 cycleDurationMs 와 혼동 금지).
   */
  captureArmingSatisfied?: boolean;
  /**
   * PR-CAM-29A: completion truth 는 유지된 채 SQUAT_ARMING_MS 미달로 final pass 만 막을 때.
   * completion-state·blockedReason 체계는 불변 — auto-progression 트레이스 전용.
   */
  finalPassTimingBlockedReason?: string | null;
  standardPathBlockedReason?: string | null;
  ultraLowRomPathDisabledOrGuarded?: boolean;
  descendStartAtMs?: number;
  downwardCommitmentAtMs?: number;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendStartAtMs?: number;
  recoveryAtMs?: number;
  standingRecoveredAtMs?: number;
  standingRecoveryHoldMs?: number;
  standingRecoveryFrameCount?: number;
  standingRecoveryMinFramesUsed?: number;
  standingRecoveryMinHoldMsUsed?: number;
  standingRecoveryBand?: 'standard' | 'low_rom' | 'ultra_low_rom' | 'insufficient_signal';
  standingRecoveryFinalizeReason?: string | null;
  successPhaseAtOpen?: 'standing_recovered';
  cycleDurationMs?: number;
  downwardCommitmentDelta?: number;
  /** PR evidence: completion과 분리된 evidence layer */
  squatEvidenceLevel?: SquatEvidenceLevel;
  squatEvidenceReasons?: string[];
  cycleProofPassed?: boolean;
  romBand?: 'shallow' | 'moderate' | 'deep';
  confidenceDowngradeReason?: string | null;
  insufficientSignalReason?: string | null;
  /** PR squat-low-rom: trace — why low/ultra-low path blocked */
  lowRomRejectionReason?: string | null;
  ultraLowRomRejectionReason?: string | null;
  recoveryReturnContinuityFrames?: number;
  recoveryTrailingDepthCount?: number;
  recoveryDropRatio?: number;
  /** PR shallow: guardrail partial 시 이유 (guardrail_not_complete일 때) */
  guardrailPartialReason?: string;
  /** PR shallow: guardrail complete 시 경로 */
  guardrailCompletePath?: string;
  /** PR-COMP-01: 명시적 completion 상태기계 단계(트레이스) */
  completionMachinePhase?: string;
  /** PR-COMP-01: 통과 ROM 사이클 분류 */
  completionPassReason?: string;
  /** PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04: 공식 shallow 권위 종료(관측) — runtime 인접 */
  ownerAuthoritativeShallowClosureSatisfied?: boolean;

  /**
   * PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04 — PRIMARY_CANONICAL (shallow debug SSOT).
   * Gate 직접 입력 아님. `deriveCanonicalShallowCompletionContract` / closer 스탬프 pass-through.
   */
  canonicalShallowContractClosureApplied?: boolean;
  canonicalShallowContractClosureSource?: string | null;
  canonicalShallowContractEligible?: boolean;
  canonicalShallowContractAdmissionSatisfied?: boolean;
  canonicalShallowContractAttemptSatisfied?: boolean;
  canonicalShallowContractReversalEvidenceSatisfied?: boolean;
  canonicalShallowContractRecoveryEvidenceSatisfied?: boolean;
  canonicalShallowContractAntiFalsePassClear?: boolean;
  canonicalShallowContractSatisfied?: boolean;
  canonicalShallowContractStage?: string;
  canonicalShallowContractBlockedReason?: string | null;
  canonicalShallowContractAuthoritativeClosureWouldBeSatisfied?: boolean;
  canonicalShallowContractProvenanceOnlySignalPresent?: boolean;
  canonicalShallowContractSplitBrainDetected?: boolean;
  canonicalShallowContractTrace?: string;

  /**
   * PR-D — SECONDARY_DEBUG_USEFUL: owner trace, product policy projection, trajectory evidence.
   * evaluator late-setup 등이 읽을 수 있음 — 필드 제거 금지.
   */
  ownerTruthSource?: SquatOwnerTruthSource;
  ownerTruthStage?: SquatOwnerTruthStage;
  ownerTruthBlockedBy?: string | null;
  ultraLowPolicyScope?: boolean;
  ultraLowPolicyDecisionReady?: boolean;
  ultraLowPolicyBlocked?: boolean;
  ultraLowPolicyTrace?: string;
  /** PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05 */
  shallowTrajectoryBridgeEligible?: boolean;
  shallowTrajectoryBridgeSatisfied?: boolean;
  shallowTrajectoryBridgeBlockedReason?: string | null;
  /** PR-CAM-SHALLOW-CLOSURE-PROOF-NORMALIZE-06 */
  guardedShallowTrajectoryClosureProofSatisfied?: boolean;
  guardedShallowTrajectoryClosureProofBlockedReason?: string | null;
  /** PR-07: 브리지용 국소 shallow 피크 앵커(입장·검색 시에만) */
  guardedShallowLocalPeakFound?: boolean;
  guardedShallowLocalPeakBlockedReason?: string | null;
  guardedShallowLocalPeakIndex?: number | null;

  /**
   * PR-D — LEGACY_COMPAT: PR-ALIGN-01 / PR-2 / pre-canonical closure trace. 새 디버그는 canonical* 우선.
   * @deprecated 필드는 `SquatCompletionState` JSDoc 과 동일 정책(compat 유지).
   */
  shallowAuthoritativeClosureReason?: string | null;
  shallowAuthoritativeClosureBlockedReason?: string | null;
  shallowAuthoritativeStage?:
    | 'pre_attempt'
    | 'admission_blocked'
    | 'reversal_blocked'
    | 'policy_blocked'
    | 'standing_finalize_blocked'
    | 'closed';
  shallowObservationLayerReversalTruth?: boolean;
  shallowAuthoritativeReversalTruth?: boolean;
  shallowObservationLayerRecoveryTruth?: boolean;
  shallowAuthoritativeRecoveryTruth?: boolean;
  shallowProvenanceOnlyReversalEvidence?: boolean;
  truthMismatch_reversalTopVsCompletion?: boolean;
  truthMismatch_recoveryTopVsCompletion?: boolean;
  truthMismatch_shallowAdmissionVsClosure?: boolean;
  truthMismatch_provenanceReversalWithoutAuthoritative?: boolean;
  truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery?: boolean;
  shallowNormalizedBlockerFamily?: ShallowNormalizedBlockerFamily;
  shallowAuthoritativeContractStatus?: ShallowAuthoritativeContractStatus;
  shallowContractAuthoritativeClosure?: boolean;
  shallowContractAuthorityTrace?: string;

  /** PR-CAM-AUTHORITATIVE-REVERSAL-SPLIT-02 — pass-through only */
  ownerAuthoritativeReversalSatisfied?: boolean;
  ownerAuthoritativeRecoverySatisfied?: boolean;
  provenanceReversalEvidencePresent?: boolean;
  /** PR-CAM-STANDING-FINALIZE-TIMING-NORMALIZE-03 — pass-through */
  standingFinalizeSatisfied?: boolean;
  standingFinalizeSuppressedByLateSetup?: boolean;
  standingFinalizeReadyAtMs?: number | null;
  /** PR-CAM-SHALLOW-PROOF-TRACE-11: shallow closure proof 생성·소비 관측(게이트 미사용) */
  shallowClosureProofTrace?: ShallowClosureProofTrace;
  /** PR-CAM-SHALLOW-PROOF-TRACE-11: 한 줄 JSON 요약 — 전체는 shallowClosureProofTrace */
  shallowClosureProofTraceSummary?: {
    stage?: string;
    eligible?: boolean;
    satisfied?: boolean;
    blockedReason?: string | null;
    proofBlockedReason?: string | null;
    consumptionBlockedReason?: string | null;
    firstDecisiveBlockedReason?: string | null;
  };
  /** PR-CAM-SHALLOW-TICKET-UNIFICATION-12: 단일 shallow 완료 티켓 */
  shallowCompletionTicket?: ShallowCompletionTicket;
  shallowCompletionTicketSatisfied?: boolean;
  shallowCompletionTicketBlockedReason?: string | null;
  shallowCompletionTicketStage?: string | null;

  /** PR-COMP-03: completion·pass와 무관한 strict 내부 해석(트레이스 전용) */
  squatInternalQuality?: SquatInternalQuality;
  /** PR-CAM-10: ambiguous retry / severe-fail 완화 계약 관측 */
  squatRetryContractObservation?: {
    severeFailSoftenedToRetry?: boolean;
    fallbackUsed?: 'weak_cycle_retry_instead_of_survey_fail';
  };
  /**
   * PR-HMM-01B: shadow decoder trace — debug/observability only.
   * pass/retry/fail gate에 사용 금지.
   */
  hmmConfidence?: number;
  hmmCompletionCandidate?: boolean;
  hmmDominantPath?: string;
  /** PR-HMM-02B: HMM blocked-reason assist — trace only, pass gate 변경 없음 */
  hmmAssistEligible?: boolean;
  hmmAssistApplied?: boolean;
  hmmAssistReason?: string | null;
  /** PR-HMM-03A: calibration trace — pass 로직 미사용 */
  ruleCompletionBlockedReason?: string | null;
  postAssistCompletionBlockedReason?: string | null;
  assistSuppressedByFinalize?: boolean;
  hmmExcursion?: number | null;
  hmmTransitionCount?: number | null;
  /** PR-HMM-04A: HMM arming assist — trace only */
  hmmArmingAssistEligible?: boolean;
  hmmArmingAssistApplied?: boolean;
  hmmArmingAssistReason?: string | null;
  effectiveArmed?: boolean;
  /** PR-HMM-04B: reversal assist — trace only */
  hmmReversalAssistEligible?: boolean;
  hmmReversalAssistApplied?: boolean;
  hmmReversalAssistReason?: string | null;
  /** PR-04E2: completion-state reversal 확인 — trace only */
  reversalConfirmedBy?: string | null;
  reversalDepthDrop?: number | null;
  reversalFrameCount?: number | null;
  /** PR-04D1: pass vs capture-quality 분리 관측 (completion 계산 변경 없음) */
  completionTruthPassed?: boolean;
  qualityOnlyWarnings?: string[];
  /** PR-CAM-OWNER-FREEZE-01: resolveSquatPassOwner 와 동일(레거시 필드명 유지) */
  passOwner?: SquatPassOwner;
  /** PR-CAM-OWNER-FREEZE-01: 최종 성공 오너 — passOwner 와 동일 값 */
  finalSuccessOwner?: SquatPassOwner;
  /** completion truth 가 standard_cycle 인 경우(디커플·gate와 무관한 밴드 관측) */
  standardOwnerEligible?: boolean;
  /** completion truth 가 low/ultra_low event cycle 인 경우(shadow promote 와 별개) */
  shadowEventOwnerEligible?: boolean;
  ownerFreezeVersion?: string;
  lowQualityPassAllowed?: boolean;
  /** PR-01: completion truth 전용 owner(캡처·confidence·passConfirm·integrity 미포함) */
  completionOwnerPassed?: boolean;
  completionOwnerReason?: string | null;
  completionOwnerBlockedReason?: string | null;
  /** PR-01: UI latch / progression gate(오너 통과 후 신호·확인·차단) */
  uiProgressionAllowed?: boolean;
  uiProgressionBlockedReason?: string | null;
  /** Setup false-pass lock: getLiveReadinessSummary.state 미러(래치·트레이스 정렬) */
  liveReadinessSummaryState?: 'not_ready' | 'ready' | 'success';
  readinessStableDwellSatisfied?: boolean;
  setupMotionBlocked?: boolean;
  setupMotionBlockReason?: string | null;
  attemptStartedAfterReady?: boolean;
  /** completion owner 통과했으나 setup/readiness 게이트로 UI pass 가 막힌 경우 */
  successSuppressedBySetupPhase?: boolean;
  /** PR-04E1: depth/arming 입력 관측 */
  armingDepthSource?: string | null;
  armingDepthPeak?: number | null;
  squatDepthPeakPrimary?: number | null;
  squatDepthPeakBlended?: number | null;
  armingDepthBlendAssisted?: boolean;
  /** PR-CAM-27 폴백 arm — completion arming contract */
  armingFallbackUsed?: boolean;
  /** PR-04E3A: completion relative depth 스트림 — trace only */
  relativeDepthPeakSource?: string | null;
  rawDepthPeakPrimary?: number | null;
  rawDepthPeakBlended?: number | null;
  /** PR-04E3B: baseline freeze / peak latch / event-cycle owner 관측 */
  baselineFrozen?: boolean;
  baselineFrozenDepth?: number | null;
  peakLatched?: boolean;
  peakLatchedAtIndex?: number | null;
  /** PR-CAM-PEAK-ANCHOR-INTEGRITY-02: completion-state peak anchor truth — 관측만 */
  peakAnchorTruth?: 'committed_or_post_commit_peak';
  eventCycleDetected?: boolean;
  eventCycleBand?: string | null;
  /** PR-SETUP-SERIES-START-01: detectSquatEventCycle notes — final gate 시그니처 전용(관측) */
  eventCycleNotes?: string[];
  eventCyclePromoted?: boolean;
  eventCycleSource?: string | null;
  /** PR-CAM-CORE: completion-state trajectory descent 폴백 — trace 전용 */
  eventBasedDescentPath?: boolean;
  /** PR-DOWNUP-GUARANTEE-03: ultra-shallow meaningful down-up rescue — trace only */
  ultraShallowMeaningfulDownUpRescueApplied?: boolean;

  /**
   * PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01: stale-rep observability.
   * true when the pass-core result was suppressed because it belonged to a prior rep
   * (passCore.standingRecoveredAtMs was before the current completion window).
   * Sink-only — must NOT be read as a gate input.
   */
  passCoreStale?: boolean;
  /**
   * Rep identity observability: repId from the stale-guarded pass-core result.
   * Non-null only when passCore.passDetected=true (same-rep pass confirmed).
   * Sink-only.
   */
  passCoreRepId?: string | null;
  /**
   * PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01: same-rep split observability.
   * true when pass-core is detected (not stale) for the current rep but the
   * completion owner is not satisfied — indicates a residual cross-layer split.
   * This mismatch must be explicit and never silently hidden.
   * Sink-only — must NOT be read as a gate input.
   */
  passCoreRepIdentityMismatch?: boolean;
  /**
   * PR-RF-STRUCT-12: current-rep owner-read trace — rep consistency verification.
   * Exposes readSquatCurrentRepPassTruth() result for real-device diagnostics.
   * Sink-only — must NOT be read as a gate input.
   */
  squatOwnerRead?: {
    repId: string | null;
    ownerPassEligible: boolean;
    ownerBlockedReason: string | null;
    ownerSource: 'pass_core' | 'completion_state' | 'none';
    timestampsConsistent: boolean;
    reboundAtRepBoundary: boolean;
  };
  /**
   * PR-A: mirrors `computeSquatPostOwnerPreLatchGateLayer().squatFinalPassTruth` for the same frame.
   * Sink-only — must not be read as a gate input.
   */
  squatFinalPassTruth?: SquatFinalPassTruthSurface;
}

export interface ExerciseGateResult {
  status: ExerciseGateStatus;
  progressionState: ExerciseProgressionState;
  confidence: number;
  completionSatisfied: boolean;
  nextAllowed: boolean;
  flags: string[];
  reasons: string[];
  failureReasons: string[];
  userGuidance: string[];
  retryRecommended: boolean;
  evaluatorResult: EvaluatorResult;
  guardrail: StepGuardrailResult;
  uiMessage: string;
  autoAdvanceDelayMs: number;
  passConfirmationSatisfied: boolean;
  passConfirmationFrameCount: number;
  passConfirmationWindowCount: number;
  /** PR G3: squat cycle state (set only when stepId === 'squat') */
  squatCycleDebug?: SquatCycleDebug;
  /**
   * PR-CAM-17: final pass 체인 가시성.
   * - finalPassEligible: 현재 프레임에서 final pass가 허용되는지 여부.
   * - finalPassBlockedReason: null이면 pass 가능. 아니면 pass를 막는 단계 이름.
   */
  finalPassEligible: boolean;
  finalPassBlockedReason: string | null;
}

const REQUIRED_STABLE_FRAMES = 3;

type SquatCompletionState = NonNullable<NonNullable<EvaluatorResult['debug']>['squatCompletionState']>;
type SquatUiGate = SquatUiProgressionLatchGateResult;
type SquatOwnerTruth = ReturnType<typeof computeSquatCompletionOwnerTruth>;
type SquatPassOwnerTruthReadInput = {
  squatCompletionState: SquatCompletionState | undefined;
  squatPassCore: SquatPassCoreResult | undefined;
};
type SquatSetupPhaseTrace = {
  readinessStableDwellSatisfied?: boolean;
  setupMotionBlocked?: boolean;
  setupMotionBlockReason?: string | null;
  attemptStartedAfterReady?: boolean;
};
type SquatReadinessSetupRoutedSources = {
  readinessStableDwellSatisfied: boolean | undefined;
  setupMotionBlocked: boolean;
  setupMotionBlockReason: string | null | undefined;
  attemptStartedAfterReady: boolean | undefined;
  liveReadinessNotReady: boolean;
  liveReadinessSummaryState: ReturnType<typeof getLiveReadinessSummary>['state'];
};
type SquatPostOwnerPreLatchGateLayer = {
  ownerTruth: SquatOwnerTruth;
  uiGate: SquatUiGate;
  progressionPassed: boolean;
  finalPassBlockedReason: string | null;
  /** PR-A: frozen product pass surface — `progressionPassed === squatFinalPassTruth.finalPassGranted`. */
  squatFinalPassTruth: SquatFinalPassTruthSurface;
};

/**
 * PR-RF-STRUCT-12: Typed current-rep pass truth adapter.
 *
 * Single downstream read boundary for squat final gating.
 * Exposes one coherent current-rep payload:
 *   - passEligible: pass-core truth (primary) or completion-state truth (fallback)
 *   - rep-bound timestamps from the authoritative source
 *   - ownerSource: which authority drove the result
 *   - timestampsConsistent: whether all timestamps belong to the same rep
 *
 * Downstream gates must use this adapter, not scattered completion-state fields.
 */
export interface SquatCurrentRepPassTruth {
  repId: string | null;
  passEligible: boolean;
  blockedReason: string | null;
  ownerSource: 'pass_core' | 'completion_state' | 'none';
  descendStartAtMs?: number;
  peakAtMs?: number;
  committedAtMs?: number;
  reversalAtMs?: number;
  ascendStartAtMs?: number;
  standingRecoveredAtMs?: number;
  currentPhase?: string;
  evidenceLabel?: string;
  completionMachinePhase?: string;
  /** True when all rep-bound timestamps belong to the same rep identity. */
  timestampsConsistent: boolean;
}

export function readSquatCurrentRepPassTruth(input: {
  squatPassCore: SquatPassCoreResult | undefined;
  squatCompletionState: SquatCompletionState | undefined;
}): SquatCurrentRepPassTruth {
  const { squatPassCore: pc, squatCompletionState: cs } = input;

  if (pc != null) {
    // pass-core is the single motion truth; use its timestamps as rep-bound anchors.
    const commonFields = {
      ownerSource: 'pass_core' as const,
      descendStartAtMs: pc.descentStartAtMs,
      peakAtMs: pc.peakAtMs,
      committedAtMs: undefined,  // pass-core does not expose committedAtMs
      reversalAtMs: pc.reversalAtMs,
      ascendStartAtMs: undefined,  // pass-core does not expose ascendStartAtMs
      standingRecoveredAtMs: pc.standingRecoveredAtMs,
      currentPhase: cs?.currentSquatPhase,
      evidenceLabel: cs?.evidenceLabel,
      completionMachinePhase: cs?.completionMachinePhase,
      timestampsConsistent: true,  // pass-core algorithms guarantee same-rep timestamps
    };
    if (pc.passDetected === true) {
      return { repId: pc.repId ?? null, passEligible: true, blockedReason: null, ...commonFields };
    }
    return {
      repId: null,
      passEligible: false,
      blockedReason: pc.passBlockedReason ?? 'pass_core_not_detected',
      ...commonFields,
    };
  }

  // Fallback: no pass-core — use completion-state owner truth.
  if (cs == null) {
    return {
      repId: null,
      passEligible: false,
      blockedReason: 'no_squat_state',
      ownerSource: 'none',
      timestampsConsistent: false,
    };
  }

  const completionOwnerTruth = computeSquatCompletionOwnerTruth({ squatCompletionState: cs });
  // Timestamps are consistent when they coherently represent one attempt:
  // peak before committed, committed before reversal, reversal before standing.
  const peakTs = cs.peakAtMs;
  const revTs = cs.reversalAtMs;
  const standTs = cs.standingRecoveredAtMs;
  const timestampsConsistent =
    (peakTs == null || revTs == null || peakTs < revTs) &&
    (revTs == null || standTs == null || revTs < standTs) &&
    cs.attemptStarted === true;

  return {
    repId: cs.standingRecoveredAtMs != null ? `rep_${cs.standingRecoveredAtMs}` : null,
    passEligible: completionOwnerTruth.completionOwnerPassed,
    blockedReason: completionOwnerTruth.completionOwnerBlockedReason,
    ownerSource: 'completion_state',
    descendStartAtMs: cs.descendStartAtMs,
    peakAtMs: cs.peakAtMs,
    committedAtMs: cs.committedAtMs,
    reversalAtMs: cs.reversalAtMs,
    ascendStartAtMs: cs.ascendStartAtMs,
    standingRecoveredAtMs: cs.standingRecoveredAtMs,
    currentPhase: cs.currentSquatPhase,
    evidenceLabel: cs.evidenceLabel,
    completionMachinePhase: cs.completionMachinePhase,
    timestampsConsistent,
  };
}

/**
 * PR-A: single builder for the frozen squat final-pass **product** truth surface.
 * `motionOwnerSource` is additive trace only (from `readSquatCurrentRepPassTruth`) — not a gate input.
 */
export function buildSquatFinalPassTruthSurface(input: {
  finalPassBlockedReason: string | null;
  motionOwnerSource: 'pass_core' | 'completion_state' | 'none';
}): SquatFinalPassTruthSurface {
  const granted = input.finalPassBlockedReason == null;
  return {
    finalPassGranted: granted,
    finalPassBlockedReason: input.finalPassBlockedReason,
    finalPassTruthSource: 'post_owner_ui_gate',
    motionOwnerSource: input.motionOwnerSource,
    finalPassGrantedReason: granted ? 'post_owner_final_pass_clear' : null,
  };
}

/**
 * PR-RF-STRUCT-12: pass-core-first owner truth.
 *
 * When pass-core provides a result, it is the sole motion truth.
 * Completion-state must not veto a pass-core-confirmed rep.
 *
 * completionOwnerReason === 'pass_core_detected' signals that pass-core drove this result
 * and downstream contradiction checks (cycleComplete, completionTruthPassed) must be skipped.
 */
export function readSquatPassOwnerTruth(
  input: SquatPassOwnerTruthReadInput
): SquatOwnerTruth {
  const { squatCompletionState: cs, squatPassCore } = input;

  // RF-STRUCT-12: pass-core is the primary motion truth.
  // When it has a definitive result, return it directly — do NOT gate on completion-state first.
  if (squatPassCore != null) {
    if (squatPassCore.passDetected === true) {
      return {
        completionOwnerPassed: true,
        completionOwnerReason: 'pass_core_detected',
        completionOwnerBlockedReason: null,
      };
    }
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason:
        squatPassCore.passBlockedReason ?? 'pass_core_not_detected',
    };
  }

  // Fallback: no pass-core available — use completion owner truth.
  const completionOwnerTruth = computeSquatCompletionOwnerTruth({
    squatCompletionState: cs,
  });

  if (completionOwnerTruth.completionOwnerPassed !== true) {
    return completionOwnerTruth;
  }

  if (completionOwnerTruth.completionOwnerReason === 'not_confirmed') {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'completion_owner_reason_not_confirmed',
    };
  }

  return {
    completionOwnerPassed: true,
    completionOwnerReason: completionOwnerTruth.completionOwnerReason,
    completionOwnerBlockedReason: null,
  };
}

export function enforceSquatOwnerContradictionInvariant(input: {
  ownerTruth: SquatOwnerTruth;
  squatCompletionState: SquatCompletionState | undefined;
}): SquatOwnerTruth {
  const { ownerTruth, squatCompletionState } = input;
  if (ownerTruth.completionOwnerPassed !== true) return ownerTruth;

  // RF-STRUCT-12: when pass-core drove the owner truth, skip completion-state
  // contradiction checks — pass-core already enforces same-rep invariants internally.
  if (ownerTruth.completionOwnerReason === 'pass_core_detected') {
    return ownerTruth;
  }

  if (ownerTruth.completionOwnerReason === 'not_confirmed') {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'owner_contradiction:not_confirmed_reason',
    };
  }
  if (ownerTruth.completionOwnerBlockedReason != null) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'owner_contradiction:blocked_reason_with_passed_owner',
    };
  }
  if (squatCompletionState?.cycleComplete !== true) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'owner_contradiction:cycle_not_complete',
    };
  }
  return ownerTruth;
}

function readSquatSetupTruthWithCompatFallback(input: {
  squatSetupPhaseTrace: SquatSetupPhaseTrace | undefined;
  squatCompletionState: SquatCompletionState | undefined;
}): Pick<
  SquatReadinessSetupRoutedSources,
  | 'readinessStableDwellSatisfied'
  | 'setupMotionBlocked'
  | 'setupMotionBlockReason'
  | 'attemptStartedAfterReady'
> {
  const { squatSetupPhaseTrace, squatCompletionState } = input;
  return {
    readinessStableDwellSatisfied:
      squatSetupPhaseTrace?.readinessStableDwellSatisfied ??
      squatCompletionState?.readinessStableDwellSatisfied,
    setupMotionBlocked:
      squatSetupPhaseTrace?.setupMotionBlocked ??
      squatCompletionState?.setupMotionBlocked ??
      false,
    setupMotionBlockReason:
      squatSetupPhaseTrace?.setupMotionBlockReason ??
      squatCompletionState?.setupMotionBlockReason,
    attemptStartedAfterReady:
      squatSetupPhaseTrace?.attemptStartedAfterReady ??
      squatCompletionState?.attemptStartedAfterReady,
  };
}

function resolveSquatReadinessSetupGateInputs(input: {
  landmarks: PoseLandmarks[];
  guardrail: StepGuardrailResult;
  squatSetupPhaseTrace: SquatSetupPhaseTrace | undefined;
  squatCompletionState: SquatCompletionState | undefined;
}): SquatReadinessSetupRoutedSources {
  const setupTruth = readSquatSetupTruthWithCompatFallback({
    squatSetupPhaseTrace: input.squatSetupPhaseTrace,
    squatCompletionState: input.squatCompletionState,
  });
  const liveReadinessSummary = getLiveReadinessSummary({
    success: false,
    guardrail: input.guardrail,
    framingHint: getSetupFramingHint(input.landmarks),
  });
  return {
    ...setupTruth,
    liveReadinessNotReady: liveReadinessSummary.state === 'not_ready',
    liveReadinessSummaryState: liveReadinessSummary.state,
  };
}

export function isGatePassReady(
  gate: Pick<
    ExerciseGateResult,
    'status' | 'nextAllowed' | 'completionSatisfied' | 'passConfirmationSatisfied'
  >
): boolean {
  return (
    gate.status === 'pass' &&
    gate.nextAllowed &&
    gate.completionSatisfied &&
    gate.passConfirmationSatisfied
  );
}

/**
 * Strict success contract: success UI, tone, and auto-advance must depend ONLY on this.
 * Aligned with progressionPassed: captureQuality 'low' and unstable_frame_timing must NOT
 * block final latch when passConfirmed (completionSatisfied + passConfirmationSatisfied) is true.
 *
 * PR-A (squat): when `gate.finalPassEligible` is present, latch **equals** the frozen post-owner
 * final-pass surface from `evaluateExerciseAutoProgress` — it does not independently read
 * `completionTruthPassed`, `completionBlockedReason`, or `cycleComplete`. Partial gate snapshots
 * that omit `finalPassEligible` keep a narrow historical UI-gate compat path (tests only); real
 * product frames must carry `finalPassEligible`.
 */
export function isFinalPassLatched(
  stepId: CameraStepId,
  gate: Pick<
    ExerciseGateResult,
    | 'completionSatisfied'
    | 'confidence'
    | 'passConfirmationSatisfied'
    | 'passConfirmationFrameCount'
    | 'guardrail'
    | 'evaluatorResult'
    | 'squatCycleDebug'
    | 'finalPassEligible'
    | 'finalPassBlockedReason'
  >
): boolean {
  if (stepId === 'overhead-reach') {
    // PR-12A: Hold authority defense-in-depth.
    // completionSatisfied already requires simplePassHoldMs >= 1000 and
    // simplePassHoldArmingBlockedReason === null. This explicit guard is a
    // second wall: latch can NEVER open if the evaluator reports hold < 1000ms
    // or hold arming was blocked (settle_not_reached / no_top_detected).
    const { simplePassHoldMs, holdArmingBlocked } = getOverheadSimplePassHoldState(
      gate.evaluatorResult
    );
    if (simplePassHoldMs < 1000 || holdArmingBlocked) return false;

    return (
      gate.completionSatisfied === true &&
      gate.guardrail.captureQuality !== 'invalid' &&
      gate.passConfirmationSatisfied === true &&
      gate.passConfirmationFrameCount >= REQUIRED_STABLE_FRAMES
    );
  }

  /**
   * CAM-25 + PR-CAM-CORE-PASS-REASON-ALIGN-01: shallow ROM 완료(low/ultra × cycle/event)는 easy-only branch.
   * currentSquatPhase === 'standing_recovered' 는 reversal·ascend·recovery 전체를 함의한다.
   * standard_cycle(깊은 스쿼트)은 기존 임계(0.62)를 그대로 사용.
   *
   * PR-A: primary latch input is `finalPassEligible` (same surface as `progressionPassed` /
   * `squatFinalPassTruth.finalPassGranted` for frames produced by the squat auto-progress path).
   */
  if (stepId === 'squat') {
    if (typeof gate.finalPassEligible === 'boolean') {
      return gate.finalPassEligible === true;
    }
    // Partial snapshots (e.g. structural smoke) may omit both `finalPassEligible` and evaluator debug.
    if (gate.evaluatorResult?.debug == null) {
      return false;
    }
    const cs = gate.evaluatorResult.debug?.squatCompletionState;
    const passReason = cs?.completionPassReason;
    const captureArmingOk =
      gate.squatCycleDebug?.captureArmingSatisfied !== undefined
        ? gate.squatCycleDebug.captureArmingSatisfied === true
        : squatMinimumCycleOkForFinalPass(gate.evaluatorResult, gate.squatCycleDebug);
    const ownerTruth = readSquatPassOwnerTruth({
      squatCompletionState: cs,
      squatPassCore: gate.evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined,
    });
    if (!ownerTruth.completionOwnerPassed) return false;
    const severeInvalid = isSevereInvalid(gate.guardrail);
    const squatDecoupleLatch = isSquatLowQualityPassDecoupleEligible({
      stepId: 'squat',
      completionSatisfied: gate.completionSatisfied === true,
      completionPassReason: passReason,
      guardrail: gate.guardrail,
      severeInvalid,
      effectivePassConfirmation: gate.passConfirmationSatisfied === true,
    });
    const rawIntegrityLatch = getSquatRawStandardCycleSignalIntegrityBlock(
      gate.completionSatisfied === true,
      gate.guardrail,
      gate.evaluatorResult
    );
    const integrityForPassLatch = squatPassProgressionIntegrityBlock(
      rawIntegrityLatch,
      squatDecoupleLatch
    );
    const squatPassThresholds = getSquatPassThresholds(
      gate.completionSatisfied === true,
      passReason,
      cs?.currentSquatPhase
    );
    const reasons = getCommonReasons(gate.evaluatorResult, gate.guardrail);
    const hardBlockers = getHardBlockerReasons('squat', gate.guardrail);
    const guardrailCompleteForLatch =
      gate.guardrail.completionStatus === 'complete' || gate.guardrail.completionStatus == null;
    const scDbg = gate.squatCycleDebug;
    const setupTrace = (
      gate.evaluatorResult.debug as { squatSetupPhaseTrace?: SquatSetupPhaseTrace } | undefined
    )?.squatSetupPhaseTrace;
    const setupTruthForLatch = readSquatSetupTruthWithCompatFallback({
      squatSetupPhaseTrace: setupTrace,
      squatCompletionState: cs,
    });
    const uiGate = computeSquatUiProgressionLatchGate(
      buildSquatUiProgressionLatchGateInput({
        completionOwnerPassed: ownerTruth.completionOwnerPassed,
        guardrailCompletionComplete: guardrailCompleteForLatch,
        captureQualityInvalid: gate.guardrail.captureQuality === 'invalid',
        confidence: gate.confidence,
        passThresholdEffective: squatPassThresholds.confidenceThreshold,
        effectivePassConfirmation: gate.passConfirmationSatisfied === true,
        passConfirmationFrameCount: gate.passConfirmationFrameCount,
        framesReq: squatPassThresholds.stableFramesRequired,
        captureArmingSatisfied: captureArmingOk,
        squatIntegrityBlockForPass: integrityForPassLatch,
        reasons,
        hardBlockerReasons: hardBlockers,
        liveReadinessNotReady: scDbg?.liveReadinessSummaryState === 'not_ready',
        readinessStableDwellSatisfied: setupTruthForLatch.readinessStableDwellSatisfied,
        setupMotionBlocked: setupTruthForLatch.setupMotionBlocked,
      })
    );
    /**
     * PR-A: production frames always carry `finalPassEligible` from `evaluateExerciseAutoProgress` and use the branch
     * above. This branch remains for **partial gate snapshots** (tests, structural mocks) that omit that field; it
     * intentionally mirrors the historical latch helper (UI gate only) to avoid regressing script fixtures.
     * Do not treat this path as the canonical product surface — prefer `finalPassEligible` on real gates.
     */
    return uiGate.uiProgressionAllowed;
  }

  const passThreshold = BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  return (
    gate.completionSatisfied === true &&
    gate.guardrail.captureQuality !== 'invalid' &&
    gate.confidence >= passThreshold &&
    gate.passConfirmationSatisfied === true &&
    gate.passConfirmationFrameCount >= REQUIRED_STABLE_FRAMES
  );
}

export function getCameraGuideTone(
  gate: Pick<
    ExerciseGateResult,
    'status' | 'progressionState' | 'nextAllowed' | 'completionSatisfied' | 'passConfirmationSatisfied'
  >
): CameraGuideTone {
  if (isGatePassReady(gate) || gate.progressionState === 'passed') {
    return 'success';
  }

  if (
    gate.status === 'retry' ||
    gate.status === 'fail' ||
    gate.progressionState === 'retry_required' ||
    gate.progressionState === 'insufficient_signal' ||
    gate.progressionState === 'failed'
  ) {
    return 'warning';
  }

  return 'neutral';
}

const AUTO_ADVANCE_DELAY_MS: Record<CameraStepId, number> = {
  squat: 700,
  'overhead-reach': 700,
  'wall-angel': 700,
  'single-leg-balance': 900,
};

const BASIC_PASS_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.62,
  'overhead-reach': 0.72,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

const STRONG_QUALITY_CONFIDENCE_THRESHOLD: Record<CameraStepId, number> = {
  squat: 0.78,
  'overhead-reach': 0.78,
  'wall-angel': 0.76,
  'single-leg-balance': 0.8,
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMetricValue(metrics: EvaluatorMetric[] | undefined, name: string): number | null {
  const metric = metrics?.find((item) => item.name === name);
  return typeof metric?.value === 'number' ? metric.value : null;
}

function getHighlightedMetric(result: EvaluatorResult, key: string): number {
  const value = result.debug?.highlightedMetrics?.[key];
  return typeof value === 'number' ? value : 0;
}

function getOverheadSimplePassHoldState(result: EvaluatorResult): {
  simplePassHoldMs: number;
  holdArmingBlocked: boolean;
} {
  const hm = result.debug?.highlightedMetrics;
  return {
    simplePassHoldMs: typeof hm?.simplePassHoldMs === 'number' ? hm.simplePassHoldMs : 0,
    holdArmingBlocked:
      hm?.simplePassHoldArmingBlockedReason != null &&
      hm.simplePassHoldArmingBlockedReason !== null,
  };
}

function hasAnyReason(reasons: string[], includes: string[]): boolean {
  return includes.some((value) => reasons.includes(value));
}

function getSquatPassThresholds(
  completionSatisfied: boolean,
  passReason: string | undefined,
  currentSquatPhase: SquatCompletionState extends { currentSquatPhase?: infer P }
    ? P | undefined
    : undefined
): {
  easyOnly: boolean;
  confidenceThreshold: number;
  stableFramesRequired: number;
} {
  const easyOnly =
    completionSatisfied === true &&
    isSquatShallowRomPassReason(passReason) &&
    currentSquatPhase === 'standing_recovered';
  return {
    easyOnly,
    confidenceThreshold: easyOnly
      ? SQUAT_EASY_PASS_CONFIDENCE
      : BASIC_PASS_CONFIDENCE_THRESHOLD.squat,
    stableFramesRequired: easyOnly ? SQUAT_EASY_LATCH_STABLE_FRAMES : REQUIRED_STABLE_FRAMES,
  };
}

function isOverheadEasyOnlyProgression(result: EvaluatorResult): boolean {
  const hm = result.debug?.highlightedMetrics;
  const strict =
    hm?.strictMotionCompletionSatisfied === true || hm?.strictMotionCompletionSatisfied === 1;
  const easy = hm?.easyCompletionSatisfied === true || hm?.easyCompletionSatisfied === 1;
  // PR-CAM-15: low-ROM path도 easy-only 완화 적용 (동일 confidence·latch 임계)
  const lowRom = hm?.lowRomProgressionSatisfied === true || hm?.lowRomProgressionSatisfied === 1;
  // PR-CAM-16: humane low-ROM path도 동일하게 easy-only 완화 적용
  const humaneLowRom =
    hm?.humaneLowRomProgressionSatisfied === true || hm?.humaneLowRomProgressionSatisfied === 1;
  return Boolean((easy || lowRom || humaneLowRom) && !strict);
}

function getPassThresholdEffective(
  stepId: CameraStepId,
  passThreshold: number,
  overheadEasyOnly: boolean,
  squatEasyOnly: boolean
): number {
  return overheadEasyOnly
    ? OVERHEAD_EASY_PASS_CONFIDENCE
    : stepId === 'squat' && squatEasyOnly
      ? SQUAT_EASY_PASS_CONFIDENCE
      : passThreshold;
}

function getPassConfirmationMinStableFrames(
  stepId: CameraStepId,
  squatEasyOnly: boolean
): number {
  return stepId === 'overhead-reach'
    ? REQUIRED_STABLE_FRAMES
    : stepId === 'squat' && squatEasyOnly
      ? SQUAT_EASY_LATCH_STABLE_FRAMES
      : REQUIRED_STABLE_FRAMES;
}

function applySquatFinalBlockerVetoLayer(input: {
  stepId: CameraStepId;
  uiGate: SquatUiGate;
  squatCompletionState: SquatCompletionState | undefined;
  squatCycleDebug: SquatCycleDebug | undefined;
}): SquatUiGate {
  if (
    input.uiGate.uiProgressionAllowed === true &&
    shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
      input.stepId,
      input.squatCompletionState,
      input.squatCycleDebug
    )
  ) {
    return {
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
    };
  }

  if (
    input.uiGate.uiProgressionAllowed === true &&
    shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
      input.stepId,
      input.squatCompletionState,
      input.squatCycleDebug
    )
  ) {
    return {
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON,
    };
  }

  if (
    input.uiGate.uiProgressionAllowed === true &&
    shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass(
      input.stepId,
      input.squatCompletionState,
      input.squatCycleDebug
    )
  ) {
    return {
      uiProgressionAllowed: false,
      uiProgressionBlockedReason: SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON,
    };
  }

  return input.uiGate;
}

export function getSquatPostOwnerFinalPassBlockedReason(input: {
  ownerTruth: SquatOwnerTruth;
  uiGate: SquatUiGate;
  squatCompletionState: SquatCompletionState | undefined;
}): string | null {
  const ownerTruth = enforceSquatOwnerContradictionInvariant({
    ownerTruth: input.ownerTruth,
    squatCompletionState: input.squatCompletionState,
  });

  // RF-STRUCT-12: when pass-core drove the owner truth, completionTruthPassed is NOT
  // the final authority. Skip the completion-state veto chain and go straight to UI gate.
  // Blocked reason is pass-core's reason, not a stale completion-state reason.
  if (ownerTruth.completionOwnerReason === 'pass_core_detected') {
    if (!ownerTruth.completionOwnerPassed) {
      return ownerTruth.completionOwnerBlockedReason ?? 'completion_owner_blocked';
    }
    if (!input.uiGate.uiProgressionAllowed) {
      return input.uiGate.uiProgressionBlockedReason ?? 'ui_progression_blocked';
    }
    return null;
  }

  // Legacy completion-state path (unchanged): completion-state owns the decision.
  const completionState = input.squatCompletionState;
  const completionPassReason = completionState?.completionPassReason;
  const completionBlockedReason = completionState?.completionBlockedReason ?? null;
  const completionTruthPassed = squatCompletionTruthPassed(
    completionState?.completionSatisfied === true,
    completionPassReason
  );
  const cycleComplete = completionState?.cycleComplete === true;

  if (completionTruthPassed !== true) return 'completion_truth_not_passed';
  if (completionPassReason === 'not_confirmed') return 'completion_reason_not_confirmed';
  if (completionBlockedReason != null) return `completion_blocked:${completionBlockedReason}`;
  if (!cycleComplete) return 'cycle_not_complete';
  if (ownerTruth.completionOwnerReason === 'not_confirmed') {
    return 'completion_owner_reason_not_confirmed';
  }
  if (!ownerTruth.completionOwnerPassed) {
    return ownerTruth.completionOwnerBlockedReason ?? 'completion_owner_blocked';
  }
  if (!input.uiGate.uiProgressionAllowed) {
    return input.uiGate.uiProgressionBlockedReason ?? 'ui_progression_blocked';
  }
  return null;
}

export function computeSquatPostOwnerPreLatchGateLayer(input: {
  stepId: CameraStepId;
  ownerTruth: SquatOwnerTruth;
  uiGateInput: SquatUiProgressionLatchGateInput;
  squatCompletionState: SquatCompletionState | undefined;
  squatCycleDebug: SquatCycleDebug | undefined;
  /** PR-A: additive motion-owner trace for `squatFinalPassTruth` only — not used to compute blocked reason. */
  squatPassCore?: SquatPassCoreResult | undefined;
}): SquatPostOwnerPreLatchGateLayer {
  const ownerTruth = enforceSquatOwnerContradictionInvariant({
    ownerTruth: input.ownerTruth,
    squatCompletionState: input.squatCompletionState,
  });
  const uiGate = applySquatFinalBlockerVetoLayer({
    stepId: input.stepId,
    uiGate: computeSquatUiProgressionLatchGate({
      ...input.uiGateInput,
      completionOwnerPassed: ownerTruth.completionOwnerPassed,
    }),
    squatCompletionState: input.squatCompletionState,
    squatCycleDebug: input.squatCycleDebug,
  });
  const finalPassBlockedReason = getSquatPostOwnerFinalPassBlockedReason({
    ownerTruth,
    uiGate,
    squatCompletionState: input.squatCompletionState,
  });
  const motionOwnerSource = readSquatCurrentRepPassTruth({
    squatPassCore: input.squatPassCore,
    squatCompletionState: input.squatCompletionState,
  }).ownerSource;
  const squatFinalPassTruth = buildSquatFinalPassTruthSurface({
    finalPassBlockedReason,
    motionOwnerSource,
  });

  return {
    ownerTruth,
    uiGate,
    finalPassBlockedReason,
    progressionPassed: finalPassBlockedReason == null,
    squatFinalPassTruth,
  };
}

function getOverheadRepHoldBlocks(
  stepId: CameraStepId,
  reasons: string[],
  evaluatorResult: EvaluatorResult
): boolean {
  const hasHoldOrRepReason = hasAnyReason(reasons, ['rep_incomplete', 'hold_too_short']);
  const overheadSimpleSat =
    stepId === 'overhead-reach' &&
    (evaluatorResult.debug?.highlightedMetrics?.completionSatisfied === true ||
      evaluatorResult.debug?.highlightedMetrics?.completionSatisfied === 1);
  return overheadSimpleSat ? false : hasHoldOrRepReason;
}

function getFinalPassBlockedReason(input: {
  stepId: CameraStepId;
  completionSatisfied: boolean;
  confidence: number;
  passThresholdEffective: number;
  effectivePassConfirmation: boolean;
  guardrail: StepGuardrailResult;
  reasons: string[];
  hardBlockerReasons: string[];
  overheadRepHoldBlocks: boolean;
  squatOwnerTruth: SquatOwnerTruth | null;
  squatUiGate: SquatUiGate | null;
  squatCompletionState: SquatCompletionState | undefined;
  squatIntegrityBlockForPass: string | null;
}): string | null {
  const {
    stepId,
    completionSatisfied,
    confidence,
    passThresholdEffective,
    effectivePassConfirmation,
    guardrail,
    reasons,
    hardBlockerReasons,
    overheadRepHoldBlocks,
    squatOwnerTruth,
    squatUiGate,
    squatIntegrityBlockForPass,
  } = input;

  if (stepId === 'squat' && squatOwnerTruth != null && squatUiGate != null) {
    return getSquatPostOwnerFinalPassBlockedReason({
      ownerTruth: squatOwnerTruth,
      uiGate: squatUiGate,
      squatCompletionState: input.squatCompletionState,
    });
  }
  if (!completionSatisfied) return 'completion_not_satisfied';
  if (guardrail.captureQuality === 'invalid') return 'capture_quality_invalid';
  // PR-SIMPLE-PASS-01: confidence is quality-only for overhead — NOT a pass gate
  if (stepId !== 'overhead-reach' && confidence < passThresholdEffective) {
    return `confidence_too_low:${confidence.toFixed(2)}<${passThresholdEffective.toFixed(2)}`;
  }
  if (!effectivePassConfirmation) return 'pass_confirmation_not_ready';
  if (stepId !== 'overhead-reach' && squatIntegrityBlockForPass != null) {
    return squatIntegrityBlockForPass;
  }
  const blocker = hardBlockerReasons.find((reason) => reasons.includes(reason));
  if (blocker) return `hard_blocker:${blocker}`;
  if (overheadRepHoldBlocks) return 'overhead_rep_hold_blocked';
  return null;
}

function getStableSignalBonus(stepId: CameraStepId, result: EvaluatorResult): number {
  if (stepId === 'squat') {
    // PR-CAM-09: squatCompletionState 에서 typed 로 읽기
    const cycleDone = result.debug?.squatCompletionState?.completionSatisfied === true;
    return cycleDone ? 0.04 : 0;
  }

  if (stepId === 'wall-angel') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const lowerCount = getHighlightedMetric(result, 'lowerCount');
    return raiseCount > 1 && peakCount > 0 && lowerCount > 1 ? 0.04 : 0;
  }

  if (stepId === 'overhead-reach') {
    const raiseCount = getHighlightedMetric(result, 'raiseCount');
    const peakCount = getHighlightedMetric(result, 'peakCount');
    const peakEasy = getHighlightedMetric(result, 'peakCountAtEasyFloor');
    const hm = result.debug?.highlightedMetrics;
    const progDone =
      hm?.completionSatisfied === true || hm?.completionSatisfied === 1;
    const peakOk =
      peakCount >= OVERHEAD_MIN_PEAK_FRAMES || peakEasy >= OVERHEAD_EASY_MIN_PEAK_FRAMES;
    return raiseCount > 0 && peakOk && progDone ? 0.04 : 0;
  }

  const holdOngoingCount = getHighlightedMetric(result, 'holdOngoingCount');
  const breakCount = getHighlightedMetric(result, 'breakCount');
  return holdOngoingCount >= 8 && breakCount === 0 ? 0.05 : 0;
}

const JITTER_PENALTY_CAP = 0.12;
const FRAMING_PENALTY_CAP = 0.08;
const LANDMARK_PENALTY_CAP = 0.06;

function getNoisePenalty(guardrail: StepGuardrailResult): number {
  let jitter = 0;
  if (guardrail.flags.includes('unstable_frame_timing')) jitter += 0.05;
  if (guardrail.flags.includes('unstable_landmarks')) jitter += 0.04;
  if ((guardrail.debug.timestampDiscontinuityCount ?? 0) > 0) jitter += 0.04;
  let framing = 0;
  if (guardrail.flags.includes('hard_partial')) framing += 0.06;
  if (guardrail.flags.includes('soft_partial')) framing += 0.03;
  const landmark = guardrail.flags.includes('landmark_confidence_low') ? 0.04 : 0;
  return (
    Math.min(jitter, JITTER_PENALTY_CAP) +
    Math.min(framing, FRAMING_PENALTY_CAP) +
    Math.min(landmark, LANDMARK_PENALTY_CAP)
  );
}

function getEffectiveConfidence(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
): number {
  return clamp(guardrail.confidence + getStableSignalBonus(stepId, result) - getNoisePenalty(guardrail));
}

function isSevereInvalid(guardrail: StepGuardrailResult): boolean {
  return (
    guardrail.captureQuality === 'invalid' &&
    (guardrail.flags.includes('insufficient_signal') ||
      guardrail.flags.includes('valid_frames_too_few') ||
      guardrail.flags.includes('framing_invalid'))
  );
}

function getCommonReasons(result: EvaluatorResult, guardrail: StepGuardrailResult): string[] {
  return [
    ...(guardrail.flags ?? []),
    ...(result.qualityHints ?? []),
    ...(result.completionHints ?? []),
    ...(result.interpretedSignals ?? []),
  ];
}

/**
 * PR G7 / PR-COMP-01: completion = `squat-completion-state` 단일 truth.
 * PR-CAM-09: squatCompletionState 에서 typed 로 읽는다.
 */
function evaluateSquatCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const cycleDone = result.debug?.squatCompletionState?.completionSatisfied === true;
  return guardrail.completionStatus === 'complete' && cycleDone;
}

function evaluateWallAngelCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const armRange = getMetricValue(result.metrics, 'arm_range') ?? 0;
  const compensation = getMetricValue(result.metrics, 'lumbar_extension') ?? 999;
  const asymmetry = getMetricValue(result.metrics, 'asymmetry') ?? 999;
  const raiseCount = getHighlightedMetric(result, 'raiseCount');
  const peakCount = getHighlightedMetric(result, 'peakCount');
  const lowerCount = getHighlightedMetric(result, 'lowerCount');

  return (
    guardrail.completionStatus === 'complete' &&
    armRange >= 120 &&
    compensation < 24 &&
    asymmetry < 30 &&
    raiseCount > 0 &&
    peakCount > 0 &&
    lowerCount > 0
  );
}

/** PR G8/G9 + PR-COMP-04: overhead completion = `overhead-completion-state` → evaluator highlightedMetrics */
function evaluateOverheadReachCompletion(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult
) {
  const hm = result.debug?.highlightedMetrics;
  const done = hm?.completionSatisfied === true || hm?.completionSatisfied === 1;
  return guardrail.completionStatus === 'complete' && done;
}

function evaluateBalanceCompletion(result: EvaluatorResult, guardrail: StepGuardrailResult) {
  const holdStability = getMetricValue(result.metrics, 'hold_stability') ?? 0;
  const sway = getMetricValue(result.metrics, 'sway') ?? 999;
  const pelvicDrop = getMetricValue(result.metrics, 'pelvic_drop') ?? 999;
  const holdDuration = getMetricValue(result.rawMetrics, 'hold_duration') ?? 0;
  const breakCount = getHighlightedMetric(result, 'breakCount');
  const holdOngoingCount = getHighlightedMetric(result, 'holdOngoingCount');

  return (
    guardrail.completionStatus === 'complete' &&
    holdDuration >= 6500 &&
    holdStability >= 65 &&
    sway < 0.06 &&
    pelvicDrop < 0.055 &&
    breakCount === 0 &&
    holdOngoingCount >= 6
  );
}

/** PR G4: overhead 최소 캡처 시간 — settle 후 유효 이벤트만 pass */
const OVERHEAD_ARMING_MS = 800;

function getCompletionSatisfied(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  stats?: PoseCaptureStats
): boolean {
  if (stepId === 'squat') return evaluateSquatCompletion(result, guardrail);
  if (stepId === 'overhead-reach') {
    if (stats && stats.captureDurationMs < OVERHEAD_ARMING_MS) return false;
    return evaluateOverheadReachCompletion(result, guardrail);
  }
  if (stepId === 'wall-angel') return evaluateWallAngelCompletion(result, guardrail);
  return evaluateBalanceCompletion(result, guardrail);
}

function getDetectingMessage(
  stepId: CameraStepId,
  stats: PoseCaptureStats,
  guardrail: StepGuardrailResult
): { progressionState: ExerciseProgressionState; uiMessage: string } {
  if (stats.sampledFrameCount === 0) {
    return { progressionState: 'camera_ready', uiMessage: '동작을 시작해 주세요' };
  }

  if (
    guardrail.flags.includes('insufficient_signal') ||
    guardrail.flags.includes('valid_frames_too_few')
  ) {
    return { progressionState: 'insufficient_signal', uiMessage: '조금만 더 유지해 주세요' };
  }

  return { progressionState: 'detecting', uiMessage: '신호를 확인하고 있어요' };
}

function getRetryMessage(guardrail: StepGuardrailResult): string {
  if (
    guardrail.flags.includes('rep_incomplete') ||
    guardrail.flags.includes('hold_too_short')
  ) {
    return '한 번 더 천천히 해주세요';
  }

  if (
    guardrail.flags.includes('framing_invalid') ||
    guardrail.flags.includes('hard_partial') ||
    guardrail.flags.includes('left_side_missing') ||
    guardrail.flags.includes('right_side_missing')
  ) {
    return '머리부터 발끝까지 보이게 해주세요';
  }

  return '조금 더 안정적으로 해주세요';
}

function toUniqueGuidance(messages: string[]): string[] {
  return [...new Set(messages)].slice(0, 2);
}

function getUserGuidance(
  stepId: CameraStepId,
  failureReasons: string[],
  guardrail: StepGuardrailResult
): string[] {
  const messages: string[] = [];

  if (failureReasons.includes('framing_invalid')) {
    messages.push('머리부터 발끝까지 보이게 해주세요');
  }

  if (
    failureReasons.includes('hard_partial') ||
    failureReasons.includes('left_side_missing') ||
    failureReasons.includes('right_side_missing')
  ) {
    messages.push('조금 더 가까이 와주세요');
  }

  if (
    failureReasons.includes('capture_quality_invalid') ||
    failureReasons.includes('capture_quality_low')
  ) {
    messages.push('몸이 화면 안에서 더 크게 보이게 해주세요');
  }

  if (guardrail.flags.includes('landmark_confidence_low')) {
    messages.push('조명을 조금 더 밝게 해주세요');
  }

  if (
    guardrail.flags.includes('unstable_frame_timing') ||
    guardrail.flags.includes('unstable_bbox') ||
    guardrail.flags.includes('unstable_landmarks')
  ) {
    messages.push('카메라를 고정하고 천천히 움직여주세요');
  }

  if (
    failureReasons.includes('insufficient_signal') ||
    guardrail.flags.includes('valid_frames_too_few')
  ) {
    messages.push('한 번 더 천천히 해주세요');
  }

  if (stepId === 'squat') {
    if (failureReasons.includes('depth_not_reached')) {
      messages.push('조금 더 깊게 앉아주세요');
    }
    if (failureReasons.includes('ascent_not_detected')) {
      messages.push('조금 더 앉았다가 다시 올라와주세요');
    }
    if (failureReasons.includes('rep_incomplete')) {
      messages.push('조금 더 앉았다가 다시 올라와주세요');
    }
  }

  if (stepId === 'wall-angel' && failureReasons.includes('rep_incomplete')) {
    messages.push('팔을 끝까지 올렸다가 천천히 내려주세요');
  }

  if (stepId === 'overhead-reach') {
    if (failureReasons.includes('rep_incomplete')) {
      messages.push('양팔을 머리 위로 끝까지 올려주세요');
    }
    if (guardrail.flags.includes('hold_too_short')) {
      messages.push('맨 위에서 잠깐 멈춰주세요');
    }
  }

  if (stepId === 'single-leg-balance') {
    if (guardrail.flags.includes('hold_too_short')) {
      messages.push('한 발 자세를 조금만 더 유지해 주세요');
    }
    if (failureReasons.includes('side_missing')) {
      messages.push('좌우 자세가 모두 보이게 다시 맞춰주세요');
    }
  }

  if (failureReasons.includes('confidence_too_low')) {
    messages.push('자세를 잠깐 고정한 뒤 다시 해주세요');
  }

  return toUniqueGuidance(messages);
}

interface SquatQualitySignals {
  depthTooShallow: boolean;
  trunkLeanHigh: boolean;
  kneeTrackingOff: boolean;
  bottomStabilityLow: boolean;
  strongQuality: boolean;
}

function getSquatQualitySignals(
  result: EvaluatorResult,
  confidence: number
): SquatQualitySignals {
  const depth = getMetricValue(result.metrics, 'depth') ?? 0;
  const depthPeak = getHighlightedMetric(result, 'depthPeak');
  const trunkLean = getMetricValue(result.metrics, 'trunk_lean') ?? 999;
  const kneeTracking = getMetricValue(result.metrics, 'knee_alignment_trend') ?? 0;
  const bottomStability = getMetricValue(result.rawMetrics, 'bottom_stability_proxy') ?? 0;
  const depthTooShallow = Math.max(depth, depthPeak) < 45;
  const trunkLeanHigh = trunkLean >= 24;
  const kneeTrackingOff = kneeTracking < 0.82 || kneeTracking > 1.18;
  const bottomStabilityLow = bottomStability < 40;

  return {
    depthTooShallow,
    trunkLeanHigh,
    kneeTrackingOff,
    bottomStabilityLow,
    strongQuality:
      confidence >= STRONG_QUALITY_CONFIDENCE_THRESHOLD.squat &&
      !depthTooShallow &&
      !trunkLeanHigh &&
      !kneeTrackingOff &&
      !bottomStabilityLow,
  };
}

function getHardBlockerReasons(
  stepId: CameraStepId,
  guardrail: StepGuardrailResult
): string[] {
  const commonBlockers = [
    'insufficient_signal',
    'valid_frames_too_few',
    'framing_invalid',
  ];

  if (stepId === 'squat') {
    return [
      ...commonBlockers,
      ...(guardrail.flags.includes('left_side_missing') ? ['left_side_missing'] : []),
      ...(guardrail.flags.includes('right_side_missing') ? ['right_side_missing'] : []),
    ];
  }

  return [...commonBlockers, 'left_side_missing', 'right_side_missing', 'hard_partial'];
}

/** PR G3: arming window — countdown 직후 즉시 pass되지 않도록 최소 캡처 시간 */
const SQUAT_ARMING_MS = 1500;
/**
 * CAM-25 + PR-CAM-CORE: shallow ROM 네 가지 passReason 전용 완화 confidence 임계.
 * standard pass chain(0.62)보다 낮게 설정해 매우 얕은 사이클도 final gate를 통과할 수 있게 한다.
 * 단, hard blocker · captureQuality invalid · 사이클 증명 부재 시는 여전히 차단된다.
 */
const SQUAT_EASY_PASS_CONFIDENCE = 0.56;
/**
 * CAM-25: easy-only branch의 passConfirmation latch 요건.
 * overhead easy와 동일하게 2프레임으로 완화 (standard 3프레임 대비).
 */
const SQUAT_EASY_LATCH_STABLE_FRAMES = 2;

/**
 * PR-CAM-29A: `getSquatProgressionCompletionSatisfied` 가 채운 `minimumCycleDurationSatisfied`(= cycleDurationMs >= SQUAT_ARMING_MS)를
 * 최종 패스 래치·progressionPassed 와 동일하게 소비한다. 신규 수치 없음.
 * 레거시 mock( debug 일부만 채움 )은 cycleDurationMs 부재 시 완화(true) — 실제 `evaluateExerciseAutoProgress` gate 는 항상 squatCycleDebug 포함.
 */
function squatMinimumCycleOkForFinalPass(
  evaluatorResult: EvaluatorResult,
  squatCycleDebug?: SquatCycleDebug
): boolean {
  if (squatCycleDebug != null && typeof squatCycleDebug.minimumCycleDurationSatisfied === 'boolean') {
    return squatCycleDebug.minimumCycleDurationSatisfied;
  }
  const ms = evaluatorResult.debug?.squatCompletionState?.cycleDurationMs;
  if (typeof ms === 'number') return ms >= SQUAT_ARMING_MS;
  return true;
}

/**
 * PR-SQUAT-ULTRA-LOW-FINAL-GATE-03: completion-state 에서 shallow rescue 를 살린 뒤,
 * seated/too-early ultra-low trajectory rescue 만 UI/final pass 에서 초저특이로 차단.
 * standard_cycle · rule reversal deep · 긴 사이클 ultra-low trajectory 에는 적용 안 함.
 */
const SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON =
  'minimum_cycle_duration_not_met:ultra_low_trajectory';

/**
 * 스모크 전용 export — production 은 `evaluateExerciseAutoProgress` 내부와 동일 시그니처만 통과시킨다.
 */
export function shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;
  const cs = squatCompletionState as {
    completionPassReason?: string;
    reversalConfirmedBy?: string;
    trajectoryReversalRescueApplied?: boolean;
  };
  if (cs.completionPassReason !== 'ultra_low_rom_cycle') return false;
  if (cs.reversalConfirmedBy !== 'trajectory') return false;
  if (cs.trajectoryReversalRescueApplied !== true) return false;
  if (squatCycleDebug?.minimumCycleDurationSatisfied !== false) return false;
  return true;
}

/**
 * PR-SETUP-SERIES-START-01: setup/arming 폴백 + 시리즈 시작 피크 앵커 오염으로
 * trajectory ultra-low 가 닫히는 false positive 만 final pass 에서 차단. completion truth 유지.
 */
const SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON = 'setup_series_start_false_pass';
const SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON =
  'contaminated_blended_early_peak_false_pass';

function squatEventCycleNotesIndicateSeriesStartContamination(notes: string[] | undefined): boolean {
  if (notes == null || notes.length === 0) return false;
  return notes.includes('peak_anchor_at_series_start') || notes.includes('descent_weak');
}

/**
 * 스모크·계약용 export — `evaluateExerciseAutoProgress` 가 사용하는 조건과 동일.
 */
export function shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;
  const cs = squatCompletionState as {
    evidenceLabel?: string;
    reversalConfirmedBy?: string;
    trajectoryReversalRescueApplied?: boolean;
    committedAtMs?: number;
    reversalAtMs?: number;
    descendStartAtMs?: number;
    squatDescentToPeakMs?: number;
    peakLatchedAtIndex?: number | null;
    squatEventCycle?: { notes?: string[] };
  };
  if (cs.evidenceLabel !== 'ultra_low_rom') return false;
  if (cs.reversalConfirmedBy !== 'trajectory') return false;
  if (cs.trajectoryReversalRescueApplied !== true) return false;
  if (squatCycleDebug?.armingFallbackUsed !== true) return false;
  if (cs.peakLatchedAtIndex == null || cs.peakLatchedAtIndex > 0) return false;
  if (cs.committedAtMs == null || cs.reversalAtMs == null || cs.descendStartAtMs == null) return false;
  if (cs.descendStartAtMs !== cs.committedAtMs || cs.committedAtMs !== cs.reversalAtMs) return false;
  if (cs.squatDescentToPeakMs == null || cs.squatDescentToPeakMs > 0) return false;
  const notes = cs.squatEventCycle?.notes;
  if (!squatEventCycleNotesIndicateSeriesStartContamination(notes)) return false;
  return true;
}

/**
 * PR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01:
 * blended/assisted shallow-like + very-early peak + no event-cycle rescue contamination family만
 * final-pass에서 차단한다. 단일 필드 기반 차단 금지.
 */
export function shouldBlockSquatBlendedEarlyPeakContaminatedFalsePassFinalPass(
  stepId: CameraStepId,
  squatCompletionState: unknown,
  squatCycleDebug: SquatCycleDebug | undefined
): boolean {
  if (stepId !== 'squat') return false;
  if (squatCompletionState == null || typeof squatCompletionState !== 'object') return false;

  const cs = squatCompletionState as {
    evidenceLabel?: string;
    completionPassReason?: string;
    completionTruthPassed?: boolean;
    relativeDepthPeak?: number;
    relativeDepthPeakSource?: string | null;
    rawDepthPeakPrimary?: number | null;
    rawDepthPeakBlended?: number | null;
    eventCycleDetected?: boolean;
    eventCyclePromoted?: boolean;
    peakLatchedAtIndex?: number | null;
    baselineFrozen?: boolean;
  };

  const dbg = squatCycleDebug ?? {};
  const evidenceLooksShallowLike =
    cs.evidenceLabel === 'ultra_low_rom' ||
    cs.evidenceLabel === 'low_rom' ||
    cs.completionPassReason === 'ultra_low_rom_cycle' ||
    cs.completionPassReason === 'low_rom_cycle' ||
    (typeof cs.relativeDepthPeak === 'number' && cs.relativeDepthPeak > 0 && cs.relativeDepthPeak < 0.12);
  if (!evidenceLooksShallowLike) return false;

  const blendedAssistContamination =
    cs.relativeDepthPeakSource === 'blended' &&
    dbg.armingDepthBlendAssisted === true &&
    (dbg.armingFallbackUsed === true || dbg.armingDepthSource === 'fallback_assisted_blended');
  if (!blendedAssistContamination) return false;

  const peakLatchedAtIndex =
    cs.peakLatchedAtIndex ?? dbg.peakLatchedAtIndex ?? null;
  const observedFamilyEarlyPeakAt2 =
    peakLatchedAtIndex === 2 &&
    dbg.armingFallbackUsed === true &&
    (cs.baselineFrozen === true || dbg.baselineFrozen === true);
  const earlyPeakLatched =
    peakLatchedAtIndex != null &&
    (peakLatchedAtIndex <= 1 || observedFamilyEarlyPeakAt2);
  if (!earlyPeakLatched) return false;

  const noStrongEventCycleRescue =
    cs.eventCycleDetected !== true &&
    dbg.eventCycleDetected !== true &&
    cs.eventCyclePromoted !== true &&
    dbg.eventCyclePromoted !== true;
  if (!noStrongEventCycleRescue) return false;

  const completionWeak =
    cs.completionTruthPassed === false && cs.completionPassReason === 'not_confirmed';
  if (!completionWeak) return false;

  const primaryDepth = Math.max(
    0,
    Number(cs.rawDepthPeakPrimary ?? dbg.rawDepthPeakPrimary ?? dbg.squatDepthPeakPrimary ?? 0)
  );
  const blendedDepth = Math.max(
    0,
    Number(cs.rawDepthPeakBlended ?? dbg.rawDepthPeakBlended ?? dbg.squatDepthPeakBlended ?? 0)
  );
  const primaryDepthNegligibleVsBlended =
    blendedDepth > 0 && (primaryDepth <= 0.004 || primaryDepth <= blendedDepth * 0.35);
  if (!primaryDepthNegligibleVsBlended) return false;

  return true;
}

function buildSquatUiProgressionLatchGateInput(input: {
  completionOwnerPassed: boolean;
  guardrailCompletionComplete: boolean;
  captureQualityInvalid: boolean;
  confidence: number;
  passThresholdEffective: number;
  effectivePassConfirmation: boolean;
  passConfirmationFrameCount: number;
  framesReq: number;
  captureArmingSatisfied: boolean;
  squatIntegrityBlockForPass: string | null;
  reasons: string[];
  hardBlockerReasons: string[];
  liveReadinessNotReady: boolean;
  readinessStableDwellSatisfied: boolean | undefined;
  setupMotionBlocked: boolean;
}): SquatUiProgressionLatchGateInput {
  return {
    completionOwnerPassed: input.completionOwnerPassed,
    guardrailCompletionComplete: input.guardrailCompletionComplete,
    captureQualityInvalid: input.captureQualityInvalid,
    confidence: input.confidence,
    passThresholdEffective: input.passThresholdEffective,
    effectivePassConfirmation: input.effectivePassConfirmation,
    passConfirmationFrameCount: input.passConfirmationFrameCount,
    framesReq: input.framesReq,
    captureArmingSatisfied: input.captureArmingSatisfied,
    squatIntegrityBlockForPass: input.squatIntegrityBlockForPass,
    reasons: input.reasons,
    hardBlockerReasons: input.hardBlockerReasons,
    liveReadinessNotReady: input.liveReadinessNotReady,
    readinessStableDwellSatisfied: input.readinessStableDwellSatisfied,
    setupMotionBlocked: input.setupMotionBlocked,
  };
}

/** PR-CAM-CORE-PASS-REASON-ALIGN-01: shallow ROM 성공(일반·이벤트 사이클) — easy latch / conf floor 공통 */
function isSquatShallowRomPassReason(passReason: string | undefined): boolean {
  return (
    passReason === 'low_rom_cycle' ||
    passReason === 'ultra_low_rom_cycle' ||
    passReason === 'low_rom_event_cycle' ||
    passReason === 'ultra_low_rom_event_cycle' ||
    passReason === 'official_shallow_cycle'
  );
}

/** PR G6: depth는 completion이 아니라 quality band. completion은 full cycle만 요구. */

/**
 * PR-4-GATE-FREEZE: Squat progression completion reader.
 *
 * OWNERSHIP: This function reads already-finalized completion truth from
 * `result.debug.squatCompletionState` (set by the evaluator pipeline after
 * evaluateSquatCompletionState → late-setup check → applyUltraLowPolicyLock).
 *
 * It does NOT redefine or re-author completion truth. The `satisfied` return
 * value combines two checks:
 *   1. guardrail.completionStatus === 'complete'  (UI/signal gate — not motion truth)
 *   2. currentSquatPhase === 'standing_recovered' AND no completionBlockedReason
 *      (re-reads the already-finalized state to confirm it propagated)
 *
 * The bulk of this function assembles `squatCycleDebug` — a rich observability
 * object read by downstream debug tooling and auto-progression trace.
 * Debug fields do NOT feed back into the gate decision.
 */
function getSquatProgressionCompletionSatisfied(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  stats: PoseCaptureStats
): { satisfied: boolean; squatCycleDebug: SquatCycleDebug } {
  // ── 평가자 레이어 신호: phase counts + depth band (highlightedMetrics 유지) ──
  const startCount = getHighlightedMetric(result, 'startCount');
  const descentCount = getHighlightedMetric(result, 'descentCount');
  const bottomCount = getHighlightedMetric(result, 'bottomCount');
  const ascentCount = getHighlightedMetric(result, 'ascentCount');
  const cycleComplete = getHighlightedMetric(result, 'cycleComplete') > 0;
  const depthBand = getHighlightedMetric(result, 'depthBand'); /* 0=shallow, 1=moderate, 2=deep */

  // ── PASS-AUTHORITY-RESET-01: immutable pass truth from pass-core ──
  const passCore = result.debug?.squatPassCore as SquatPassCoreResult | undefined;

  // ── completion truth: squatCompletionState (typed) 우선, highlightedMetrics fallback ──
  // PR-CAM-09: evaluators/squat.ts 가 squatCompletionState 를 직접 설정하므로
  // highlightedMetrics 캐스팅 roundtrip 없이 타입 안전하게 읽는다.
  const cs = result.debug?.squatCompletionState;

  const currentSquatPhase: SquatCycleDebug['currentSquatPhase'] =
    cs?.currentSquatPhase ??
    ((result.debug?.highlightedMetrics?.currentSquatPhase as SquatCycleDebug['currentSquatPhase']) ?? 'idle');
  const evidenceLabel: SquatCycleDebug['evidenceLabel'] =
    cs?.evidenceLabel ??
    ((result.debug?.highlightedMetrics?.evidenceLabel as SquatCycleDebug['evidenceLabel']) ?? 'insufficient_signal');
  const completionBlockedReason: string | null =
    cs?.completionBlockedReason ?? null;
  const attemptStarted = cs?.attemptStarted ?? false;
  const descendConfirmed = cs?.descendConfirmed ?? false;
  const ascendConfirmed = cs?.ascendConfirmed ?? false;
  const standingRecoveredAtMs = cs?.standingRecoveredAtMs ?? undefined;
  const standingRecoveryHoldMs = cs?.standingRecoveryHoldMs ?? 0;
  const standingRecoveryFrameCount = cs?.standingRecoveryFrameCount ?? 0;
  const standingRecoveryMinFramesUsed = cs?.standingRecoveryMinFramesUsed ?? undefined;
  const standingRecoveryMinHoldMsUsed = cs?.standingRecoveryMinHoldMsUsed ?? undefined;
  const standingRecoveryBand = cs?.standingRecoveryBand ?? undefined;
  const standingRecoveryFinalizeReason = cs?.standingRecoveryFinalizeReason ?? null;
  const committedAtMs = cs?.committedAtMs ?? undefined;
  const startBeforeBottom = cs?.startBeforeBottom ?? false;
  /** PR-CAM-09: downwardCommitmentDelta 는 squatCompletionState 에서 원본값으로 읽는다 */
  const downwardCommitmentDelta = cs?.downwardCommitmentDelta ?? 0;
  const cycleDurationMs = cs?.cycleDurationMs ?? 0;
  const lowRomRecoveryReason = cs?.lowRomRecoveryReason ?? null;
  const ultraLowRomRecoveryReason = cs?.ultraLowRomRecoveryReason ?? null;
  const recoveryReturnContinuityFrames = cs?.recoveryReturnContinuityFrames ?? undefined;
  const recoveryTrailingDepthCount = cs?.recoveryTrailingDepthCount ?? undefined;
  const recoveryDropRatio = cs?.recoveryDropRatio ?? undefined;
  const completionMachinePhase = cs?.completionMachinePhase ?? undefined;
  const completionPassReason = cs?.completionPassReason ?? undefined;

  // ── 파생 플래그 ──
  const cycleProofPassed = currentSquatPhase === 'standing_recovered';
  const armingSatisfied = currentSquatPhase !== 'idle';
  const startPoseSatisfied = currentSquatPhase !== 'idle' && startBeforeBottom;
  const descendDetected = descentCount > 0 || currentSquatPhase !== 'idle';
  const bottomDetected = bottomCount > 0;
  const ascendDetected =
    ascentCount > 0 ||
    currentSquatPhase === 'ascending' ||
    currentSquatPhase === 'standing_recovered';
  const recoveryDetected = standingRecoveredAtMs != null;
  const bottomTurningPointDetected = bottomDetected || committedAtMs != null;
  const depthBandLabel: 'shallow' | 'moderate' | 'deep' =
    depthBand === 2 ? 'deep' : depthBand === 1 ? 'moderate' : 'shallow';

  // ── 타이밍 (squatCompletionState 에서 직접) ──
  const descendStartAtMs = cs?.descendStartAtMs ?? undefined;
  const peakAtMs = cs?.peakAtMs ?? undefined;
  const reversalAtMs = cs?.reversalAtMs ?? undefined;
  const ascendStartAtMs = cs?.ascendStartAtMs ?? undefined;
  const recoveryAtMs = standingRecoveredAtMs;

  // ── PR-CAM-09: evidence 매핑은 squat-evidence.ts 헬퍼로 위임 ──
  const squatEvidenceLevel = evidenceLabelToSquatEvidenceLevel(
    evidenceLabel ?? 'insufficient_signal',
    cycleProofPassed
  );
  const squatEvidenceReasons = squatEvidenceLevelToReasons(squatEvidenceLevel, completionBlockedReason);
  const confidenceDowngradeReason = squatEvidenceLevelToConfidenceDowngradeReason(squatEvidenceLevel);
  const insufficientSignalReason: string | null =
    squatEvidenceLevel === 'insufficient_signal'
      ? (completionBlockedReason ?? 'cycle_proof_insufficient')
      : null;

  const squatCycleDebug: SquatCycleDebug = {
    armingSatisfied,
    currentSquatPhase,
    attemptStarted,
    startPoseSatisfied,
    startBeforeBottom,
    descendDetected,
    bottomDetected,
    bottomTurningPointDetected,
    ascendDetected,
    recoveryDetected,
    cycleComplete,
    completionStatus: guardrail.completionStatus,
    depthBand: depthBandLabel,
    passBlockedReason: null,
    qualityInterpretationReason: null,
    completionBlockedReason,
    evidenceLabel,
    descendStartAtMs,
    downwardCommitmentAtMs: peakAtMs,
    committedAtMs,
    reversalAtMs,
    ascendStartAtMs,
    recoveryAtMs,
    standingRecoveredAtMs,
    standingRecoveryHoldMs,
    standingRecoveryFrameCount,
    standingRecoveryMinFramesUsed,
    standingRecoveryMinHoldMsUsed,
    standingRecoveryBand,
    standingRecoveryFinalizeReason,
    cycleDurationMs,
    downwardCommitmentDelta,
    standingStillRejected: evidenceLabel === 'insufficient_signal',
    falsePositiveBlockReason: null,
    descendConfirmed,
    ascendConfirmed,
    reversalConfirmedAfterDescend: committedAtMs != null && reversalAtMs != null,
    recoveryConfirmedAfterReversal: standingRecoveredAtMs != null && reversalAtMs != null,
    minimumCycleDurationSatisfied: cycleDurationMs >= SQUAT_ARMING_MS,
    captureArmingSatisfied: stats.captureDurationMs >= SQUAT_ARMING_MS,
    ultraLowRomPathDisabledOrGuarded: false,
    squatEvidenceLevel,
    squatEvidenceReasons,
    cycleProofPassed,
    romBand: depthBandLabel,
    confidenceDowngradeReason,
    insufficientSignalReason,
    lowRomRejectionReason:
      evidenceLabel === 'low_rom' && !cycleProofPassed ? lowRomRecoveryReason : null,
    ultraLowRomRejectionReason:
      evidenceLabel === 'ultra_low_rom' && !cycleProofPassed ? ultraLowRomRecoveryReason : null,
    recoveryReturnContinuityFrames,
    recoveryTrailingDepthCount,
    recoveryDropRatio,
    completionMachinePhase,
    completionPassReason,
    ownerAuthoritativeShallowClosureSatisfied: cs?.ownerAuthoritativeShallowClosureSatisfied,
    // PR-D: PRIMARY_CANONICAL — shallow debug SSOT (동일 값은 아래 pass-through 에서 재확인)
    canonicalShallowContractClosureApplied: cs?.canonicalShallowContractClosureApplied,
    canonicalShallowContractClosureSource: cs?.canonicalShallowContractClosureSource ?? null,
    canonicalShallowContractEligible: cs?.canonicalShallowContractEligible,
    canonicalShallowContractAdmissionSatisfied: cs?.canonicalShallowContractAdmissionSatisfied,
    canonicalShallowContractAttemptSatisfied: cs?.canonicalShallowContractAttemptSatisfied,
    canonicalShallowContractReversalEvidenceSatisfied:
      cs?.canonicalShallowContractReversalEvidenceSatisfied,
    canonicalShallowContractRecoveryEvidenceSatisfied:
      cs?.canonicalShallowContractRecoveryEvidenceSatisfied,
    canonicalShallowContractAntiFalsePassClear: cs?.canonicalShallowContractAntiFalsePassClear,
    canonicalShallowContractSatisfied: cs?.canonicalShallowContractSatisfied,
    canonicalShallowContractStage: cs?.canonicalShallowContractStage,
    canonicalShallowContractBlockedReason: cs?.canonicalShallowContractBlockedReason ?? null,
    canonicalShallowContractAuthoritativeClosureWouldBeSatisfied:
      cs?.canonicalShallowContractAuthoritativeClosureWouldBeSatisfied,
    canonicalShallowContractProvenanceOnlySignalPresent:
      cs?.canonicalShallowContractProvenanceOnlySignalPresent,
    canonicalShallowContractSplitBrainDetected: cs?.canonicalShallowContractSplitBrainDetected,
    canonicalShallowContractTrace: cs?.canonicalShallowContractTrace,
    // PR-D: SECONDARY_DEBUG — owner / policy / trajectory evidence
    ownerTruthSource: cs?.ownerTruthSource ?? 'none',
    ownerTruthStage: cs?.ownerTruthStage,
    ownerTruthBlockedBy: cs?.ownerTruthBlockedBy ?? null,
    ultraLowPolicyScope: cs?.ultraLowPolicyScope,
    ultraLowPolicyDecisionReady: cs?.ultraLowPolicyDecisionReady,
    ultraLowPolicyBlocked: cs?.ultraLowPolicyBlocked,
    ultraLowPolicyTrace: cs?.ultraLowPolicyTrace,
    shallowTrajectoryBridgeEligible: cs?.shallowTrajectoryBridgeEligible,
    shallowTrajectoryBridgeSatisfied: cs?.shallowTrajectoryBridgeSatisfied,
    shallowTrajectoryBridgeBlockedReason: cs?.shallowTrajectoryBridgeBlockedReason ?? null,
    guardedShallowTrajectoryClosureProofSatisfied: cs?.guardedShallowTrajectoryClosureProofSatisfied,
    guardedShallowTrajectoryClosureProofBlockedReason:
      cs?.guardedShallowTrajectoryClosureProofBlockedReason ?? null,
    ...(typeof cs?.guardedShallowLocalPeakFound === 'boolean'
      ? {
          guardedShallowLocalPeakFound: cs.guardedShallowLocalPeakFound,
          guardedShallowLocalPeakBlockedReason: cs.guardedShallowLocalPeakBlockedReason ?? null,
          guardedShallowLocalPeakIndex: cs.guardedShallowLocalPeakIndex ?? null,
        }
      : {}),
    // PR-D: LEGACY_COMPAT
    shallowAuthoritativeClosureReason: cs?.shallowAuthoritativeClosureReason ?? null,
    shallowAuthoritativeClosureBlockedReason: cs?.shallowAuthoritativeClosureBlockedReason ?? null,
    shallowAuthoritativeStage: cs?.shallowAuthoritativeStage,
    shallowObservationLayerReversalTruth: cs?.shallowObservationLayerReversalTruth,
    shallowAuthoritativeReversalTruth: cs?.shallowAuthoritativeReversalTruth,
    shallowObservationLayerRecoveryTruth: cs?.shallowObservationLayerRecoveryTruth,
    shallowAuthoritativeRecoveryTruth: cs?.shallowAuthoritativeRecoveryTruth,
    shallowProvenanceOnlyReversalEvidence: cs?.shallowProvenanceOnlyReversalEvidence,
    truthMismatch_reversalTopVsCompletion: cs?.truthMismatch_reversalTopVsCompletion,
    truthMismatch_recoveryTopVsCompletion: cs?.truthMismatch_recoveryTopVsCompletion,
    truthMismatch_shallowAdmissionVsClosure: cs?.truthMismatch_shallowAdmissionVsClosure,
    truthMismatch_provenanceReversalWithoutAuthoritative:
      cs?.truthMismatch_provenanceReversalWithoutAuthoritative,
    truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery:
      cs?.truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery,
    shallowNormalizedBlockerFamily: cs?.shallowNormalizedBlockerFamily,
    shallowAuthoritativeContractStatus: cs?.shallowAuthoritativeContractStatus,
    shallowContractAuthoritativeClosure: cs?.shallowContractAuthoritativeClosure,
    shallowContractAuthorityTrace: cs?.shallowContractAuthorityTrace,
    ownerAuthoritativeReversalSatisfied: cs?.ownerAuthoritativeReversalSatisfied,
    ownerAuthoritativeRecoverySatisfied: cs?.ownerAuthoritativeRecoverySatisfied,
    provenanceReversalEvidencePresent: cs?.provenanceReversalEvidencePresent,
    standingFinalizeSatisfied: cs?.standingFinalizeSatisfied,
    standingFinalizeSuppressedByLateSetup: cs?.standingFinalizeSuppressedByLateSetup,
    standingFinalizeReadyAtMs: cs?.standingFinalizeReadyAtMs ?? null,
    squatInternalQuality: result.debug?.squatInternalQuality,
  };

  // PR-HMM-01B: shadow decoder trace 전용 — pass/retry/fail gate에 사용 금지
  const squatHmm = result.debug?.squatHmm;
  if (squatHmm != null) {
    squatCycleDebug.hmmConfidence = squatHmm.confidence;
    squatCycleDebug.hmmCompletionCandidate = squatHmm.completionCandidate;
    squatCycleDebug.hmmDominantPath = squatHmm.completionCandidate
      ? squatHmm.dominantStateCounts.descent >= 2 &&
        squatHmm.dominantStateCounts.bottom >= 1 &&
        squatHmm.dominantStateCounts.ascent >= 2
        ? 'standing→descent→bottom→ascent→standing'
        : 'partial_cycle'
      : 'no_cycle';
  }
  squatCycleDebug.hmmAssistEligible = cs?.hmmAssistEligible;
  squatCycleDebug.hmmAssistApplied = cs?.hmmAssistApplied;
  squatCycleDebug.hmmAssistReason = cs?.hmmAssistReason ?? null;

  const cal = result.debug?.squatCalibration;
  squatCycleDebug.ruleCompletionBlockedReason =
    cal?.ruleCompletionBlockedReason ?? cs?.ruleCompletionBlockedReason ?? null;
  squatCycleDebug.postAssistCompletionBlockedReason =
    cal?.postAssistCompletionBlockedReason ?? cs?.postAssistCompletionBlockedReason ?? null;
  squatCycleDebug.assistSuppressedByFinalize =
    cal?.assistSuppressedByFinalize ?? cs?.assistSuppressedByFinalize;
  squatCycleDebug.hmmExcursion =
    cal?.hmmExcursion ?? (squatHmm != null ? squatHmm.effectiveExcursion : null);
  squatCycleDebug.hmmTransitionCount =
    cal?.hmmTransitionCount ?? (squatHmm != null ? squatHmm.transitionCount : null);

  const ca = result.debug?.squatCompletionArming;
  squatCycleDebug.hmmArmingAssistEligible = ca?.hmmArmingAssistEligible;
  squatCycleDebug.hmmArmingAssistApplied = ca?.hmmArmingAssistApplied;
  squatCycleDebug.hmmArmingAssistReason = ca?.hmmArmingAssistReason ?? null;
  squatCycleDebug.effectiveArmed = ca?.effectiveArmed;
  squatCycleDebug.armingDepthSource = ca?.armingDepthSource ?? null;
  squatCycleDebug.armingDepthPeak =
    typeof ca?.armingDepthPeak === 'number' ? ca.armingDepthPeak : null;
  squatCycleDebug.armingDepthBlendAssisted = ca?.armingDepthBlendAssisted;
  squatCycleDebug.armingFallbackUsed = ca?.armingFallbackUsed;
  const hmObs = result.debug?.highlightedMetrics;
  squatCycleDebug.squatDepthPeakPrimary =
    typeof hmObs?.squatDepthPeakPrimary === 'number' ? hmObs.squatDepthPeakPrimary : null;
  squatCycleDebug.squatDepthPeakBlended =
    typeof hmObs?.squatDepthPeakBlended === 'number' ? hmObs.squatDepthPeakBlended : null;

  squatCycleDebug.hmmReversalAssistEligible = cs?.hmmReversalAssistEligible;
  squatCycleDebug.hmmReversalAssistApplied = cs?.hmmReversalAssistApplied;
  squatCycleDebug.hmmReversalAssistReason = cs?.hmmReversalAssistReason ?? null;
  squatCycleDebug.reversalConfirmedBy = cs?.reversalConfirmedBy ?? null;
  squatCycleDebug.reversalDepthDrop = cs?.reversalDepthDrop ?? null;
  squatCycleDebug.reversalFrameCount = cs?.reversalFrameCount ?? null;
  squatCycleDebug.ultraShallowMeaningfulDownUpRescueApplied =
    cs?.ultraShallowMeaningfulDownUpRescueApplied === true;
  squatCycleDebug.relativeDepthPeakSource = cs?.relativeDepthPeakSource ?? null;
  squatCycleDebug.rawDepthPeakPrimary =
    typeof cs?.rawDepthPeakPrimary === 'number' ? cs.rawDepthPeakPrimary : null;
  squatCycleDebug.rawDepthPeakBlended =
    typeof cs?.rawDepthPeakBlended === 'number' ? cs.rawDepthPeakBlended : null;

  squatCycleDebug.baselineFrozen = cs?.baselineFrozen;
  squatCycleDebug.baselineFrozenDepth = cs?.baselineFrozenDepth ?? null;
  squatCycleDebug.peakLatched = cs?.peakLatched;
  squatCycleDebug.peakLatchedAtIndex = cs?.peakLatchedAtIndex ?? null;
  squatCycleDebug.peakAnchorTruth = cs?.peakAnchorTruth;
  squatCycleDebug.eventBasedDescentPath = cs?.eventBasedDescentPath;
  const ec = cs?.squatEventCycle;
  squatCycleDebug.eventCycleDetected = ec?.detected;
  squatCycleDebug.eventCycleBand = ec?.band ?? null;
  squatCycleDebug.eventCycleNotes =
    ec?.notes != null && ec.notes.length > 0 ? [...ec.notes] : undefined;
  squatCycleDebug.eventCyclePromoted = cs?.eventCyclePromoted;
  squatCycleDebug.eventCycleSource =
    cs?.eventCycleSource ?? (ec?.source === 'none' ? null : ec?.source) ?? null;

  /**
   * PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04: PRIMARY / SECONDARY / LEGACY shallow 필드는
   * 위 `squatCycleDebug` 초기 객체에서 이미 `cs` 기준으로 채움. 아래는 조건부 proof·ticket 만 보강.
   */

  const shallowProofTrace = cs?.shallowClosureProofTrace;
  if (shallowProofTrace != null) {
    squatCycleDebug.shallowClosureProofTrace = shallowProofTrace;
    squatCycleDebug.shallowClosureProofTraceSummary = {
      stage: shallowProofTrace.stage,
      eligible: shallowProofTrace.eligible,
      satisfied: shallowProofTrace.satisfied,
      blockedReason: shallowProofTrace.blockedReason,
      proofBlockedReason: shallowProofTrace.proofBlockedReason,
      consumptionBlockedReason: shallowProofTrace.consumptionBlockedReason,
      firstDecisiveBlockedReason: shallowProofTrace.firstDecisiveBlockedReason,
    };
  }

  if (cs?.shallowCompletionTicket != null) {
    squatCycleDebug.shallowCompletionTicket = cs.shallowCompletionTicket;
  }
  squatCycleDebug.shallowCompletionTicketSatisfied = cs?.shallowCompletionTicketSatisfied;
  squatCycleDebug.shallowCompletionTicketBlockedReason =
    cs?.shallowCompletionTicketBlockedReason ?? null;
  squatCycleDebug.shallowCompletionTicketStage = cs?.shallowCompletionTicketStage ?? null;

  if (guardrail.completionStatus !== 'complete') {
    squatCycleDebug.passBlockedReason = 'guardrail_not_complete';
    squatCycleDebug.completionRejectedReason = 'guardrail_not_complete';
    squatCycleDebug.falsePositiveBlockReason = 'guardrail_not_complete';
    squatCycleDebug.insufficientSignalReason = 'guardrail_not_complete';
    squatCycleDebug.squatEvidenceLevel = 'insufficient_signal';
    squatCycleDebug.squatEvidenceReasons = ['guardrail_not_complete'];
    squatCycleDebug.guardrailPartialReason = guardrail.debug?.guardrailPartialReason;
    return { satisfied: false, squatCycleDebug };
  }
  /**
   * PASS-AUTHORITY-RESET-01: Main pass gate uses immutable passCore.passDetected.
   *
   * Previously: checked completionBlockedReason (which could be 'ultra_low_rom_not_allowed')
   * and currentSquatPhase. This allowed policy and late-setup suppression to revoke passes.
   *
   * Now: passCore.passDetected is the single truth (set before policy lock and late-setup
   * annotation). Policy (ultraLowPolicyBlocked) and late-setup (lateSetupSuppressed) are
   * observability annotations only — they cannot revoke passDetected.
   *
   * Guardrail completionStatus check (above, line 1460) is kept as a signal-quality gate
   * (if capture is incomplete we can't make any motion determination).
   */
  if (!passCore?.passDetected) {
    const blockedReason =
      passCore?.passBlockedReason ?? completionBlockedReason ?? 'not_standing_recovered';
    squatCycleDebug.passBlockedReason = blockedReason;
    squatCycleDebug.completionRejectedReason = blockedReason;
    squatCycleDebug.falsePositiveBlockReason = blockedReason;
    squatCycleDebug.insufficientSignalReason = blockedReason;
    squatCycleDebug.squatEvidenceLevel =
      evidenceLabel === 'insufficient_signal' ? 'insufficient_signal' : squatEvidenceLevel;
    squatCycleDebug.squatEvidenceReasons = [blockedReason];
    return { satisfied: false, squatCycleDebug };
  }
  /**
   * PR-CAM-20: completionPathUsed는 evidenceLabel이 아닌 completionPassReason(성공 오너)에서 파생.
   * evidenceLabel은 품질/해석 레이블로만 유지. 경로 소유권은 상태기계 결과에서 온다.
   */
  squatCycleDebug.completionPathUsed =
    completionPassReason === 'standard_cycle'
      ? 'standard'
      : completionPassReason === 'low_rom_event_cycle' || completionPassReason === 'low_rom_cycle'
        ? 'low_rom'
        : completionPassReason === 'ultra_low_rom_event_cycle' ||
            completionPassReason === 'ultra_low_rom_cycle'
          ? 'ultra_low_rom'
          : completionPassReason === 'official_shallow_cycle'
            ? 'low_rom'
            : undefined;
  squatCycleDebug.successPhaseAtOpen = 'standing_recovered';
  squatCycleDebug.passTriggeredAtPhase = 'standing_recovered';

  // PR-CAM-09: quality cap 로직은 applySquatQualityCap 헬퍼로 위임
  const quality = getSquatQualitySignals(result, guardrail.confidence);
  const capResult = applySquatQualityCap(
    squatEvidenceLevel,
    squatEvidenceReasons,
    evidenceLabel ?? 'insufficient_signal',
    quality
  );

  squatCycleDebug.squatEvidenceLevel = capResult.level;
  squatCycleDebug.squatEvidenceReasons = capResult.reasons;
  squatCycleDebug.qualityInterpretationReason = capResult.qualityInterpretationReason;
  squatCycleDebug.confidenceDowngradeReason = capResult.confidenceDowngradeReason;
  squatCycleDebug.guardrailCompletePath = guardrail.debug?.guardrailCompletePath;
  return { satisfied: true, squatCycleDebug };
}

function getPassConfirmation(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[],
  /** PR-CAM-11B: overhead easy 진행 시 2프레임으로 완화 가능 */
  minStableFrames: number = REQUIRED_STABLE_FRAMES
): {
  satisfied: boolean;
  stableFrameCount: number;
  windowFrameCount: number;
} {
  const recentLandmarks = landmarks.slice(-8);
  if (recentLandmarks.length === 0) {
    return {
      satisfied: false,
      stableFrameCount: 0,
      windowFrameCount: 0,
    };
  }

  const recentFrames = buildPoseFeaturesFrames(stepId, recentLandmarks);
  const stableFrames = recentFrames.filter((frame) => {
    return (
      frame.isValid &&
      frame.visibilitySummary.visibleLandmarkRatio >= 0.45 &&
      frame.visibilitySummary.criticalJointsAvailability >= 0.5 &&
      frame.bodyBox.area >= 0.05 &&
      frame.bodyBox.area <= 0.95 &&
      !frame.qualityHints.includes('timestamp_gap')
    );
  });
  const stableFrameCount = stableFrames.length;
  const recentVisibility =
    stableFrames.length > 0
      ? mean(stableFrames.map((frame) => frame.visibilitySummary.visibleLandmarkRatio))
      : 0;
  const satisfied = stableFrameCount >= minStableFrames && recentVisibility >= 0.52;

  return {
    satisfied,
    stableFrameCount,
    windowFrameCount: recentFrames.length,
  };
}

function getSquatFailureReasons(
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  confidence: number
): string[] {
  const failureReasons = new Set<string>();
  // PR-CAM-09: squatCompletionState 에서 typed 로 읽기
  const completionBlockedReason =
    result.debug?.squatCompletionState?.completionBlockedReason ?? null;

  // CAM-25: low_rom / ultra_low_rom event-cycle 통과 경로는 완화 임계로 confidence 진단
  const sqCs = result.debug?.squatCompletionState;
  const sqPassReason = sqCs?.completionPassReason;
  const squatIsEasyPath =
    sqCs?.completionSatisfied === true &&
    isSquatShallowRomPassReason(sqPassReason) &&
    sqCs?.currentSquatPhase === 'standing_recovered';
  const standardCycleIntegrityBlock = getSquatRawStandardCycleSignalIntegrityBlock(
    sqCs?.completionSatisfied === true,
    guardrail,
    result
  );
  const squatConfFloor = squatIsEasyPath
    ? SQUAT_EASY_PASS_CONFIDENCE
    : BASIC_PASS_CONFIDENCE_THRESHOLD.squat;

  if (guardrail.flags.includes('insufficient_signal')) {
    failureReasons.add('insufficient_signal');
  }
  if (guardrail.flags.includes('valid_frames_too_few')) {
    failureReasons.add('valid_frames_too_few');
  }
  if (guardrail.flags.includes('framing_invalid')) {
    failureReasons.add('framing_invalid');
  }
  if (guardrail.flags.includes('rep_incomplete') || result.completionHints?.includes('rep_phase_incomplete')) {
    failureReasons.add('rep_incomplete');
  }
  if (guardrail.captureQuality !== 'ok') {
    failureReasons.add(
      guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid'
    );
  }
  if (confidence < squatConfFloor) {
    failureReasons.add('confidence_too_low');
  }
  // PR-CAM-09: blocked reason → failure tag 매핑은 squat-retry-reason.ts 헬퍼로 위임
  for (const tag of completionBlockedReasonToFailureTags(completionBlockedReason)) {
    failureReasons.add(tag);
  }
  if (guardrail.flags.includes('left_side_missing')) {
    failureReasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    failureReasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('hard_partial')) {
    failureReasons.add('hard_partial');
  }
  if (standardCycleIntegrityBlock != null) {
    failureReasons.add('standard_cycle_signal_integrity');
  }

  return Array.from(failureReasons);
}

function getFailureReasons(
  stepId: CameraStepId,
  result: EvaluatorResult,
  guardrail: StepGuardrailResult,
  confidence: number,
  completionSatisfied: boolean,
  nextAllowed: boolean
): string[] {
  if (stepId === 'squat') {
    return getSquatFailureReasons(result, guardrail, confidence);
  }

  const reasons = new Set<string>();
  if (guardrail.flags.includes('insufficient_signal')) {
    reasons.add('insufficient_signal');
  }
  if (guardrail.flags.includes('valid_frames_too_few')) {
    reasons.add('valid_frames_too_few');
  }
  if (guardrail.flags.includes('framing_invalid')) {
    reasons.add('framing_invalid');
  }
  if (guardrail.flags.includes('rep_incomplete')) {
    reasons.add('rep_incomplete');
  }
  if (guardrail.flags.includes('hold_too_short')) {
    reasons.add('hold_too_short');
  }
  if (guardrail.captureQuality !== 'ok') {
    reasons.add(guardrail.captureQuality === 'low' ? 'capture_quality_low' : 'capture_quality_invalid');
  }
  const ohm = stepId === 'overhead-reach' ? result.debug?.highlightedMetrics : undefined;
  // PR-SIMPLE-PASS-01: confidence is quality-only for overhead — not added to failure reasons
  const overheadEasyOnly = false; // kept for naming compat, unused for overhead confidence
  const confFloor = overheadEasyOnly
    ? OVERHEAD_EASY_PASS_CONFIDENCE
    : BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  if (stepId !== 'overhead-reach' && confidence < confFloor) {
    reasons.add('confidence_too_low');
  }
  if (guardrail.flags.includes('left_side_missing')) {
    reasons.add('left_side_missing');
  }
  if (guardrail.flags.includes('right_side_missing')) {
    reasons.add('right_side_missing');
  }
  if (guardrail.flags.includes('hard_partial')) {
    reasons.add('hard_partial');
  }
  return Array.from(reasons);
}

/**
 * PR-CAM-10: 장시간 invalid( severeFail ) 직전에도 “의미 있는” 하강+상승/복귀 신호가 있으면
 * 설문 유도 fail 대신 retry 로 한 번 더 기회를 준다. (임계값·completion 로직 변경 없음)
 */
function squatMeaningfulAttemptAllowsRetryInsteadOfSevereFail(
  d: SquatCycleDebug | undefined
): boolean {
  if (!d) return false;
  if (d.evidenceLabel === 'insufficient_signal') return false;
  if (!d.descendDetected) return false;
  if (!d.ascendDetected && !d.recoveryDetected) return false;
  return true;
}

/**
 * PR-4-GATE-FREEZE: Observability-only stamp for `finalPassTimingBlockedReason`.
 *
 * OWNERSHIP: Pure UI gate observability — annotates squatCycleDebug to make the
 * reason a final pass was timing-blocked visible in debug/trace tooling.
 *
 * Does NOT affect `progressionPassed`, `finalPassBlockedReason`, or any
 * completion truth field (completionSatisfied / completionPassReason).
 *
 * Separated from the gate logic so it is clear this is a debug annotation layer,
 * not a second gate decision point.
 */
function stampSquatFinalPassTimingBlockedReason(
  squatCycleDebug: SquatCycleDebug,
  completionSatisfied: boolean,
  squatUiGate: SquatUiGate | null
): SquatCycleDebug {
  if (!completionSatisfied) return squatCycleDebug;
  if (squatCycleDebug.captureArmingSatisfied === false) {
    return { ...squatCycleDebug, finalPassTimingBlockedReason: 'minimum_cycle_duration_not_met' };
  }
  if (
    squatUiGate?.uiProgressionAllowed === false &&
    squatUiGate.uiProgressionBlockedReason === SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON
  ) {
    return {
      ...squatCycleDebug,
      finalPassTimingBlockedReason: SQUAT_ULTRA_LOW_TRAJECTORY_SHORT_CYCLE_UI_BLOCKED_REASON,
    };
  }
  if (
    squatUiGate?.uiProgressionAllowed === false &&
    squatUiGate.uiProgressionBlockedReason === SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON
  ) {
    return {
      ...squatCycleDebug,
      finalPassTimingBlockedReason: SQUAT_SETUP_SERIES_START_FALSE_PASS_BLOCKED_REASON,
    };
  }
  if (
    squatUiGate?.uiProgressionAllowed === false &&
    squatUiGate.uiProgressionBlockedReason ===
      SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON
  ) {
    return {
      ...squatCycleDebug,
      finalPassTimingBlockedReason: SQUAT_BLENDED_EARLY_PEAK_CONTAMINATED_FALSE_PASS_BLOCKED_REASON,
    };
  }
  return squatCycleDebug;
}

export function evaluateExerciseAutoProgress(
  stepId: CameraStepId,
  landmarks: PoseLandmarks[],
  stats: PoseCaptureStats
): ExerciseGateResult {
  const evaluatorResult = runEvaluator(stepId, landmarks);
  const guardrail = assessStepGuardrail(stepId, landmarks, stats, evaluatorResult);
  const confidence = getEffectiveConfidence(stepId, evaluatorResult, guardrail);
  const reasons = getCommonReasons(evaluatorResult, guardrail);
  const passThreshold = BASIC_PASS_CONFIDENCE_THRESHOLD[stepId];
  const overheadEasyOnly = stepId === 'overhead-reach' && isOverheadEasyOnlyProgression(evaluatorResult);
  /**
   * CAM-25 + PR-CAM-CORE: shallow ROM 완료 경로는 squat easy-only branch.
   * evaluatorResult.debug.squatCompletionState 는 runEvaluator() 직후 이미 확정된 값이므로
   * getSquatProgressionCompletionSatisfied() 호출 전에도 안전하게 읽을 수 있다.
   */
  const squatEasyOnly =
    stepId === 'squat' &&
    getSquatPassThresholds(
      evaluatorResult.debug?.squatCompletionState?.completionSatisfied === true,
      evaluatorResult.debug?.squatCompletionState?.completionPassReason,
      evaluatorResult.debug?.squatCompletionState?.currentSquatPhase
    ).easyOnly;
  const passThresholdEffective = getPassThresholdEffective(
    stepId,
    passThreshold,
    overheadEasyOnly,
    squatEasyOnly
  );
  const passConfirmation = getPassConfirmation(
    stepId,
    landmarks,
    // PR-SIMPLE-PASS-01: overhead always uses REQUIRED_STABLE_FRAMES (3) — no easy path variation
    getPassConfirmationMinStableFrames(stepId, squatEasyOnly)
  );
  let completionSatisfied: boolean;
  let squatCycleDebug: SquatCycleDebug | undefined;
  if (stepId === 'squat') {
    const squatResult = getSquatProgressionCompletionSatisfied(evaluatorResult, guardrail, stats);
    completionSatisfied = squatResult.satisfied;
    squatCycleDebug = squatResult.squatCycleDebug;
  } else {
    completionSatisfied = getCompletionSatisfied(stepId, evaluatorResult, guardrail, stats);
  }
  /** PR G10: overhead — passConfirmation is provisional; never true without completion. */
  const effectivePassConfirmation =
    stepId === 'overhead-reach'
      ? passConfirmation.satisfied && completionSatisfied
      : passConfirmation.satisfied;
  const squatQualitySignals =
    stepId === 'squat' ? getSquatQualitySignals(evaluatorResult, confidence) : null;
  const severeFail = isSevereInvalid(guardrail) && stats.captureDurationMs >= 4500;
  const autoAdvanceDelayMs = AUTO_ADVANCE_DELAY_MS[stepId];
  /* PR-CAM-17: easy/low_rom/humane 경로는 완화 임계(0.58) 사용.
   * PR-SIMPLE-PASS-01: overhead는 confidence 기반 retry 없음 — quality-only. */
  const lowConfidenceRetry =
    stepId !== 'overhead-reach' && guardrail.retryRecommended && confidence < passThresholdEffective;
  const hardBlockerReasons = getHardBlockerReasons(stepId, guardrail);
  const noNextAllowed = false;
  const failureReasons = getFailureReasons(
    stepId,
    evaluatorResult,
    guardrail,
    confidence,
    completionSatisfied,
    noNextAllowed
  );
  const userGuidance = getUserGuidance(stepId, failureReasons, guardrail);
  const squatCs = evaluatorResult.debug?.squatCompletionState;
  const severeInvalidForSquat = isSevereInvalid(guardrail);
  const squatDecoupleEligible =
    stepId === 'squat' &&
    isSquatLowQualityPassDecoupleEligible({
      stepId: 'squat',
      completionSatisfied,
      completionPassReason: squatCs?.completionPassReason,
      guardrail,
      severeInvalid: severeInvalidForSquat,
      effectivePassConfirmation,
    });
  const squatRawIntegrityBlock =
    stepId === 'squat'
      ? getSquatRawStandardCycleSignalIntegrityBlock(completionSatisfied, guardrail, evaluatorResult)
      : null;
  const squatIntegrityBlockForPass =
    stepId === 'squat'
      ? squatPassProgressionIntegrityBlock(squatRawIntegrityBlock, squatDecoupleEligible)
      : null;

  /**
   * PR-4-GATE-FREEZE: Squat UI gate pipeline.
   *
   * Sequential ownership layers for squat pass decision:
   *
   *   Step A — Completion truth (READ-ONLY from evaluator output, already finalized)
   *   Step B — Completion owner truth interpretation
   *             (computeSquatCompletionOwnerTruth: reads cs fields, no mutation)
   *   Step C — UI progression latch gate
   *             (computeSquatUiProgressionLatchGate: pure UI signals — confidence,
   *              passConfirmation, captureQuality, setup suppression, arming timing)
   *   Step D — UI-only final-pass blockers
   *             (shouldBlockSquat*: squat-specific UI suppression checks.
   *              May block uiProgressionAllowed. Do NOT write to completion fields.)
   *   Step E — Observability enrichment (see block below, after integrity block)
   *
   * squatSetupTraceForGate and squatReadinessSetupRoutedSources are hoisted here so that
   * Step E reuses the same computed values without a second identical call.
   */
  // 11B freeze: owner truth -> post-owner/pre-latch gate layer -> latch handoff.
  let squatOwnerTruth: SquatOwnerTruth | null = null;
  let squatUiGate: SquatUiGate | null = null;
  let squatPostOwnerGateLayer: SquatPostOwnerPreLatchGateLayer | null = null;
  // Hoisted: shared between gate computation (C) and observability enrichment (E)
  let squatSetupTraceForGate: SquatSetupPhaseTrace | undefined;
  let squatReadinessSetupRoutedSources: SquatReadinessSetupRoutedSources | undefined;

  if (stepId === 'squat') {
    // ── Step A: completion truth — read from squatPassCore (PASS-AUTHORITY-RESET-01) ──
    // squatPassCore.passDetected is the immutable motion pass truth.
    // It was set BEFORE applyUltraLowPolicyLock and before late-setup suppression.
    // squatCs is still read for classification / interpretation fields only.
    const captureArmingOk = squatCycleDebug?.captureArmingSatisfied === true;
    const squatPassCore = evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined;

    // ── Step B: completion owner truth — sourced from passCore, not from completionBlockedReason ──
    // PASS-AUTHORITY-RESET-01: policy (ultraLowPolicyBlocked) and late-setup (lateSetupSuppressed)
    // are now annotation-only. readSquatPassOwnerTruth is shared with the latch fallback path.
    squatOwnerTruth = readSquatPassOwnerTruth({
      squatCompletionState: squatCs,
      squatPassCore,
    });

    // ── Step C: UI progression latch gate ──
    // Pure UI signals: confidence, passConfirmation, captureQuality, setup suppression, arming.
    // setup/live readiness routing is hoisted (squatSetupTraceForGate / squatReadinessSetupRoutedSources)
    // so Step E reuses them without duplicate computation.
    const squatFramesReq = squatEasyOnly ? SQUAT_EASY_LATCH_STABLE_FRAMES : REQUIRED_STABLE_FRAMES;
    squatSetupTraceForGate = (
      evaluatorResult.debug as { squatSetupPhaseTrace?: SquatSetupPhaseTrace } | undefined
    )?.squatSetupPhaseTrace;
    squatReadinessSetupRoutedSources = resolveSquatReadinessSetupGateInputs({
      landmarks,
      guardrail,
      squatSetupPhaseTrace: squatSetupTraceForGate,
      squatCompletionState: squatCs,
    });

    // GUARDRAIL-DECOUPLE-RESET-01: for squat, guardrail.completionStatus is aligned to
    // squatPassCore.passDetected inside guardrails.getMotionCompleteness — legacy
    // highlightedMetrics.completionSatisfied no longer sole motion-complete owner.
    squatPostOwnerGateLayer = computeSquatPostOwnerPreLatchGateLayer({
      stepId,
      ownerTruth: squatOwnerTruth,
      uiGateInput: buildSquatUiProgressionLatchGateInput({
        completionOwnerPassed: squatOwnerTruth.completionOwnerPassed,
        guardrailCompletionComplete: guardrail.completionStatus === 'complete',
        captureQualityInvalid: guardrail.captureQuality === 'invalid',
        confidence,
        passThresholdEffective,
        effectivePassConfirmation,
        passConfirmationFrameCount: passConfirmation.stableFrameCount,
        framesReq: squatFramesReq,
        captureArmingSatisfied: captureArmingOk,
        squatIntegrityBlockForPass,
        reasons,
        hardBlockerReasons,
        liveReadinessNotReady: squatReadinessSetupRoutedSources.liveReadinessNotReady,
        readinessStableDwellSatisfied:
          squatReadinessSetupRoutedSources.readinessStableDwellSatisfied,
        setupMotionBlocked: squatReadinessSetupRoutedSources.setupMotionBlocked,
      }),
      squatCompletionState: squatCs,
      squatCycleDebug,
      squatPassCore,
    });
    squatUiGate = squatPostOwnerGateLayer.uiGate;
  }

  if (squatCycleDebug && stepId === 'squat' && squatRawIntegrityBlock != null) {
    if (!squatDecoupleEligible) {
      squatCycleDebug.standardPathBlockedReason = squatRawIntegrityBlock;
      squatCycleDebug.falsePositiveBlockReason = squatRawIntegrityBlock;
      squatCycleDebug.passBlockedReason = squatRawIntegrityBlock;
    } else {
      squatCycleDebug.qualityInterpretationReason =
        squatCycleDebug.qualityInterpretationReason ?? squatRawIntegrityBlock;
    }
  }

  if (squatCycleDebug && stepId === 'squat') {
    // ── Step E: UI gate observability enrichment ──
    // Pure packaging: annotates squatCycleDebug with gate result fields for debug / trace.
    // Does NOT affect progressionPassed, finalPassBlockedReason, or any completion truth field.
    // squatSetupTraceForGate and squatReadinessSetupRoutedSources are reused from Step C.
    const qWarn = getSquatQualityOnlyWarnings({
      guardrail,
      rawIntegrityBlock: squatRawIntegrityBlock,
      decoupleEligible: squatDecoupleEligible,
    });
    const cpr = squatCs?.completionPassReason;
    const standardOwnerEligible = completionSatisfied === true && cpr === 'standard_cycle';
    const shadowEventOwnerEligible =
      completionSatisfied === true &&
      (cpr === 'low_rom_event_cycle' || cpr === 'ultra_low_rom_event_cycle');
    const lineageOwner = resolveSquatCompletionLineageOwner(cpr);
    const setupSuppressed =
      squatOwnerTruth?.completionOwnerPassed === true &&
      squatUiGate != null &&
      squatUiGate.uiProgressionAllowed === false &&
      ['live_readiness_not_ready', 'readiness_stable_dwell_not_met', 'setup_motion_blocked'].includes(
        squatUiGate.uiProgressionBlockedReason ?? ''
      );
    squatCycleDebug = {
      ...squatCycleDebug,
      completionTruthPassed: squatCompletionTruthPassed(completionSatisfied, cpr),
      qualityOnlyWarnings: qWarn.length > 0 ? qWarn : undefined,
      lowQualityPassAllowed: squatDecoupleEligible,
      passOwner: lineageOwner,
      finalSuccessOwner: lineageOwner,
      standardOwnerEligible,
      shadowEventOwnerEligible,
      ownerFreezeVersion: 'cam-pass-owner-freeze-01',
      completionOwnerPassed: squatOwnerTruth?.completionOwnerPassed,
      completionOwnerReason: squatOwnerTruth?.completionOwnerReason ?? undefined,
      completionOwnerBlockedReason: squatOwnerTruth?.completionOwnerBlockedReason ?? undefined,
      uiProgressionAllowed: squatUiGate?.uiProgressionAllowed,
      uiProgressionBlockedReason: squatUiGate?.uiProgressionBlockedReason ?? undefined,
      liveReadinessSummaryState: squatReadinessSetupRoutedSources?.liveReadinessSummaryState,
      readinessStableDwellSatisfied:
        squatReadinessSetupRoutedSources?.readinessStableDwellSatisfied,
      setupMotionBlocked: squatReadinessSetupRoutedSources?.setupMotionBlocked,
      setupMotionBlockReason: squatReadinessSetupRoutedSources?.setupMotionBlockReason,
      attemptStartedAfterReady: squatReadinessSetupRoutedSources?.attemptStartedAfterReady,
      successSuppressedBySetupPhase: setupSuppressed,
      // PR-CAM-PASS-CORE-RESET-AND-REP-ID-ALIGN-01: stale-pass and rep-identity observability
      passCoreStale:
        (evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined)
          ?.passCoreStale === true,
      passCoreRepId:
        (evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined)?.repId ?? null,
      // Same-rep identity mismatch: pass-core says pass for current rep (not stale)
      // but completion owner is not satisfied. Must be explicit — never silently hidden.
      // RF-STRUCT-12: with pass-core-first owner alignment, this should always be false
      // when pass-core passes — retained for regression observability.
      passCoreRepIdentityMismatch:
        (evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined)?.passDetected ===
          true &&
        (evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined)?.passCoreStale !==
          true &&
        squatOwnerTruth?.completionOwnerPassed !== true,
      // RF-STRUCT-12: owner-read trace block — rep consistency verification.
      squatOwnerRead: (() => {
        const pc = evaluatorResult.debug?.squatPassCore as SquatPassCoreResult | undefined;
        const repTruth = readSquatCurrentRepPassTruth({
          squatPassCore: pc,
          squatCompletionState: squatCs,
        });
        return {
          repId: repTruth.repId,
          ownerPassEligible: repTruth.passEligible,
          ownerBlockedReason: repTruth.blockedReason,
          ownerSource: repTruth.ownerSource,
          timestampsConsistent: repTruth.timestampsConsistent,
          reboundAtRepBoundary: squatCs?.attemptStarted !== true,
        };
      })(),
      squatFinalPassTruth: squatPostOwnerGateLayer?.squatFinalPassTruth,
    } as SquatCycleDebug;
  }

  /** PR-4-GATE-FREEZE: Step E observability stamp — finalPassTimingBlockedReason (debug only) */
  if (squatCycleDebug && stepId === 'squat') {
    squatCycleDebug = stampSquatFinalPassTimingBlockedReason(
      squatCycleDebug,
      completionSatisfied,
      squatUiGate
    );
  }

  if (
    stats.sampledFrameCount === 0 ||
    (!completionSatisfied && stats.captureDurationMs < 2200 && guardrail.captureQuality !== 'invalid')
  ) {
    const detecting = getDetectingMessage(stepId, stats, guardrail);
    return {
      status: 'detecting',
      progressionState: detecting.progressionState,
      confidence,
      completionSatisfied: false,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: guardrail.retryRecommended,
      evaluatorResult,
      guardrail,
      uiMessage: detecting.uiMessage,
      autoAdvanceDelayMs,
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
      finalPassEligible: false,
      finalPassBlockedReason: 'completion_not_satisfied',
    };
  }

  /** PR-CAM-11B/15/16: easy/low-ROM/humane 진행 통과 시 reasons에 남은 hold_too_short/rep_incomplete 로 pass를 막지 않음
   * PR-SIMPLE-PASS-01: completionSatisfied(새 단일 오너)가 true이면 guardrail이 'complete' 반환 → 플래그 불생성 */
  const overheadRepHoldBlocks = getOverheadRepHoldBlocks(stepId, reasons, evaluatorResult);

  const progressionPassed =
    stepId === 'squat'
      ? squatPostOwnerGateLayer?.progressionPassed === true
      : stepId === 'overhead-reach'
        // PR-SIMPLE-PASS-01: confidence is quality-only for overhead — NOT a pass gate
        ? completionSatisfied &&
          guardrail.captureQuality !== 'invalid' &&
          effectivePassConfirmation &&
          !hasAnyReason(reasons, hardBlockerReasons) &&
          !overheadRepHoldBlocks
        : completionSatisfied &&
          guardrail.captureQuality !== 'invalid' &&
          confidence >= passThresholdEffective &&
          effectivePassConfirmation &&
          squatIntegrityBlockForPass == null &&
          !hasAnyReason(reasons, hardBlockerReasons) &&
          !overheadRepHoldBlocks;

  /* PR-CAM-17: final pass 체인 가시성 — 어느 단계에서 pass가 막히는지 즉시 확인 가능. */
  const finalPassBlockedReason =
    stepId === 'squat' && squatPostOwnerGateLayer != null
      ? squatPostOwnerGateLayer.finalPassBlockedReason
      : getFinalPassBlockedReason({
          stepId,
          completionSatisfied,
          confidence,
          passThresholdEffective,
          effectivePassConfirmation,
          guardrail,
          reasons,
          hardBlockerReasons,
          overheadRepHoldBlocks,
          squatOwnerTruth,
          squatUiGate,
          squatCompletionState: squatCs,
          squatIntegrityBlockForPass,
        });
  /**
   * PR-A squat invariants (post-owner surface only):
   *   progressionPassed === finalPassEligible === (finalPassBlockedReason == null)
   *   === squatPostOwnerGateLayer?.squatFinalPassTruth.finalPassGranted (when layer present)
   */
  const finalPassEligible = progressionPassed; // = finalPassBlockedReason === null

  if (progressionPassed) {
    return {
      status: 'pass',
      progressionState: 'passed',
      confidence,
      completionSatisfied: true,
      nextAllowed: true,
      flags: guardrail.flags,
      reasons,
      failureReasons:
        stepId === 'squat' && squatDecoupleEligible
          ? getSquatFailureReasons(evaluatorResult, guardrail, confidence)
          : [],
      userGuidance: [],
      retryRecommended: false,
      evaluatorResult,
      guardrail,
      uiMessage:
        stepId === 'squat' && squatQualitySignals && !squatQualitySignals.strongQuality
          ? '좋습니다, 동작을 확인했어요'
          : '충분한 신호를 확인했어요',
      autoAdvanceDelayMs,
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
      finalPassEligible,
      finalPassBlockedReason,
    };
  }

  if (severeFail) {
    const squatSoftRetry =
      stepId === 'squat' &&
      squatCycleDebug &&
      squatMeaningfulAttemptAllowsRetryInsteadOfSevereFail(squatCycleDebug);
    if (squatSoftRetry) {
      const enrichedSquatDebug = {
        ...squatCycleDebug,
        squatRetryContractObservation: {
          severeFailSoftenedToRetry: true,
          fallbackUsed: 'weak_cycle_retry_instead_of_survey_fail',
        },
      } as SquatCycleDebug;
      return {
        status: 'retry',
        progressionState: 'retry_required',
        confidence,
        completionSatisfied,
        nextAllowed: false,
        flags: guardrail.flags,
        reasons,
        failureReasons,
        userGuidance,
        retryRecommended: true,
        evaluatorResult,
        guardrail,
        uiMessage: getRetryMessage(guardrail),
        autoAdvanceDelayMs,
        passConfirmationSatisfied: passConfirmation.satisfied,
        passConfirmationFrameCount: passConfirmation.stableFrameCount,
        passConfirmationWindowCount: passConfirmation.windowFrameCount,
        squatCycleDebug: enrichedSquatDebug,
        finalPassEligible,
        finalPassBlockedReason,
      };
    }
    return {
      status: 'fail',
      progressionState: 'failed',
      confidence,
      completionSatisfied,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: true,
      evaluatorResult,
      guardrail,
      uiMessage: '설문형으로 전환할 수 있어요',
      autoAdvanceDelayMs,
      passConfirmationSatisfied: effectivePassConfirmation,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
      finalPassEligible,
      finalPassBlockedReason,
    };
  }

  const squatRetryQualityBranch =
    stepId === 'squat' &&
    (squatIntegrityBlockForPass != null ||
      squatRetryTriggeredByPartialFramingReasons(reasons, squatDecoupleEligible));
  const nonSquatPartialRetry =
    stepId !== 'squat' &&
    hasAnyReason(reasons, [
      'rep_incomplete',
      'hold_too_short',
      'left_side_missing',
      'right_side_missing',
      'hard_partial',
    ]);

  if (
    guardrail.captureQuality === 'invalid' ||
    lowConfidenceRetry ||
    squatRetryQualityBranch ||
    nonSquatPartialRetry
  ) {
    const progressionState =
      guardrail.captureQuality === 'invalid' &&
      (guardrail.flags.includes('insufficient_signal') || guardrail.flags.includes('valid_frames_too_few'))
        ? 'insufficient_signal'
        : 'retry_required';

    return {
      status: 'retry',
      progressionState,
      confidence,
      completionSatisfied,
      nextAllowed: false,
      flags: guardrail.flags,
      reasons,
      failureReasons,
      userGuidance,
      retryRecommended: true,
      evaluatorResult,
      guardrail,
      uiMessage:
        progressionState === 'insufficient_signal'
          ? '조금만 더 유지해 주세요'
          : getRetryMessage(guardrail),
      autoAdvanceDelayMs,
      passConfirmationSatisfied: passConfirmation.satisfied,
      passConfirmationFrameCount: passConfirmation.stableFrameCount,
      passConfirmationWindowCount: passConfirmation.windowFrameCount,
      ...(squatCycleDebug && { squatCycleDebug }),
      finalPassEligible,
      finalPassBlockedReason,
    };
  }

  return {
    status: 'detecting',
    progressionState: 'capturing_valid_motion',
    confidence,
    completionSatisfied,
    nextAllowed: false,
    flags: guardrail.flags,
    reasons,
    failureReasons,
    userGuidance,
    retryRecommended: guardrail.retryRecommended,
    evaluatorResult,
    guardrail,
    uiMessage: '좋습니다, 계속하세요',
    autoAdvanceDelayMs,
    passConfirmationSatisfied: effectivePassConfirmation,
    passConfirmationFrameCount: passConfirmation.stableFrameCount,
    passConfirmationWindowCount: passConfirmation.windowFrameCount,
    ...(squatCycleDebug && { squatCycleDebug }),
    finalPassEligible,
    finalPassBlockedReason,
  };
}
