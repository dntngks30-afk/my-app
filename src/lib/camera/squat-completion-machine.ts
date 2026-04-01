/**
 * PR-COMP-01 — 스쿼트 **completion pass**용 명시적 상태기계 뷰.
 *
 * 실제 판정 로직은 `squat-completion-state.ts`에 단일 소스로 유지하고,
 * 여기서는 관측·트레이스·게이트 디버그용 라벨만 파생한다.
 * (pass = cycle completion / quality = metrics·evidenceLabel·planning tier — 분리 유지)
 *
 * 순환 import 방지: `SquatCompletionState` 타입을 import하지 않는다.
 */

/** 퍼널·트레이스용 사람이 읽기 쉬운 단계 (internal `currentSquatPhase`와 1:1 아님) */
export type SquatCompletionMachinePhase =
  | 'idle'
  | 'baseline'
  | 'descending_candidate'
  | 'descending_confirmed'
  | 'bottom_or_low_point'
  | 'ascending_confirmed'
  | 'recovered'
  | 'completed';

/** 통과 시 ROM 밴드 기반 사유(미통과는 not_confirmed) */
export type SquatCompletionPassReason =
  | 'standard_cycle'
  | 'low_rom_cycle'
  | 'ultra_low_rom_cycle'
  /** PR-CAM-18: phaseHint='descent'이 'start' 우선에 의해 억제된 경우 trajectory 기반 이벤트 사이클 경로 */
  | 'low_rom_event_cycle'
  | 'ultra_low_rom_event_cycle'
  /** PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04: 공식 shallow 권위 종료 계약 충족 시에만(단일 게이트) */
  | 'official_shallow_cycle'
  | 'not_confirmed';

export function deriveSquatCompletionMachinePhase(s: {
  completionSatisfied: boolean;
  currentSquatPhase: string;
  downwardCommitmentReached: boolean;
}): SquatCompletionMachinePhase {
  if (s.completionSatisfied) return 'completed';

  const p = s.currentSquatPhase;

  if (p === 'idle') return 'idle';
  if (p === 'armed') return 'baseline';
  if (p === 'descending') {
    return s.downwardCommitmentReached ? 'descending_confirmed' : 'descending_candidate';
  }
  if (p === 'committed_bottom_or_downward_commitment') return 'bottom_or_low_point';
  if (p === 'ascending') return 'ascending_confirmed';
  if (p === 'standing_recovered') return 'recovered';

  return 'idle';
}

export function deriveSquatCompletionPassReason(s: {
  completionSatisfied: boolean;
  evidenceLabel: string;
  /** PR-CAM-18: phaseHint 기반 descent 미탐지 → trajectory 이벤트 사이클 경로 여부 */
  eventBasedDescentPath?: boolean;
}): SquatCompletionPassReason {
  if (!s.completionSatisfied) return 'not_confirmed';
  switch (s.evidenceLabel) {
    case 'standard':
      return 'standard_cycle';
    case 'low_rom':
      return s.eventBasedDescentPath ? 'low_rom_event_cycle' : 'low_rom_cycle';
    case 'ultra_low_rom':
      return s.eventBasedDescentPath ? 'ultra_low_rom_event_cycle' : 'ultra_low_rom_cycle';
    default:
      return 'not_confirmed';
  }
}
