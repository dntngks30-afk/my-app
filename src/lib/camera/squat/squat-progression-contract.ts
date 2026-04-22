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
  | 'completion_truth_event'
  | 'blocked_by_invalid_capture'
  | 'other';

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

/** progression pass / isFinalPassLatched 에 쓰는 integrity — decouple 시 무시(null). */
export function squatPassProgressionIntegrityBlock(
  rawIntegrityBlock: string | null,
  decoupleEligible: boolean
): string | null {
  return decoupleEligible ? null : rawIntegrityBlock;
}

/** decouple 구간에서 pass 를 막지 않고 trace/failureReasons 용으로만 남기는 태그 */
export function getSquatQualityOnlyWarnings(input: {
  guardrail: Pick<StepGuardrailResult, 'captureQuality' | 'flags'>;
  rawIntegrityBlock: string | null;
  decoupleEligible: boolean;
}): string[] {
  if (!input.decoupleEligible) return [];
  const w: string[] = [];
  if (input.guardrail.captureQuality === 'low') w.push('capture_quality_low');
  if (input.guardrail.flags.includes('hard_partial')) w.push('hard_partial');
  if (input.rawIntegrityBlock != null) w.push('standard_cycle_signal_integrity');
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
  officialShallowPathClosed?: boolean;
  officialShallowClosureProofSatisfied?: boolean;
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
  stillSeatedAtPass?: boolean;
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
    if (cs.currentSquatPhase !== 'standing_recovered' || cs.standingRecoveredAtMs == null) {
      return officialShallowFalsePassBlocked('seated_hold_without_upward_recovery');
    }
    return officialShallowFalsePassBlocked('no_real_recovery');
  }
  const epochLedgerClear = explicitCanonicalEpochLedgerClear(cs);
  if (
    cs.reversalConfirmedByRuleOrHmm !== true &&
    cs.officialShallowStreamBridgeApplied === true &&
    !epochLedgerClear
  ) {
    return officialShallowFalsePassBlocked(
      'assist_only_closure_without_raw_epoch_provenance'
    );
  }
  if (!epochLedgerClear) {
    return officialShallowFalsePassBlocked('cross_epoch_stitched_proof');
  }
  if (cs.canonicalShallowContractAntiFalsePassClear !== true) {
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

  if (cs.officialShallowClosureProofSatisfied !== true) {
    return {
      officialShallowOwnerFrozen: false,
      officialShallowOwnerReason: null,
      officialShallowOwnerBlockedReason: 'official_shallow_closure_proof_not_satisfied',
      officialShallowFalsePassGuardFamily: null,
    };
  }

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
    officialShallowOwnerFrozen: true,
    officialShallowOwnerReason: 'official_shallow_owner_freeze',
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
  officialShallowOwnerFrozen: boolean;
  officialShallowOwnerFreezeBlockedReason: string | null;
} {
  const cs = input.squatCompletionState;
  const officialShallowOwnerFreeze = readOfficialShallowOwnerFreezeSnapshot(input);
  if (cs == null) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'no_squat_completion_state',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }

  if (officialShallowOwnerFreeze.officialShallowOwnerFrozen) {
    return {
      completionOwnerPassed: true,
      completionOwnerReason: officialShallowOwnerFreeze.officialShallowOwnerReason,
      completionOwnerBlockedReason: null,
      officialShallowOwnerFrozen: true,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }

  if (officialShallowOwnerFreeze.officialShallowOwnerBlockedReason != null) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: officialShallowOwnerFreeze.officialShallowOwnerBlockedReason,
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason:
        officialShallowOwnerFreeze.officialShallowOwnerBlockedReason,
    };
  }

  if (cs.completionBlockedReason != null && cs.completionBlockedReason !== '') {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: cs.completionBlockedReason,
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }
  if (cs.completionSatisfied !== true) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'completion_not_satisfied',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }
  if (cs.currentSquatPhase !== 'standing_recovered') {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'not_standing_recovered',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }
  if (cs.cycleComplete !== true) {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'cycle_not_complete',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }
  const cpr = cs.completionPassReason;
  if (cpr == null || cpr === 'not_confirmed') {
    return {
      completionOwnerPassed: false,
      completionOwnerReason: null,
      completionOwnerBlockedReason: 'completion_pass_reason_invalid',
      officialShallowOwnerFrozen: false,
      officialShallowOwnerFreezeBlockedReason: null,
    };
  }
  const explicitShallowOwnerReason =
    cs.completionOwnerReason === 'shallow_complete_rule' ||
    cs.completionOwnerReason === 'ultra_low_rom_complete_rule'
      ? cs.completionOwnerReason
      : null;
  return {
    completionOwnerPassed: true,
    completionOwnerReason: explicitShallowOwnerReason ?? cpr,
    completionOwnerBlockedReason: null,
    officialShallowOwnerFrozen: false,
    officialShallowOwnerFreezeBlockedReason: null,
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
    return 'completion_truth_event';
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
      return 'completion_truth_event';
    }
  }
  return 'other';
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
