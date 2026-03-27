/**
 * PR-COMP-02 / PR-CAM-10 — 애매한 스쿼트 시도에 대한 1회 재시도 음성(텍스트 TTS) 계약.
 *
 * - completion 판정은 `squat-completion-state` 단일 truth; 여기서는 변경하지 않는다.
 * - PR-CAM-10: blockedReason·최소 캡처 시간으로 조기 발화·스팸을 줄인다.
 */
import type { ExerciseGateResult } from './auto-progression';

/** 재시도 음성 분기용(추후 mp3 키와 1:1 매핑 가능) */
export type SquatAmbiguousRetryReason =
  | 'no_descent'
  | 'no_reversal'
  | 'no_recovery'
  | 'partial_cycle';

/**
 * PR-CAM-10: 애매 재시도 음성은 “사이클이 어느 정도 진행된 뒤”에만 허용.
 * detecting 초기(2200ms) 직후에는 gate 가 아직 불안정할 수 있어, 여유를 둔다.
 */
export const SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS = 3200;

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

/**
 * PR-CAM-10: 이 blocked reason 일 때는 음성 재시도를 하지 않는다.
 * - not_armed: 서 있기 baseline 무장 전 — 유효 사이클이 “아직 펼쳐지는 중”일 수 있음.
 */
export function isSquatAmbiguousRetrySuppressedForBlockedReason(blocked: string | null): boolean {
  return blocked === 'not_armed';
}

function readCompletionMachinePhase(gate: ExerciseGateResult): string | null {
  const fromCycle = gate.squatCycleDebug?.completionMachinePhase;
  if (typeof fromCycle === 'string' && fromCycle.length > 0) {
    return fromCycle;
  }
  const hm = gate.evaluatorResult.debug?.highlightedMetrics;
  const p = hm && typeof hm.completionMachinePhase === 'string' ? hm.completionMachinePhase : null;
  return p;
}

/** PR-CAM-09: typed squatCompletionState 우선 */
function readCompletionBlockedReason(gate: ExerciseGateResult): string | null {
  const fromState = gate.evaluatorResult.debug?.squatCompletionState?.completionBlockedReason;
  if (typeof fromState === 'string' && fromState.length > 0) {
    return fromState;
  }
  const fromCycle = gate.squatCycleDebug?.completionBlockedReason;
  if (typeof fromCycle === 'string' && fromCycle.length > 0) {
    return fromCycle;
  }
  const hm = gate.evaluatorResult.debug?.highlightedMetrics?.completionBlockedReason;
  return typeof hm === 'string' && hm.length > 0 ? hm : null;
}

/**
 * PR-COMP-02 retry 대상: 완료 아님, 캡처 invalid 아님, 신호 부족 아님,
 * completion 기계 단계가 “사이클 미확정” 구간.
 *
 * PR-CAM-10: `captureDurationMs` 가 최소값 미만이면 false (조기 발화 방지).
 */
export function isSquatAmbiguousRetryEligible(
  gate: ExerciseGateResult,
  captureDurationMs: number
): boolean {
  if (gate.evaluatorResult.stepId !== 'squat') return false;
  if (!Number.isFinite(captureDurationMs) || captureDurationMs < SQUAT_AMBIGUOUS_RETRY_MIN_CAPTURE_MS) {
    return false;
  }
  if (gate.completionSatisfied) return false;
  if (gate.guardrail.captureQuality === 'invalid') return false;
  if (gate.failureReasons.some((r) => FRAMING_HARD_FAILURES.has(r))) return false;
  if (gate.failureReasons.includes('insufficient_signal')) return false;

  const blocked = readCompletionBlockedReason(gate);
  if (isSquatAmbiguousRetrySuppressedForBlockedReason(blocked)) return false;

  const phase = readCompletionMachinePhase(gate);
  if (!phase || !AMBIGUOUS_RETRY_PHASES.has(phase)) return false;

  return true;
}

/**
 * `completionBlockedReason` 우선, 없으면 `completionMachinePhase`로 보수적 매핑.
 *
 * @param captureDurationMs — `usePoseCapture` stats.captureDurationMs (ms)
 */
export function deriveSquatAmbiguousRetryReason(
  gate: ExerciseGateResult,
  captureDurationMs: number
): SquatAmbiguousRetryReason | null {
  if (!isSquatAmbiguousRetryEligible(gate, captureDurationMs)) return null;

  const blocked = readCompletionBlockedReason(gate);
  const phase = readCompletionMachinePhase(gate);

  if (
    blocked === 'not_standing_recovered' ||
    blocked === 'recovery_hold_too_short' ||
    blocked === 'low_rom_standing_finalize_not_satisfied' ||
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
