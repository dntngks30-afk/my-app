/**
 * PR-RISK-01: 운동 row 완료 판정 및 표시 SSOT
 *
 * hold_seconds 운동: reps 필드에 초 단위 저장 (plan-summary, progress, complete 모두 동일)
 * 완료 기준: sets > 0 || reps > 0 (hold는 reps에 초가 들어감)
 */

import type { ExerciseLogItem } from '@/lib/session/client';
import type { ExerciseItem } from './planJsonAdapter';

/**
 * 로그가 "의미 있는 완료"를 나타내는지 판정.
 * sets > 0 || reps > 0 (hold 운동은 reps에 hold_seconds가 저장됨)
 */
export function isExerciseLogCompleted(
  log: ExerciseLogItem | undefined,
  item: ExerciseItem
): boolean {
  if (!log) return false;
  const sets = log.sets ?? 0;
  const reps = log.reps ?? 0;
  return sets > 0 || reps > 0;
}

/**
 * 운동 row 실적 표시 텍스트.
 * hold 운동: "N세트 × X초" 또는 "X초 유지"
 * rep 운동: "N세트 × X회"
 */
export function getExerciseLogDisplayValue(
  log: ExerciseLogItem | undefined,
  item: ExerciseItem
): string | null {
  if (!log) return null;
  const sets = log.sets ?? 0;
  const reps = log.reps ?? 0;
  const isHold = (item.holdSeconds ?? 0) > 0;

  if (sets <= 0 && reps <= 0) return null;
  if (isHold) {
    if (sets > 1) return `${sets}세트 × ${reps}초`;
    return `${reps}초 유지`;
  }
  if (sets > 0 && reps > 0) return `${sets}세트 × ${reps}회`;
  if (sets > 0) return `${sets}세트`;
  if (reps > 0) return `${reps}회`;
  return null;
}
