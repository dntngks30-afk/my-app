/**
 * PR-COMP-04 — 오버헤드 애매 시도 1회 재시도 음성(페이지 orchestration 전제).
 *
 * completion SSOT는 `overhead-completion-state` + evaluator highlightedMetrics.
 */
import type { ExerciseGateResult } from './auto-progression';

export type OverheadAmbiguousRetryReason =
  | 'insufficient_height'
  | 'unstable_top'
  | 'no_hold'
  | 'partial_raise';

/** 스펙 문서 명칭과 동일 의미 */
export type OverheadRetryReason = OverheadAmbiguousRetryReason;

const FRAMING_HARD = new Set<string>([
  'framing_invalid',
  'left_side_missing',
  'right_side_missing',
  'hard_partial',
  'capture_quality_invalid',
]);

const RETRY_PHASES = new Set<string>(['raising', 'top_unstable', 'stable_top', 'holding']);

function hm(gate: ExerciseGateResult) {
  return gate.evaluatorResult.debug?.highlightedMetrics;
}

export function isOverheadAmbiguousRetryEligible(gate: ExerciseGateResult): boolean {
  if (gate.evaluatorResult.stepId !== 'overhead-reach') return false;
  if (gate.completionSatisfied) return false;
  if (gate.guardrail.captureQuality === 'invalid') return false;
  if (gate.failureReasons.some((r) => FRAMING_HARD.has(r))) return false;
  if (gate.failureReasons.includes('insufficient_signal')) return false;

  const m = hm(gate);
  const raiseCount = typeof m?.raiseCount === 'number' ? m.raiseCount : 0;
  const topDetected =
    m?.overheadTopDetected === 1 ||
    m?.overheadTopDetected === true ||
    m?.topDetected === 1 ||
    m?.topDetected === true;
  if (raiseCount <= 0 && !topDetected) return false;

  const phase =
    typeof m?.completionMachinePhase === 'string' ? m.completionMachinePhase : '';
  if (!phase || !RETRY_PHASES.has(phase)) return false;

  return true;
}

export function deriveOverheadAmbiguousRetryReason(
  gate: ExerciseGateResult
): OverheadAmbiguousRetryReason | null {
  if (!isOverheadAmbiguousRetryEligible(gate)) return null;

  const m = hm(gate);
  const blocked =
    typeof m?.completionBlockedReason === 'string' ? m.completionBlockedReason : null;
  const phase = typeof m?.completionMachinePhase === 'string' ? m.completionMachinePhase : '';

  if (blocked === 'insufficient_elevation' || blocked === 'raise_peak_incomplete') {
    return 'insufficient_height';
  }
  if (blocked === 'stable_top_not_reached' || phase === 'top_unstable') {
    return 'unstable_top';
  }
  if (blocked === 'hold_short') {
    return 'no_hold';
  }

  if (blocked === 'asymmetry_unacceptable') {
    return 'partial_raise';
  }

  return 'partial_raise';
}
