/**
 * PR-04D1: 스쿼트 final progression 전용 — completion truth(사이클 완료)와
 * capture-quality 경고(저품질·부분 프레이밍 등)를 pass gate에서 분리한다.
 *
 * squat-completion-state / HMM assist 정책과 무관 — auto-progression gate 조합만 담당.
 */
import type { EvaluatorResult } from '../evaluators/types';
import type { StepGuardrailResult } from '../guardrails';
import type { CameraStepId } from '@/lib/public/camera-test';

/** standard_cycle + capture low 일 때 signal integrity를 검사하는 guardrail 플래그 집합 */
export const SQUAT_STANDARD_SIGNAL_INTEGRITY_FLAGS = [
  'hard_partial',
  'unstable_frame_timing',
  'unilateral_joint_dropout',
  'left_side_missing',
  'right_side_missing',
] as const;

/**
 * PR-CAM-OWNER-FREEZE-01: 디버그/스냅샷용 — final 성공 오너를 standard vs event completion truth 로 분리.
 * gate progression 산식과 무관(문자열 관측만).
 */
export type SquatPassOwner =
  | 'completion_truth_standard'
  | 'completion_truth_shallow'
  /** @deprecated shallow/event evidence is no longer a final owner. */
  | 'completion_truth_event'
  | 'blocked_by_invalid_capture'
  | 'other';

export type SquatCompletionBand =
  | 'standard_or_deep'
  | 'shallow'
  | 'reject_ultra_low_static'
  | null;

export type SquatSurfaceTemporalTruthSource =
  | 'completion_finalized_payload'
  | 'completion_state_fallback'
  | 'none';

export type SquatFinalSuccessOwner =
  | 'completion_truth_standard'
  | 'completion_truth_shallow'
  | null;

/**
 * Raw integrity block: 기존 getSquatStandardPassIntegrityBlock 와 동일 산식.
 * (standard_cycle + standing_recovered + captureQuality===low + integrity 플래그 하나)
 */
export function getSquatRawStandardCycleSignalIntegrityBlock(
  completionSatisfied: boolean,
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags'>,
  result: Pick<EvaluatorResult, 'debug'>
): string | null {
  const cs = result.debug?.squatCompletionState;
  if (
    completionSatisfied !== true ||
    cs?.completionPassReason !== 'standard_cycle' ||
    cs?.currentSquatPhase !== 'standing_recovered'
  ) {
    return null;
  }
  if (guardrail.captureQuality !== 'low') return null;
  const severeFlag = SQUAT_STANDARD_SIGNAL_INTEGRITY_FLAGS.find((flag) =>
    guardrail.flags.includes(flag)
  );
  return severeFlag ? `standard_cycle_signal_integrity:${severeFlag}` : null;
}

/**
 * 완료 사이클 + 비-invalid 캡처 + severe invalid 아님 + pass 확인 준비됨 →
 * 저품질/integrity/hard_partial 은 pass 차단이 아니라 quality-only 로 강등 가능.
 */
export function isSquatLowQualityPassDecoupleEligible(input: {
  stepId: CameraStepId;
  completionSatisfied: boolean;
  completionPassReason: string | undefined;
  guardrail: Pick<StepGuardrailResult, 'captureQuality'>;
  severeInvalid: boolean;
  effectivePassConfirmation: boolean;
}): boolean {
  if (input.stepId !== 'squat') return false;
  if (!input.completionSatisfied) return false;
  if (input.completionPassReason === 'not_confirmed' || input.completionPassReason == null) {
    return false;
  }
  if (input.guardrail.captureQuality === 'invalid') return false;
  if (input.severeInvalid) return false;
  if (!input.effectivePassConfirmation) return false;
  return true;
}

/**
 * PR-5 — Quality Semantics Split (SSOT §4.4).
 *
 * Confidence decouple eligibility: when the upstream owner law already
 * proved the rep cycle (completionOwnerPassed === true) and the PR-2
 * false-pass guard cleared as part of that opener, `confidence_too_low`
 * must be a quality-only signal, not a pass killer. The caller supplies
 * `completionOwnerPassed` so this helper stays layered — it does not
 * re-derive owner truth.
 *
 * Must still block when:
 *   - completion not satisfied (no cycle truth)
 *   - captureQuality === 'invalid' (severe capture failure — not quality)
 *   - `severeInvalid` true (insufficient signal / framing invalid)
 *   - pass-confirmation not yet ready (cycle stability)
 */
export function isSquatConfidencePassDecoupleEligible(input: {
  stepId: CameraStepId;
  completionOwnerPassed: boolean;
  completionSatisfied: boolean;
  guardrail: Pick<StepGuardrailResult, 'captureQuality'>;
  severeInvalid: boolean;
  effectivePassConfirmation: boolean;
}): boolean {
  if (input.stepId !== 'squat') return false;
  if (!input.completionOwnerPassed) return false;
  if (!input.completionSatisfied) return false;
  if (input.guardrail.captureQuality === 'invalid') return false;
  if (input.severeInvalid) return false;
  if (!input.effectivePassConfirmation) return false;
  return true;
}

/** progression pass / isFinalPassLatched 에 쓰는 integrity — decouple 시 무시(null). */
export function squatPassProgressionIntegrityBlock(
  rawIntegrityBlock: string | null,
  decoupleEligible: boolean
): string | null {
  return decoupleEligible ? null : rawIntegrityBlock;
}

/**
 * decouple 구간에서 pass 를 막지 않고 trace/failureReasons 용으로만 남기는 태그.
 *
 * PR-5 — Quality Semantics Split (SSOT §4.4):
 * confidence_too_low 도 `confidenceDecoupleApplied === true` 일 때 quality-only
 * 경고로 surface 한다. `confidenceDecoupleApplied` 는 UI gate 가 실제로
 * 저confidence 케이스를 demote 했을 때만 true (decoupleEligible 만으론 surface 하지 않음).
 */
export function getSquatQualityOnlyWarnings(input: {
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags'>;
  rawIntegrityBlock: string | null;
  decoupleEligible: boolean;
  confidenceDecoupleApplied?: boolean;
}): string[] {
  const w: string[] = [];
  if (input.decoupleEligible) {
    if (input.guardrail.captureQuality === 'low') w.push('capture_quality_low');
    if (input.guardrail.flags.includes('hard_partial')) w.push('hard_partial');
    if (input.rawIntegrityBlock != null) w.push('standard_cycle_signal_integrity');
  }
  if (input.confidenceDecoupleApplied === true) {
    w.push('confidence_too_low');
  }
  return w;
}

/**
 * retry 분기용: decouple 이면 hard_partial 만으로는 재시도 트리거하지 않음.
 * left/right missing·rep incomplete 등은 그대로 차단.
 */
export function squatRetryTriggeredByPartialFramingReasons(
  reasons: string[],
  decoupleEligible: boolean
): boolean {
  const always: string[] = ['rep_incomplete', 'hold_too_short', 'left_side_missing', 'right_side_missing'];
  if (always.some((r) => reasons.includes(r))) return true;
  if (decoupleEligible) return false;
  return reasons.includes('hard_partial');
}

/** completion truth(사이클 통과) — completion state 소유 필드 해석만 반영, 계산 변경 없음 */
export function squatCompletionTruthPassed(
  completionSatisfied: boolean,
  completionPassReason: string | undefined
): boolean {
  return completionSatisfied === true && completionPassReason !== 'not_confirmed' && completionPassReason != null;
}

