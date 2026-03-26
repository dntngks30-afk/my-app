/**
 * PR-COMP-04 — 오버헤드 애매 시도 1회 재시도 음성(페이지 orchestration 전제).
 *
 * PR-CAM-13: progression truth 우선 읽기.
 * - overheadProgressionState.progressionBlockedReason / progressionPhase 를 먼저 읽는다.
 * - strict completionBlockedReason / completionMachinePhase 는 progression state 부재 시 fallback.
 * - 출력 vocabulary(OverheadAmbiguousRetryReason)는 기존과 동일 — 소비자 호환.
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

/** strict 머신 기반 retry 허용 phase (기존 동작 유지) */
const STRICT_RETRY_PHASES = new Set<string>(['raising', 'top_unstable', 'stable_top', 'holding']);
/** PR-CAM-13: progression 관점 retry 허용 phase — easy 구간 포함 */
const PROGRESSION_RETRY_PHASES = new Set<string>([
  'raising',
  'easy_top',
  'easy_building_hold',
  'strict_top_unstable',
  'stable_top',
  'holding',
]);

function hm(gate: ExerciseGateResult) {
  return gate.evaluatorResult.debug?.highlightedMetrics;
}

/** PR-CAM-13: typed progression state 접근 helper */
function ps(gate: ExerciseGateResult) {
  return gate.evaluatorResult.debug?.overheadProgressionState;
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
  // PR-CAM-13: easy top zone 도달도 top evidence로 인정 (strict 132° 미달 구간 포함)
  const easyTopZoneFrameCount =
    typeof m?.easyTopZoneFrameCount === 'number' ? m.easyTopZoneFrameCount : 0;
  if (raiseCount <= 0 && !topDetected && easyTopZoneFrameCount === 0) return false;

  // PR-CAM-13: progression phase 우선, strict 머신 phase 는 progression state 부재 시 fallback
  const progressionPhase = ps(gate)?.progressionPhase;
  const strictPhase = typeof m?.completionMachinePhase === 'string' ? m.completionMachinePhase : '';
  const phaseEligible = progressionPhase
    ? PROGRESSION_RETRY_PHASES.has(progressionPhase)
    : Boolean(strictPhase) && STRICT_RETRY_PHASES.has(strictPhase);
  if (!phaseEligible) return false;

  return true;
}

export function deriveOverheadAmbiguousRetryReason(
  gate: ExerciseGateResult
): OverheadAmbiguousRetryReason | null {
  if (!isOverheadAmbiguousRetryEligible(gate)) return null;

  // PR-CAM-13: progression blocked reason 우선 — easy-facing 사유를 먼저 매핑
  const progression = ps(gate);
  const progressionBlocked = progression?.progressionBlockedReason ?? null;
  const progressionPhase = progression?.progressionPhase ?? null;

  if (progressionBlocked === 'easy_hold_short') return 'no_hold';
  if (
    progressionBlocked === 'easy_top_not_reached' ||
    progressionBlocked === 'easy_raise_incomplete'
  ) {
    return 'insufficient_height';
  }
  // easy zone에 진입했으나 hold를 시작 못 한 상태 — top 불안정으로 안내
  if (progressionPhase === 'easy_top') return 'unstable_top';
  if (progressionBlocked === 'asymmetry_unacceptable') return 'partial_raise';

  // fallback: strict 머신 signals (progression state 부재 또는 매핑 불가 케이스)
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
  if (blocked === 'hold_short') return 'no_hold';
  if (blocked === 'asymmetry_unacceptable') return 'partial_raise';

  return 'partial_raise';
}
