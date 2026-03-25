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
}): SquatCompletionPassReason {
  if (!s.completionSatisfied) return 'not_confirmed';
  switch (s.evidenceLabel) {
    case 'standard':
      return 'standard_cycle';
    case 'low_rom':
      return 'low_rom_cycle';
    case 'ultra_low_rom':
      return 'ultra_low_rom_cycle';
    default:
      return 'not_confirmed';
  }
}