/**
 * PR-01 Pass Owner Freeze + PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION —
 * canonical completion-owner truth slice.
 *
 * Reads ONLY the completion-state slice and returns the canonical
 * opener-truth signal (`completionOwnerPassed`) for the single opener
 * law
 *   `completionTruthPassed && completionOwnerPassed && gates clear
 *    && P3 block-only registry clear => finalPassGranted`.
 *
 * UI-layer signals (captureQuality, confidence, passConfirmation,
 * integrity, retry, quality warning, arming timing) are explicitly NOT
 * read here — they are handled downstream by
 * `computeSquatUiProgressionLatchGate` (non-opener consumer). PR-CAM-29A:
 * `SQUAT_ARMING_MS` timing is also a UI/final-latch concern, not
 * completion truth.
 *
 * The returned `completionOwnerReason` is an **explanation label**, not
 * an opener — no reason label (including the formally closed legacy
 * `pass_core_detected`) can bypass the opener chain.
 */
export type SquatCompletionOwnerStateSlice = {
  completionSatisfied?: boolean;
  completionPassReason?: string;
  completionOwnerReason?: string | null;
  currentSquatPhase?: string;
  cycleComplete?: boolean;
  completionBlockedReason?: string | null;
  attemptStarted?: boolean;
  descendConfirmed?: boolean;
  downwardCommitmentReached?: boolean;
  downwardCommitmentDelta?: number;
  reversalConfirmedAfterDescend?: boolean;
  recoveryConfirmedAfterReversal?: boolean;
  officialShallowReversalSatisfied?: boolean;
  ownerAuthoritativeRecoverySatisfied?: boolean;
  standingFinalizeSatisfied?: boolean;
  standingRecoveredAtMs?: number | null;
  attemptStartedAfterReady?: boolean;
  readinessStableDwellSatisfied?: boolean;
  setupMotionBlocked?: boolean;
  evidenceLabel?: string;
  peakLatchedAtIndex?: number | null;
  officialShallowPathCandidate?: boolean;
  officialShallowPathAdmitted?: boolean;
  officialShallowPathReason?: string | null;
  officialShallowPathBlockedReason?: string | null;
  officialShallowPathAdmissionGuardFamily?:
    | 'setup_motion_blocked'
    | 'standing_still_or_jitter_only'
    | 'seated_hold_without_descent'
    | null;
  officialShallowClosureFamily?:
    | 'strict_shallow_cycle'
    | 'shallow_ascent_equivalent'
    /** WAVE A — Family C: shallow proof trio terminal close. */
    | 'shallow_proof_terminal_close'
    | null;
  officialShallowClosureRewriteApplied?: boolean;
  officialShallowClosureRewriteSuppressedReason?: string | null;
  /**
   * PR-X4 — Closure Write Decoupling from Residual Span Veto on
   * Already-Proved Shallow Epochs. Additive diagnostics; not a gate.
   */
  officialShallowProvedSameEpochCloseWriteRepairApplied?: boolean;
  officialShallowProvedSameEpochCloseWriteRepairSuppressedReason?: string | null;
  provisionalShallowTerminalAuthority?: boolean;
  provisionalShallowTerminalAuthorityBlockedReason?: string | null;
  provisionalShallowTerminalAuthoritySource?: string | null;
  provisionalShallowTerminalAuthorityFirstFrameCount?: number | null;
  sameEvalShallowTerminalAuthorityFreezeApplied?: boolean;
  sameEvalShallowTerminalAuthorityFreezeRecoveredFrom?: string | null;
  lateSetupMotionBlockedAfterProvisionalAuthority?: boolean;
  officialShallowPathClosed?: boolean;
  officialShallowClosureProofSatisfied?: boolean;
  baselineFrozen?: boolean;
  peakLatched?: boolean;
  canonicalShallowContractAntiFalsePassClear?: boolean;
  canonicalTemporalEpochOrderSatisfied?: boolean;
  canonicalTemporalEpochOrderBlockedReason?: string | null;
  selectedCanonicalDescentTimingEpochValidIndex?: number | null;
  selectedCanonicalDescentTimingEpochAtMs?: number | null;
  selectedCanonicalPeakEpochValidIndex?: number | null;
  selectedCanonicalPeakEpochAtMs?: number | null;
  selectedCanonicalReversalEpochValidIndex?: number | null;
  selectedCanonicalReversalEpochAtMs?: number | null;
  selectedCanonicalRecoveryEpochValidIndex?: number | null;
  selectedCanonicalRecoveryEpochAtMs?: number | null;
  reversalConfirmedByRuleOrHmm?: boolean;
  officialShallowStreamBridgeApplied?: boolean;
  officialShallowAscentEquivalentSatisfied?: boolean;
  completionFinalizedForSurface?: boolean;
  completionFinalizedOwner?: 'completion' | null;
  completionFinalizedEpochId?: string | null;
  completionFinalizedTemporalOrderSatisfied?: boolean;
  completionFinalizedPassReason?: string | null;
  completionFinalizedDescentAtMs?: number | null;
  completionFinalizedPeakAtMs?: number | null;
  completionFinalizedReversalAtMs?: number | null;
  completionFinalizedRecoveryAtMs?: number | null;
  stillSeatedAtPass?: boolean;
  /**
   * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION + PR-X2-E same-rep window:
   * true when the setup contamination for the current admitted rep was
   * first observed BEFORE commit. When true, `setup_motion_blocked` stays
   * a final veto (real contamination predates the attempt). When false
   * or undefined, late / post-completion setup contamination is demoted
   * to a diagnostic/quality signal by the authority sink.
   */
  sameRepSetupBlockFirstSeenBeforeCommit?: boolean;
  /**
   * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION + PR-X2-E: true when the
   * contamination was first observed AFTER completion. Diagnostic only —
   * sink demotes `setup_motion_blocked` when this is true.
   */
  sameRepSetupBlockFirstSeenAfterCompletion?: boolean;
  /**
   * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION + PR-X2-E: same-rep
   * standing recovery hold truth. When explicitly `false` the
   * `recovery_hold_too_short` family stays a final blocker (genuine
   * too-short hold). When `true` or `undefined` AND the rep already
   * confirmed recovery, the sink demotes hold-family blockers to quality.
   */
  sameRepStandingRecoveryFinalizeSatisfied?: boolean;
  /** PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION: blocks promotion if trajectory-rescue is the only reversal evidence. */
  trajectoryReversalRescueApplied?: boolean;
  squatEventCycle?: {
    detected?: boolean;
    descentFrames?: number;
    notes?: string[];
  };
};

export type OfficialShallowFalsePassGuardFamily =
  | 'no_real_descent'
  | 'no_real_reversal'
  | 'no_real_recovery'
  | 'still_seated_at_pass'
  | 'seated_hold_without_upward_recovery'
  | 'standing_still_or_jitter_only'
  | 'setup_motion_blocked'
  | 'ready_before_start_success'
  | 'cross_epoch_stitched_proof'
  | 'assist_only_closure_without_raw_epoch_provenance'
  | 'canonical_false_pass_guard_not_clear';

export type OfficialShallowFalsePassGuardSnapshot = {
  officialShallowFalsePassGuardClear: boolean;
  officialShallowFalsePassGuardFamily: OfficialShallowFalsePassGuardFamily | null;
  officialShallowFalsePassGuardBlockedReason: string | null;
};

export type OfficialShallowOwnerFreezeSnapshot = {
  officialShallowOwnerFrozen: boolean;
  officialShallowOwnerReason: 'official_shallow_owner_freeze' | null;
  officialShallowOwnerBlockedReason: string | null;
  officialShallowFalsePassGuardFamily: OfficialShallowFalsePassGuardFamily | null;
};

