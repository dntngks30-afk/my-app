/**
 * PR-COMP-02 — 애매한 스쿼트 시도에 대한 1회 재시도 음성(텍스트 TTS) UX.
 *
 * completion 판정은 `squat-completion-state` / PR-COMP-01 트레이스만 읽고 변경하지 않는다.
 */
import type { ExerciseGateResult } from './auto-progression';

/** 재시도 음성 분기용(추후 mp3 키와 1:1 매핑 가능) */
export type SquatAmbiguousRetryReason =
  | 'no_descent'
  | 'no_reversal'
  | 'no_recovery'
  | 'partial_cycle';

/** “사이클 미확정” 구간 — idle·baseline·completed 제외 */
const AMBIGUOUS_RETRY_PHASES = new Set<string>([
  'descending_candidate',
  'descending_confirmed',
  'bottom_or_low_point',
  'ascending_confirmed',
  'recovered',
]);

const FRAMING_HARD_FAILURES = new Set<string>([
  'framing_invalid',
  'left_side_missing',
  'right_side_missing',
  'hard_partial',
  'capture_quality_invalid',
]);

function readCompletionMachinePhase(gate: ExerciseGateResult): string | null {
  const fromDebug = gate.squatCycleDebug?.completionMachinePhase;
  if (typeof fromDebug === 'string' && fromDebug.length > 0) {
    return fromDebug;
  }
  const hm = gate.evaluatorResult.debug?.highlightedMetrics;
  const p = hm && typeof hm.completionMachinePhase === 'string' ? hm.completionMachinePhase : null;
  return p;
}

function readCompletionBlockedReason(gate: ExerciseGateResult): string | null {
  const fromDebug = gate.squatCycleDebug?.completionBlockedReason;
  if (typeof fromDebug === 'string' && fromDebug.length > 0) {
    return fromDebug;
  }
  const hm = gate.evaluatorResult.debug?.highlightedMetrics?.completionBlockedReason;
  return typeof hm === 'string' && hm.length > 0 ? hm : null;
}

/**
 * PR-COMP-02 retry 대상: 완료 아님, 캡처 invalid 아님, 신호 부족 아님,
 * completion 기계 단계가 “사이클 미확정” 구간.
 */
export function isSquatAmbiguousRetryEligible(gate: ExerciseGateResult): boolean {
  if (gate.evaluatorResult.stepId !== 'squat') return false;
  if (gate.completionSatisfied) return false;
  if (gate.guardrail.captureQuality === 'invalid') return false;
  if (gate.failureReasons.some((r) => FRAMING_HARD_FAILURES.has(r))) return false;
  if (gate.failureReasons.includes('insufficient_signal')) return false;

  const phase = readCompletionMachinePhase(gate);
  if (!phase || !AMBIGUOUS_RETRY_PHASES.has(phase)) return false;

  return true;
}

/**
 * `completionBlockedReason` 우선, 없으면 `completionMachinePhase`로 보수적 매핑.
 */
export function deriveSquatAmbiguousRetryReason(
  gate: ExerciseGateResult
): SquatAmbiguousRetryReason | null {
  if (!isSquatAmbiguousRetryEligible(gate)) return null;

  const blocked = readCompletionBlockedReason(gate);
  const phase = readCompletionMachinePhase(gate);

  if (
    blocked === 'not_standing_recovered' ||
    blocked === 'recovery_hold_too_short' ||
    blocked === 'ascent_recovery_span_too_short'
  ) {
    return 'no_recovery';
  }
  if (blocked === 'no_reversal' || blocked === 'no_ascend') {
    return 'no_reversal';
  }
  if (blocked === 'no_descend' || blocked === 'insufficient_relative_depth') {
    return 'no_descent';
  }
  if (blocked === 'no_commitment' || blocked === 'descent_span_too_short') {
    return 'partial_cycle';
  }

  if (phase === 'ascending_confirmed' || phase === 'recovered') {
    return 'no_recovery';
  }
  if (phase === 'bottom_or_low_point') {
    return 'no_reversal';
  }
  if (phase === 'descending_candidate' || phase === 'descending_confirmed') {
    return 'no_descent';
  }

  return 'partial_cycle';
}
