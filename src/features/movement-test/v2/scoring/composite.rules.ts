/**
 * v2 Movement Test - 복합 타입 규칙
 * PR2-3: armadillo/sloth/null 판정 (top1>=55, MONKEY가 아닐 때만 호출)
 */
import type { AnimalAxis, CompositeTag } from './types';

export interface CompositeTagInput {
  axisScores: Record<AnimalAxis, number>;
  top1: number;
  top2: number;
  top3: number;
  top1Axis: AnimalAxis;
  top2Axis: AnimalAxis;
  top3Axis: AnimalAxis;
  avg: number;
  std: number;
  triggerCountTop3: number;
}

/** top1>=55(MONKEY 아님)일 때만 호출. armadillo | sloth | null 반환 */
export function getCompositeTagV2(input: CompositeTagInput): CompositeTag {
  const {
    axisScores,
    top1,
    top2,
    top3,
    avg,
    std,
    triggerCountTop3,
  } = input;
  const baseF = axisScores.crab;
  const baseG = axisScores.meerkat;

  // STEP 4-2 아르마딜로
  if (
    top1 >= 72 &&
    top2 >= 72 &&
    top3 >= 72 &&
    top1 - top3 <= 10 &&
    baseG >= 60 &&
    triggerCountTop3 >= 2
  ) {
    return 'armadillo';
  }

  // STEP 4-3 나무늘보
  if (
    top1 < 68 &&
    avg >= 52 &&
    avg <= 62 &&
    std < 10 &&
    baseF >= 55 &&
    baseG <= 55
  ) {
    return 'sloth';
  }

  return null;
}