const SQUAT_SHALLOW_COMPLETION_PASS_REASONS = new Set([
  'low_rom_cycle',
  'ultra_low_rom_cycle',
  'low_rom_event_cycle',
  'ultra_low_rom_event_cycle',
  'official_shallow_cycle',
]);

export function resolveSquatCompletionBand(
  cs: SquatCompletionOwnerStateSlice | undefined
): SquatCompletionBand {
  if (cs == null) return null;
  if (cs.completionPassReason === 'standard_cycle') return 'standard_or_deep';
  if (SQUAT_SHALLOW_COMPLETION_PASS_REASONS.has(cs.completionPassReason ?? '')) {
    return 'shallow';
  }
  if (
    cs.evidenceLabel === 'ultra_low_rom' ||
    cs.evidenceLabel === 'low_rom' ||
    cs.evidenceLabel === 'insufficient_signal'
  ) {
    return 'reject_ultra_low_static';
  }
  return null;
}

export function buildSquatCompletionEpochId(
  cs: SquatCompletionOwnerStateSlice | undefined
): string | null {
  if (cs == null) return null;
  if (cs.completionFinalizedEpochId != null) {
    return cs.completionFinalizedEpochId;
  }
  const finalizedDescentAtMs = cs.completionFinalizedDescentAtMs ?? null;
  const finalizedPeakAtMs = cs.completionFinalizedPeakAtMs ?? null;
  const finalizedReversalAtMs = cs.completionFinalizedReversalAtMs ?? null;
  const finalizedRecoveryAtMs = cs.completionFinalizedRecoveryAtMs ?? null;
  if (
    finalizedDescentAtMs != null ||
    finalizedPeakAtMs != null ||
    finalizedReversalAtMs != null ||
    finalizedRecoveryAtMs != null
  ) {
    return `completion:${finalizedDescentAtMs ?? 'na'}:${finalizedPeakAtMs ?? 'na'}:${
      finalizedReversalAtMs ?? 'na'
    }:${finalizedRecoveryAtMs ?? 'na'}`;
  }
  const descent =
    cs.selectedCanonicalDescentTimingEpochAtMs ??
    cs.selectedCanonicalDescentTimingEpochValidIndex ??
    null;
  const peak =
    cs.selectedCanonicalPeakEpochAtMs ??
    cs.selectedCanonicalPeakEpochValidIndex ??
    null;
  const reversal =
    cs.selectedCanonicalReversalEpochAtMs ??
    cs.selectedCanonicalReversalEpochValidIndex ??
    null;
  const recovery =
    cs.selectedCanonicalRecoveryEpochAtMs ??
    cs.selectedCanonicalRecoveryEpochValidIndex ??
    cs.standingRecoveredAtMs ??
    null;
  if (descent == null && peak == null && reversal == null && recovery == null) {
    return null;
  }
  return `completion:${descent ?? 'na'}:${peak ?? 'na'}:${reversal ?? 'na'}:${recovery ?? 'na'}`;
}

type SquatCompletionFinalizedSurfacePayloadRead = {
  completionFinalizedForSurface: boolean;
  completionFinalizedOwner: 'completion' | null;
  completionFinalizedEpochId: string | null;
  completionFinalizedTemporalOrderSatisfied: boolean;
  completionFinalizedPassReason: string | null;
  completionFinalizedDescentAtMs: number | null;
  completionFinalizedPeakAtMs: number | null;
  completionFinalizedReversalAtMs: number | null;
  completionFinalizedRecoveryAtMs: number | null;
  surfaceTemporalTruthSource: SquatSurfaceTemporalTruthSource;
};

function hasCompletionTruthPassedForSurface(
  cs: SquatCompletionOwnerStateSlice | undefined
): boolean {
  return (
    cs?.completionSatisfied === true &&
    cs.completionBlockedReason == null &&
    cs.currentSquatPhase === 'standing_recovered' &&
    cs.cycleComplete === true &&
    cs.completionPassReason != null &&
    cs.completionPassReason !== 'not_confirmed'
  );
}

function readSquatCompletionFinalizedSurfacePayload(
  cs: SquatCompletionOwnerStateSlice | undefined
): SquatCompletionFinalizedSurfacePayloadRead {
  const empty: SquatCompletionFinalizedSurfacePayloadRead = {
    completionFinalizedForSurface: false,
    completionFinalizedOwner: null,
    completionFinalizedEpochId: null,
    completionFinalizedTemporalOrderSatisfied: false,
    completionFinalizedPassReason: null,
    completionFinalizedDescentAtMs: null,
    completionFinalizedPeakAtMs: null,
    completionFinalizedReversalAtMs: null,
    completionFinalizedRecoveryAtMs: null,
    surfaceTemporalTruthSource: 'none',
  };
  if (cs == null) return empty;

  const explicitPayloadPresent =
    cs.completionFinalizedForSurface !== undefined ||
    cs.completionFinalizedOwner !== undefined ||
    cs.completionFinalizedEpochId !== undefined ||
    cs.completionFinalizedTemporalOrderSatisfied !== undefined ||
    cs.completionFinalizedPassReason !== undefined ||
    cs.completionFinalizedDescentAtMs !== undefined ||
    cs.completionFinalizedPeakAtMs !== undefined ||
    cs.completionFinalizedReversalAtMs !== undefined ||
    cs.completionFinalizedRecoveryAtMs !== undefined;

  if (explicitPayloadPresent) {
    const completionTruthPassedForSurface = hasCompletionTruthPassedForSurface(cs);
    const completionFinalizedDescentAtMs = cs.completionFinalizedDescentAtMs ?? null;
    const completionFinalizedPeakAtMs = cs.completionFinalizedPeakAtMs ?? null;
    const completionFinalizedReversalAtMs = cs.completionFinalizedReversalAtMs ?? null;
    const completionFinalizedRecoveryAtMs = cs.completionFinalizedRecoveryAtMs ?? null;
    const completionFinalizedEpochId =
      cs.completionFinalizedEpochId ??
      (completionFinalizedDescentAtMs != null ||
      completionFinalizedPeakAtMs != null ||
      completionFinalizedReversalAtMs != null ||
      completionFinalizedRecoveryAtMs != null
        ? `completion:${completionFinalizedDescentAtMs ?? 'na'}:${
            completionFinalizedPeakAtMs ?? 'na'
          }:${completionFinalizedReversalAtMs ?? 'na'}:${completionFinalizedRecoveryAtMs ?? 'na'}`
        : null);
    return {
      completionFinalizedForSurface:
        completionTruthPassedForSurface &&
        cs.completionFinalizedForSurface === true &&
        cs.completionFinalizedOwner === 'completion' &&
        cs.completionFinalizedTemporalOrderSatisfied === true,
      completionFinalizedOwner:
        completionTruthPassedForSurface && cs.completionFinalizedOwner === 'completion'
          ? 'completion'
          : null,
      completionFinalizedEpochId,
      completionFinalizedTemporalOrderSatisfied:
        completionTruthPassedForSurface &&
        cs.completionFinalizedTemporalOrderSatisfied === true,
      completionFinalizedPassReason:
        completionTruthPassedForSurface ? cs.completionFinalizedPassReason ?? null : null,
      completionFinalizedDescentAtMs,
      completionFinalizedPeakAtMs,
      completionFinalizedReversalAtMs,
      completionFinalizedRecoveryAtMs,
      surfaceTemporalTruthSource: 'completion_finalized_payload',
    };
  }

  if (!hasCompletionTruthPassedForSurface(cs)) {
    return empty;
  }

  return {
    completionFinalizedForSurface: true,
    completionFinalizedOwner: 'completion',
    completionFinalizedEpochId: buildSquatCompletionEpochId(cs),
    completionFinalizedTemporalOrderSatisfied:
      cs.canonicalTemporalEpochOrderSatisfied === true &&
      cs.canonicalTemporalEpochOrderBlockedReason == null,
    completionFinalizedPassReason: cs.completionPassReason ?? null,
    completionFinalizedDescentAtMs: cs.selectedCanonicalDescentTimingEpochAtMs ?? null,
    completionFinalizedPeakAtMs: cs.selectedCanonicalPeakEpochAtMs ?? null,
    completionFinalizedReversalAtMs: cs.selectedCanonicalReversalEpochAtMs ?? null,
    completionFinalizedRecoveryAtMs:
      cs.selectedCanonicalRecoveryEpochAtMs ?? cs.standingRecoveredAtMs ?? null,
    surfaceTemporalTruthSource: 'completion_state_fallback',
  };
}

