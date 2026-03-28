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
      input.completionPassReason === 'low_rom_event_cycle' ||
      input.completionPassReason === 'ultra_low_rom_event_cycle'
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