/**
 * PR-3 — Official Shallow Admission Promotion (SSOT §4.2).
 * Admission-layer snapshot. Admission is NOT closure and NOT pass. This
 * snapshot only reflects whether a legitimate shallow attempt was promoted
 * into an officially admissible shallow attempt, and — when rejected — which
 * admission-level anti-false-pass guard family caused the rejection.
 */
export type OfficialShallowAdmissionGuardFamily =
  | 'setup_motion_blocked'
  | 'standing_still_or_jitter_only'
  | 'seated_hold_without_descent';

export type OfficialShallowAdmissionSnapshot = {
  officialShallowAdmissionCandidate: boolean;
  officialShallowAdmissionAdmitted: boolean;
  officialShallowAdmissionReason: string | null;
  officialShallowAdmissionBlockedReason: string | null;
  officialShallowAdmissionGuardFamily: OfficialShallowAdmissionGuardFamily | null;
};

/**
 * PR-4 — Official Shallow Closure Rewrite (SSOT §4.3).
 * Closure-layer snapshot. Closure is NOT pass and NOT owner truth — those
 * remain governed by PR-1 owner-freeze + PR-2 false-pass guard. This snapshot
 * exposes which closure family proved the shallow ROM cycle and whether the
 * standard veto suppression actively opened the close.
 */
export type OfficialShallowClosureFamily =
  | 'strict_shallow_cycle'
  | 'shallow_ascent_equivalent'
  /** WAVE A — Family C: shallow proof trio terminal close. */
  | 'shallow_proof_terminal_close';

export type OfficialShallowClosureSnapshot = {
  officialShallowClosed: boolean;
  officialShallowClosureFamily: OfficialShallowClosureFamily | null;
  officialShallowClosureRewriteApplied: boolean;
  officialShallowClosureRewriteSuppressedReason: string | null;
};

function officialShallowFalsePassBlocked(
  family: OfficialShallowFalsePassGuardFamily
): OfficialShallowFalsePassGuardSnapshot {
  return {
    officialShallowFalsePassGuardClear: false,
    officialShallowFalsePassGuardFamily: family,
    officialShallowFalsePassGuardBlockedReason: `official_shallow_false_pass_guard:${family}`,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function explicitCanonicalEpochLedgerClear(cs: SquatCompletionOwnerStateSlice): boolean {
  if (cs.canonicalTemporalEpochOrderSatisfied !== true) return false;
  if (cs.canonicalTemporalEpochOrderBlockedReason != null) return false;

  const dIdx = cs.selectedCanonicalDescentTimingEpochValidIndex;
  const pIdx = cs.selectedCanonicalPeakEpochValidIndex;
  const rIdx = cs.selectedCanonicalReversalEpochValidIndex;
  const recIdx = cs.selectedCanonicalRecoveryEpochValidIndex;
  const hasAnyIndex = dIdx != null || pIdx != null || rIdx != null || recIdx != null;
  if (hasAnyIndex) {
    if (
      !isNonNegativeInteger(dIdx) ||
      !isNonNegativeInteger(pIdx) ||
      !isNonNegativeInteger(rIdx) ||
      !isNonNegativeInteger(recIdx) ||
      !(dIdx < pIdx && pIdx < rIdx && rIdx < recIdx)
    ) {
      return false;
    }
  }

  const dAt = cs.selectedCanonicalDescentTimingEpochAtMs;
  const pAt = cs.selectedCanonicalPeakEpochAtMs;
  const rAt = cs.selectedCanonicalReversalEpochAtMs;
  const recAt = cs.selectedCanonicalRecoveryEpochAtMs;
  return (
    isFiniteNumber(dAt) &&
    isFiniteNumber(pAt) &&
    isFiniteNumber(rAt) &&
    isFiniteNumber(recAt) &&
    dAt < pAt &&
    pAt < rAt &&
    rAt < recAt
  );
}

function hasExplicitCanonicalEpochLedger(cs: SquatCompletionOwnerStateSlice): boolean {
  return (
    cs.canonicalTemporalEpochOrderSatisfied != null ||
    cs.canonicalTemporalEpochOrderBlockedReason != null ||
    cs.selectedCanonicalDescentTimingEpochValidIndex != null ||
    cs.selectedCanonicalPeakEpochValidIndex != null ||
    cs.selectedCanonicalReversalEpochValidIndex != null ||
    cs.selectedCanonicalRecoveryEpochValidIndex != null ||
    cs.selectedCanonicalDescentTimingEpochAtMs != null ||
    cs.selectedCanonicalPeakEpochAtMs != null ||
    cs.selectedCanonicalReversalEpochAtMs != null ||
    cs.selectedCanonicalRecoveryEpochAtMs != null
  );
}

export function resolveSquatCompletionInvariantFailureReason(
  cs: SquatCompletionOwnerStateSlice | undefined
): string | null {
  if (cs == null) return 'no_squat_completion_state';

  const completionFinalizedSurfaceTruth =
    readSquatCompletionFinalizedSurfacePayload(cs);
  if (
    completionFinalizedSurfaceTruth.surfaceTemporalTruthSource ===
      'completion_finalized_payload' &&
    completionFinalizedSurfaceTruth.completionFinalizedForSurface === true
  ) {
    return null;
  }

  const band = resolveSquatCompletionBand(cs);
  const notes = cs.squatEventCycle?.notes ?? [];

  /**
   * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION:
   * `setup_motion_blocked` is a **pre-attempt** veto owner only. Once the
   * rep has any attempt evidence (attemptStarted / descendConfirmed /
   * downwardCommitmentReached) AND the setup contamination was NOT first
   * observed before commit, it must not act as a final veto here — it is
   * demoted to a diagnostic/quality signal by the authority sink.
   *
   * The X2-E "pre-commit setup contamination" family keeps blocking via
   * `sameRepSetupBlockFirstSeenBeforeCommit === true`; the real-device
   * deep-retro-veto family (setup contamination observed *after* completion)
   * no longer surfaces here.
   */
  if (cs.setupMotionBlocked === true) {
    const preAttempt =
      cs.attemptStarted !== true &&
      cs.descendConfirmed !== true &&
      cs.downwardCommitmentReached !== true;
    const setupFirstSeenBeforeCommit =
      cs.sameRepSetupBlockFirstSeenBeforeCommit === true;
    if (preAttempt || setupFirstSeenBeforeCommit) {
      return 'setup_motion_blocked';
    }
  }
  if (cs.readinessStableDwellSatisfied === false) return 'readiness_not_stable';
  if (cs.attemptStartedAfterReady === false) return 'attempt_not_after_ready';
  if (cs.stillSeatedAtPass === true) return 'still_seated_at_pass';
  if (notes.includes('jitter_spike_reject')) return 'directionless_jitter';
  if (cs.completionBlockedReason != null && cs.completionBlockedReason !== '') {
    return cs.completionBlockedReason;
  }
  if (cs.completionSatisfied !== true) return 'completion_not_satisfied';
  if (cs.currentSquatPhase !== 'standing_recovered') return 'not_standing_recovered';
  if (cs.cycleComplete !== true) return 'cycle_not_complete';
  if (cs.completionPassReason == null || cs.completionPassReason === 'not_confirmed') {
    return 'completion_pass_reason_invalid';
  }
  if (band !== 'standard_or_deep' && band !== 'shallow') {
    return band === 'reject_ultra_low_static'
      ? 'reject_ultra_low_static'
      : 'completion_band_invalid';
  }
  if (cs.attemptStarted !== true) return 'no_descent_attempt';
  if (
    cs.descendConfirmed !== true ||
    cs.downwardCommitmentReached !== true ||
    !((cs.downwardCommitmentDelta ?? 0) > 0)
  ) {
    return 'no_real_descent';
  }
  if (
    band === 'shallow' &&
    (cs.baselineFrozen !== true ||
      cs.peakLatched !== true ||
      cs.peakLatchedAtIndex == null ||
      cs.peakLatchedAtIndex <= 0)
  ) {
    return 'shallow_epoch_not_armed';
  }
  if (cs.reversalConfirmedAfterDescend !== true) return 'no_reversal_after_descend';
  if (cs.recoveryConfirmedAfterReversal !== true) return 'no_recovery_after_reversal';
  if (cs.standingRecoveredAtMs == null) return 'standing_recovery_missing';
  if (
    band === 'shallow' &&
    cs.ownerAuthoritativeRecoverySatisfied !== true &&
    cs.standingFinalizeSatisfied !== true
  ) {
    return 'shallow_recovery_not_authoritative';
  }
  if (cs.canonicalTemporalEpochOrderBlockedReason != null) {
    return `temporal_epoch_order:${cs.canonicalTemporalEpochOrderBlockedReason}`;
  }
  if (hasExplicitCanonicalEpochLedger(cs)) {
    if (cs.canonicalTemporalEpochOrderSatisfied === false) {
      return 'temporal_epoch_order_not_satisfied';
    }
    if (cs.canonicalTemporalEpochOrderSatisfied === true && !explicitCanonicalEpochLedgerClear(cs)) {
      return 'temporal_epoch_order_incomplete';
    }
  }
  return null;
}

/**
 * PR-5 — Quality Semantics Split (SSOT §4.4).
 *
 * Quality-semantics split snapshot. Post-pass diagnostic. Records which
 * signals crossed from pass gate to quality interpretation on this tick.
 *
 * `qualityOnlyWarnings` mirrors `getSquatQualityOnlyWarnings` output and
 * should be surfaced by downstream UI/latch writers for observability.
 * Pass / owner / final-latch decisions must NOT read this snapshot — they
 * use the explicit gate signals (`completionOwnerPassed`, UI gate result,
 * PR-2 guard, absurd-pass registry).
 */
export type SquatQualitySemanticsSplitSnapshot = {
  lowQualityDecoupleEligible: boolean;
  confidenceDecoupleEligible: boolean;
  confidenceDecoupleApplied: boolean;
  qualityOnlyWarnings: string[];
};

export function readSquatQualitySemanticsSplitSnapshot(input: {
  lowQualityDecoupleEligible: boolean;
  confidenceDecoupleEligible: boolean;
  confidenceDecoupleApplied: boolean;
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags'>;
  rawIntegrityBlock: string | null;
}): SquatQualitySemanticsSplitSnapshot {
  const qualityOnlyWarnings = getSquatQualityOnlyWarnings({
    guardrail: input.guardrail,
    rawIntegrityBlock: input.rawIntegrityBlock,
    decoupleEligible: input.lowQualityDecoupleEligible,
    confidenceDecoupleApplied: input.confidenceDecoupleApplied,
  });
  return {
    lowQualityDecoupleEligible: input.lowQualityDecoupleEligible,
    confidenceDecoupleEligible: input.confidenceDecoupleEligible,
    confidenceDecoupleApplied: input.confidenceDecoupleApplied,
    qualityOnlyWarnings,
  };
}

/**
 * PR-4 §4.3: Read the closure-stage snapshot. Diagnostic / sink-only —
 * downstream pass / owner gates must not depend on this. PR-1 owner-freeze
 * and PR-2 false-pass guard remain the independent final pass authorities.
 */
export function readOfficialShallowClosureSnapshot(input: {
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): OfficialShallowClosureSnapshot {
  const cs = input.squatCompletionState;
  if (cs == null) {
    return {
      officialShallowClosed: false,
      officialShallowClosureFamily: null,
      officialShallowClosureRewriteApplied: false,
      officialShallowClosureRewriteSuppressedReason: null,
    };
  }
  return {
    officialShallowClosed: cs.officialShallowPathClosed === true,
    officialShallowClosureFamily: cs.officialShallowClosureFamily ?? null,
    officialShallowClosureRewriteApplied:
      cs.officialShallowClosureRewriteApplied === true,
    officialShallowClosureRewriteSuppressedReason:
      cs.officialShallowClosureRewriteSuppressedReason ?? null,
  };
}

/**
 * PR-3 §4.2: Read the admission-stage snapshot. Diagnostic only — downstream
 * closure / pass gates must not depend on this, and admission does not grant
 * pass. This mirrors the admission contract fields surfaced by
 * `squat-completion-core.ts` without re-deriving admission rules.
 */
export function readOfficialShallowAdmissionSnapshot(input: {
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): OfficialShallowAdmissionSnapshot {
  const cs = input.squatCompletionState;
  if (cs == null) {
    return {
      officialShallowAdmissionCandidate: false,
      officialShallowAdmissionAdmitted: false,
      officialShallowAdmissionReason: null,
      officialShallowAdmissionBlockedReason: null,
      officialShallowAdmissionGuardFamily: null,
    };
  }
  return {
    officialShallowAdmissionCandidate: cs.officialShallowPathCandidate === true,
    officialShallowAdmissionAdmitted: cs.officialShallowPathAdmitted === true,
    officialShallowAdmissionReason: cs.officialShallowPathReason ?? null,
    officialShallowAdmissionBlockedReason: cs.officialShallowPathBlockedReason ?? null,
    officialShallowAdmissionGuardFamily:
      cs.officialShallowPathAdmissionGuardFamily ?? null,
  };
}

export function readOfficialShallowFalsePassGuardSnapshot(input: {
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): OfficialShallowFalsePassGuardSnapshot {
  const cs = input.squatCompletionState;
  if (cs == null || cs.officialShallowPathClosed !== true) {
    return {
      officialShallowFalsePassGuardClear: false,
      officialShallowFalsePassGuardFamily: null,
      officialShallowFalsePassGuardBlockedReason: null,
    };
  }

  const notes = cs.squatEventCycle?.notes ?? [];
  // Post-PR3: a consumed late shallow authority may be ahead of the canonical
  // proof/epoch mirrors, so re-check the concrete bundle instead of requiring
  // those mirrors to have caught up.
  const lateShallowClosureCapableAuthority =
    cs.provisionalShallowTerminalAuthority === true &&
    cs.officialShallowPathAdmitted === true &&
    cs.baselineFrozen === true &&
    cs.peakLatched === true &&
    cs.reversalConfirmedAfterDescend === true &&
    cs.recoveryConfirmedAfterReversal === true &&
    cs.officialShallowStreamBridgeApplied === true &&
    cs.officialShallowAscentEquivalentSatisfied === true &&
    cs.officialShallowReversalSatisfied === true &&
    cs.setupMotionBlocked !== true &&
    cs.evidenceLabel !== 'insufficient_signal' &&
    cs.attemptStarted === true &&
    cs.descendConfirmed === true &&
    cs.downwardCommitmentReached === true &&
    (cs.downwardCommitmentDelta ?? 0) > 0 &&
    (cs.peakLatchedAtIndex ?? -1) > 0 &&
    cs.stillSeatedAtPass !== true &&
    !notes.includes('jitter_spike_reject') &&
    !(
      cs.squatEventCycle?.detected === false &&
      (cs.squatEventCycle?.descentFrames ?? 0) === 0 &&
      (cs.downwardCommitmentDelta ?? 0) <= 0
    ) &&
    ![
      'mixed_rep_epoch_contamination',
      'stale_prior_rep_epoch',
      'recovery_not_after_reversal',
      'reversal_not_after_peak',
      'peak_not_after_descent',
    ].includes(cs.canonicalTemporalEpochOrderBlockedReason ?? '');

  if (cs.setupMotionBlocked === true) {
    return officialShallowFalsePassBlocked('setup_motion_blocked');
  }
  if (cs.readinessStableDwellSatisfied === false || cs.attemptStartedAfterReady === false) {
    return officialShallowFalsePassBlocked('ready_before_start_success');
  }
  if (cs.stillSeatedAtPass === true) {
    return officialShallowFalsePassBlocked('still_seated_at_pass');
  }
  if (
    cs.evidenceLabel === 'insufficient_signal' ||
    notes.includes('jitter_spike_reject') ||
    (cs.squatEventCycle?.detected === false &&
      (cs.squatEventCycle?.descentFrames ?? 0) === 0 &&
      (cs.downwardCommitmentDelta ?? 0) <= 0)
  ) {
    return officialShallowFalsePassBlocked('standing_still_or_jitter_only');
  }
  if (
    cs.attemptStarted !== true ||
    cs.descendConfirmed !== true ||
    cs.downwardCommitmentReached !== true ||
    !((cs.downwardCommitmentDelta ?? 0) > 0)
  ) {
    return officialShallowFalsePassBlocked('no_real_descent');
  }
  if (cs.peakLatchedAtIndex == null || cs.peakLatchedAtIndex <= 0) {
    return officialShallowFalsePassBlocked('ready_before_start_success');
  }
  if (
    cs.reversalConfirmedAfterDescend !== true ||
    cs.officialShallowReversalSatisfied !== true
  ) {
    return officialShallowFalsePassBlocked('no_real_reversal');
  }
  if (
    cs.recoveryConfirmedAfterReversal !== true ||
    (cs.ownerAuthoritativeRecoverySatisfied !== true &&
      cs.standingFinalizeSatisfied !== true) ||
    cs.standingRecoveredAtMs == null
  ) {
    if (lateShallowClosureCapableAuthority) {
      return {
        officialShallowFalsePassGuardClear: true,
        officialShallowFalsePassGuardFamily: null,
        officialShallowFalsePassGuardBlockedReason: null,
      };
    }
    if (cs.currentSquatPhase !== 'standing_recovered' || cs.standingRecoveredAtMs == null) {
      return officialShallowFalsePassBlocked('seated_hold_without_upward_recovery');
    }
    return officialShallowFalsePassBlocked('no_real_recovery');
  }
  const epochLedgerClear = explicitCanonicalEpochLedgerClear(cs);
  if (
    cs.reversalConfirmedByRuleOrHmm !== true &&
    cs.officialShallowStreamBridgeApplied === true &&
    !epochLedgerClear &&
    !lateShallowClosureCapableAuthority
  ) {
    return officialShallowFalsePassBlocked(
      'assist_only_closure_without_raw_epoch_provenance'
    );
  }
  if (!epochLedgerClear && !lateShallowClosureCapableAuthority) {
    return officialShallowFalsePassBlocked('cross_epoch_stitched_proof');
  }
  if (
    cs.canonicalShallowContractAntiFalsePassClear !== true &&
    !lateShallowClosureCapableAuthority
  ) {
    return officialShallowFalsePassBlocked('canonical_false_pass_guard_not_clear');
  }

  return {
    officialShallowFalsePassGuardClear: true,
    officialShallowFalsePassGuardFamily: null,
    officialShallowFalsePassGuardBlockedReason: null,
  };
}

export function readOfficialShallowOwnerFreezeSnapshot(input: {
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): OfficialShallowOwnerFreezeSnapshot {
  const cs = input.squatCompletionState;
  if (cs == null || cs.officialShallowPathClosed !== true) {
    return {
      officialShallowOwnerFrozen: false,
      officialShallowOwnerReason: null,
      officialShallowOwnerBlockedReason: null,
      officialShallowFalsePassGuardFamily: null,
    };
  }

  // PR-X: official shallow close is diagnostic/admission evidence only.
  // It may describe why completion was able to write `official_shallow_cycle`,
  // but it cannot freeze or open final pass on its own.
  const falsePassGuard = readOfficialShallowFalsePassGuardSnapshot(input);
  if (falsePassGuard.officialShallowFalsePassGuardClear !== true) {
    return {
      officialShallowOwnerFrozen: false,
      officialShallowOwnerReason: null,
      officialShallowOwnerBlockedReason:
        falsePassGuard.officialShallowFalsePassGuardBlockedReason ??
        'official_shallow_false_pass_guard_not_clear',
      officialShallowFalsePassGuardFamily:
        falsePassGuard.officialShallowFalsePassGuardFamily,
    };
  }

  return {
    officialShallowOwnerFrozen: false,
    officialShallowOwnerReason: null,
    officialShallowOwnerBlockedReason: null,
    officialShallowFalsePassGuardFamily: null,
  };
}

export function computeSquatCompletionOwnerTruth(input: {
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): {
  completionOwnerPassed: boolean;
  completionOwnerReason: string | null;
  completionOwnerBlockedReason: string | null;
  completionBand: SquatCompletionBand;
  completionInvariantFailureReason: string | null;
  completionEpochId: string | null;
  finalPassSource: 'completion';
  finalSuccessOwner: SquatFinalSuccessOwner;
  officialShallowOwnerFrozen: boolean;
  officialShallowOwnerFreezeBlockedReason: string | null;
  completionFinalizedForSurface: boolean;
  completionFinalizedOwner: 'completion' | null;
  completionFinalizedEpochId: string | null;
  completionFinalizedTemporalOrderSatisfied: boolean;
  completionFinalizedPassReason: string | null;
  completionFinalizedDescentAtMs: number | null;
  completionFinalizedPeakAtMs: number | null;
  completionFinalizedReversalAtMs: number | null;
  completionFinalizedRecoveryAtMs: number | null;
  surfaceTemporalTruthSource: SquatSurfaceTemporalTruthSource;
} {
  const cs = input.squatCompletionState;
  const officialShallowOwnerFreeze = readOfficialShallowOwnerFreezeSnapshot(input);
  const completionBand = resolveSquatCompletionBand(cs);
  const completionFinalizedSurfaceTruth =
    readSquatCompletionFinalizedSurfacePayload(cs);
  const completionInvariantFailureReason = resolveSquatCompletionInvariantFailureReason(cs);
  const completionEpochId = buildSquatCompletionEpochId(cs);
  if (cs == null) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'no_squat_completion_state',
      completionBand,
      completionInvariantFailureReason,
      completionEpochId,
      finalPassSource: 'completion',
      finalSuccessOwner: null,
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
      ...completionFinalizedSurfaceTruth,
    };
  }

  if (completionInvariantFailureReason != null) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: completionInvariantFailureReason,
      completionBand,
      completionInvariantFailureReason,
      completionEpochId,
      finalPassSource: 'completion',
      finalSuccessOwner: null,
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason:
        officialShallowOwnerFreeze.officialShallowOwnerBlockedReason,
      ...completionFinalizedSurfaceTruth,
    };
  }

  const cpr = cs.completionPassReason;
  const explicitShallowOwnerReason =
    cs.completionOwnerReason === 'shallow_complete_rule' ||
    cs.completionOwnerReason === 'ultra_low_rom_complete_rule'
      ? cs.completionOwnerReason
      : null;
  const finalSuccessOwner: SquatFinalSuccessOwner =
    completionBand === 'standard_or_deep'
      ? 'completion_truth_standard'
      : completionBand === 'shallow'
        ? 'completion_truth_shallow'
        : null;
  return {
    completionOwnerPassed: true,
    completionOwnerReason: explicitShallowOwnerReason ?? cpr ?? null,
    completionOwnerBlockedReason: null,
    completionBand,
    completionInvariantFailureReason: null,
    completionEpochId,
    finalPassSource: 'completion',
    finalSuccessOwner,
    officialShallowOwnerFrozen: false,
    officialShallowOwnerFreezeBlockedReason: null,
    ...completionFinalizedSurfaceTruth,
  };
}

/**
 * PR-01: 최종 성공 스냅샷용 — completionPassReason 만으로 lineage(standard vs event).
 * capture / decouple / invalid 는 여기서 다루지 않는다(resolveSquatPassOwner 단위 테스트·레거시 호출은 유지).
 */
export function resolveSquatCompletionLineageOwner(
  completionPassReason: string | undefined
): SquatPassOwner {
  if (completionPassReason === 'standard_cycle') return 'completion_truth_standard';
  if (
    completionPassReason === 'low_rom_cycle' ||
    completionPassReason === 'ultra_low_rom_cycle' ||
    completionPassReason === 'low_rom_event_cycle' ||
    completionPassReason === 'ultra_low_rom_event_cycle' ||
    completionPassReason === 'official_shallow_cycle'
  ) {
    return 'completion_truth_shallow';
  }
  return 'other';
}

export function resolveSquatPassOwner(input: {
  guardrail: Pick<StepGuardrailResult, 'captureQuality'>;
  severeInvalid: boolean;
  decoupleEligible: boolean;
  completionSatisfied: boolean;
  completionPassReason: string | undefined;
}): SquatPassOwner {
  if (input.guardrail.captureQuality === 'invalid' || input.severeInvalid) {
    return 'blocked_by_invalid_capture';
  }
  if (input.decoupleEligible && input.completionSatisfied) {
    if (input.completionPassReason === 'standard_cycle') return 'completion_truth_standard';
    if (
      input.completionPassReason === 'low_rom_cycle' ||
      input.completionPassReason === 'ultra_low_rom_cycle' ||
      input.completionPassReason === 'low_rom_event_cycle' ||
      input.completionPassReason === 'ultra_low_rom_event_cycle' ||
      input.completionPassReason === 'official_shallow_cycle'
    ) {
      return 'completion_truth_shallow';
    }
  }
  return 'other';
}

/**
 * PR-SQUAT-FINAL-PASS-AUTHORITY-SIMPLIFICATION — single final-pass authority sink.
 *
 * ## Intent
 * The final pass owner for squat is `completion` (standard or official shallow
 * variation). Secondary layers (pass-core / event-cycle / official-shallow-
 * stream-bridge / UI gate / setup-motion-block detector) may only DIAGNOSE or
 * BLOCK CONDITIONALLY — they may not cancel a rep whose completion truth has
 * already been established.
 *
 * Without this sink, real-device traces show:
 *   - Shallow: admit + reversal + recovery all true → blocked by
 *     `shallow_descent_too_short` at final authority.
 *   - Deep: descent + reversal + recovery all true → blocked by
 *     `setup_motion_blocked:large_framing_translation` or
 *     `recovery_hold_too_short` after the rep already completed.
 *
 * The sink resolves the final decision as:
 *
 *   pre-attempt && setupMotionBlocked (first-seen-before-commit) → fail
 *   standard completion truth proven (descend + reversal + recovery + !seated)
 *     → pass `completion_truth_standard`
 *   official shallow completion truth proven
 *     → pass `completion_truth_official_shallow`
 *   else → fail with whatever completion-truth-aligned blocked reason upstream
 *     produced
 *
 * ## What this does NOT do
 * - Does NOT introduce a new owner or competing authority.
 * - Does NOT change completion writers, evaluators, thresholds, or HMM paths.
 * - Does NOT open pass when descent / reversal / recovery is genuinely missing.
 * - Does NOT open pass when the user is still seated at pass (false-positive lock).
 */
export type SquatFinalPassAuthoritySinkReason =
  | null
  /** Pre-existing owner was already passing — sink did not need to intervene. */
  | 'owner_already_passed'
  /** Owner was already failing, sink did not apply (no simplification match). */
  | 'owner_blocked_no_simplification'
  /** Sink promoted to `completion_truth_standard` by demoting a retro setup block. */
  | 'promote_standard_demote_setup_motion_blocked'
  /** Sink promoted to `completion_truth_standard` by demoting recovery-hold warning. */
  | 'promote_standard_demote_recovery_hold_too_short'
  /** Sink promoted to `completion_truth_official_shallow` by demoting shallow descent-span warning. */
  | 'promote_official_shallow_demote_shallow_descent_too_short'
  /** Sink promoted to `completion_truth_official_shallow` by demoting a retro setup block. */
  | 'promote_official_shallow_demote_setup_motion_blocked'
  /** Sink promoted to `completion_truth_official_shallow` by demoting recovery-hold warning. */
  | 'promote_official_shallow_demote_recovery_hold_too_short';

export type SquatFinalPassAuthorityPassOwner =
  | 'completion_truth_standard'
  | 'completion_truth_official_shallow'
  | null;

export type SquatFinalPassAuthorityOwnerTruthInput = {
  completionOwnerPassed: boolean;
  completionOwnerReason: string | null;
  completionOwnerBlockedReason: string | null;
  completionBand: SquatCompletionBand;
  completionInvariantFailureReason: string | null;
  completionEpochId: string | null;
  finalPassSource: 'completion';
  finalSuccessOwner: SquatFinalSuccessOwner;
  officialShallowOwnerFrozen: boolean;
  officialShallowOwnerFreezeBlockedReason: string | null;
  completionFinalizedForSurface: boolean;
  completionFinalizedOwner: 'completion' | null;
  completionFinalizedEpochId: string | null;
  completionFinalizedTemporalOrderSatisfied: boolean;
  completionFinalizedPassReason: string | null;
  completionFinalizedDescentAtMs: number | null;
  completionFinalizedPeakAtMs: number | null;
  completionFinalizedReversalAtMs: number | null;
  completionFinalizedRecoveryAtMs: number | null;
  surfaceTemporalTruthSource: SquatSurfaceTemporalTruthSource;
};

export type SquatFinalPassAuthorityResult = {
  ownerTruth: SquatFinalPassAuthorityOwnerTruthInput;
  simplificationApplied: boolean;
  authoritySinkReason: SquatFinalPassAuthoritySinkReason;
  passOwner: SquatFinalPassAuthorityPassOwner;
  demotedBlockedReason: string | null;
};

/**
 * Strip a leading `owner_contradiction:` prefix so the sink can match the
 * underlying writer reason (e.g. `owner_contradiction:shallow_descent_too_short`
 * → `shallow_descent_too_short`).
 */
function bareCompletionOwnerBlockedReason(reason: string | null): string {
  if (reason == null) return '';
  const prefix = 'owner_contradiction:';
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason;
}

export function resolveSquatFinalPassAuthoritySimplification(input: {
  ownerTruth: SquatFinalPassAuthorityOwnerTruthInput;
  squatCompletionState: SquatCompletionOwnerStateSlice | undefined;
}): SquatFinalPassAuthorityResult {
  const ot = input.ownerTruth;
  const cs = input.squatCompletionState;

  // Owner already passed — sink passes through without mutation.
  if (ot.completionOwnerPassed === true) {
    const passOwner: SquatFinalPassAuthorityPassOwner =
      ot.finalSuccessOwner === 'completion_truth_standard'
        ? 'completion_truth_standard'
        : ot.finalSuccessOwner === 'completion_truth_shallow'
          ? 'completion_truth_official_shallow'
          : null;
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_already_passed',
      passOwner,
      demotedBlockedReason: null,
    };
  }

  if (cs == null) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }

  // Hard false-positive locks — NEVER demote.
  if (cs.stillSeatedAtPass === true) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }
  const hasAnyAttempt =
    cs.attemptStarted === true ||
    cs.descendConfirmed === true ||
    cs.downwardCommitmentReached === true;
  if (!hasAnyAttempt) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }
  if (cs.recoveryConfirmedAfterReversal !== true) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }
  if (cs.trajectoryReversalRescueApplied === true) {
    // Trajectory-only reversal without raw epoch proof is a documented false
    // positive family — never open at the authority sink.
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }

  const rawBlocker = ot.completionOwnerBlockedReason;
  const bareBlocker = bareCompletionOwnerBlockedReason(rawBlocker);

  // Only these specific upstream reasons are candidates for demotion.
  const isSetupMotionBlocker = bareBlocker === 'setup_motion_blocked';
  const isRecoveryHoldBlocker =
    bareBlocker === 'recovery_hold_too_short' ||
    bareBlocker === 'low_rom_standing_finalize_not_satisfied' ||
    bareBlocker === 'ultra_low_rom_standing_finalize_not_satisfied';
  const isShallowDescentBlocker = bareBlocker === 'shallow_descent_too_short';

  if (!isSetupMotionBlocker && !isRecoveryHoldBlocker && !isShallowDescentBlocker) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }

  // Standard completion truth: descend + rule/hmm reversal + recovery.
  const standardReady =
    cs.descendConfirmed === true &&
    cs.downwardCommitmentReached === true &&
    (cs.downwardCommitmentDelta ?? 0) > 0 &&
    cs.reversalConfirmedAfterDescend === true &&
    cs.reversalConfirmedByRuleOrHmm === true &&
    cs.recoveryConfirmedAfterReversal === true;

  // Official shallow completion truth: admission + shallow reversal +
  // ascent-equivalent + recovery + rule/hmm reversal provenance.
  const officialShallowReady =
    cs.officialShallowPathAdmitted === true &&
    cs.officialShallowReversalSatisfied === true &&
    cs.officialShallowAscentEquivalentSatisfied === true &&
    cs.recoveryConfirmedAfterReversal === true &&
    cs.reversalConfirmedByRuleOrHmm === true;

  // Setup-motion-block retro-veto guard: pre-commit contamination keeps
  // blocking; post-attempt / post-completion contamination is demoted.
  const setupBlockIsRetroVeto =
    isSetupMotionBlocker &&
    cs.sameRepSetupBlockFirstSeenBeforeCommit !== true;

  // Recovery-hold retro-veto guard: explicit `false` keeps blocking (genuine
  // too-short hold); `true` or `undefined` AND any other standing-finalize
  // evidence demotes.
  const holdTruthExplicitlyFalse =
    cs.sameRepStandingRecoveryFinalizeSatisfied === false;
  const holdTruthSatisfiedOrUnknown =
    !holdTruthExplicitlyFalse &&
    (cs.sameRepStandingRecoveryFinalizeSatisfied === true ||
      cs.ownerAuthoritativeRecoverySatisfied === true ||
      cs.standingFinalizeSatisfied === true);
  const recoveryHoldIsQualityOnly =
    isRecoveryHoldBlocker &&
    cs.recoveryConfirmedAfterReversal === true &&
    holdTruthSatisfiedOrUnknown;

  const shallowDescentIsQualityOnly =
    isShallowDescentBlocker && officialShallowReady;

  // Decide whether to promote and under which lineage.
  let promoteAs: 'standard' | 'official_shallow' | null = null;
  let sinkReason: SquatFinalPassAuthoritySinkReason = 'owner_blocked_no_simplification';

  if (setupBlockIsRetroVeto) {
    if (standardReady) {
      promoteAs = 'standard';
      sinkReason = 'promote_standard_demote_setup_motion_blocked';
    } else if (officialShallowReady) {
      promoteAs = 'official_shallow';
      sinkReason = 'promote_official_shallow_demote_setup_motion_blocked';
    }
  } else if (recoveryHoldIsQualityOnly) {
    if (standardReady) {
      promoteAs = 'standard';
      sinkReason = 'promote_standard_demote_recovery_hold_too_short';
    } else if (officialShallowReady) {
      promoteAs = 'official_shallow';
      sinkReason = 'promote_official_shallow_demote_recovery_hold_too_short';
    }
  } else if (shallowDescentIsQualityOnly) {
    // shallow_descent_too_short is a shallow-only blocker.
    promoteAs = 'official_shallow';
    sinkReason = 'promote_official_shallow_demote_shallow_descent_too_short';
  }

  if (promoteAs == null) {
    return {
      ownerTruth: ot,
      simplificationApplied: false,
      authoritySinkReason: 'owner_blocked_no_simplification',
      passOwner: null,
      demotedBlockedReason: null,
    };
  }

  const finalSuccessOwner: SquatFinalSuccessOwner =
    promoteAs === 'standard' ? 'completion_truth_standard' : 'completion_truth_shallow';
  const completionOwnerReason =
    promoteAs === 'standard' ? 'standard_cycle' : 'official_shallow_cycle';
  const completionBand: SquatCompletionBand =
    promoteAs === 'standard' ? 'standard_or_deep' : 'shallow';
  const passOwner: SquatFinalPassAuthorityPassOwner =
    promoteAs === 'standard'
      ? 'completion_truth_standard'
      : 'completion_truth_official_shallow';

  const simplifiedOwnerTruth: SquatFinalPassAuthorityOwnerTruthInput = {
    ...ot,
    completionOwnerPassed: true,
    completionOwnerReason,
    completionOwnerBlockedReason: null,
    completionBand,
    completionInvariantFailureReason: null,
    finalSuccessOwner,
    officialShallowOwnerFrozen: false,
    officialShallowOwnerFreezeBlockedReason: null,
  };

  return {
    ownerTruth: simplifiedOwnerTruth,
    simplificationApplied: true,
    authoritySinkReason: sinkReason,
    passOwner,
    demotedBlockedReason: rawBlocker,
  };
}

/**
 * progression pass 를 막는 요인( integrity-for-pass + hardBlocker ∩ reasons ).
 * 디버그·스모크에서 gate 의도를 읽기 쉽게 한다.
 */
export function getSquatPassBlockingReasons(input: {
  integrityBlockForPass: string | null;
  reasons: string[];
  hardBlockerReasons: string[];
}): string[] {
  const out: string[] = [];
  if (input.integrityBlockForPass != null) out.push(input.integrityBlockForPass);
  for (const h of input.hardBlockerReasons) {
    if (input.reasons.includes(h)) out.push(h);
  }
  return out;
}
