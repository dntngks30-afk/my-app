/**
 * v2 Movement Test - 스코어링 로직
 * PR2-3: Base 점수, 트리거 캡, 의사결정 트리 구현
 */
import type {
  AnimalAxis,
  ScoreResultV2,
  TestAnswerValue,
} from './types';
import { ANIMAL_AXES } from './types';
import { getCompositeTagV2 } from './composite.rules';

const EMPTY_AXIS_SCORES: Record<AnimalAxis, number> = Object.fromEntries(
  ANIMAL_AXES.map((a) => [a, 0])
) as Record<AnimalAxis, number>;

/** 축별 문항 ID (q1,q2,q3) — questions.v2 도메인 매핑: A=turtle, B=hedgehog, C=kangaroo, D=penguin, F=crab, G=meerkat */
const AXIS_QUESTION_IDS: Record<AnimalAxis, [string, string, string]> = {
  turtle: ['v2_A1', 'v2_A2', 'v2_A3'],
  hedgehog: ['v2_B1', 'v2_B2', 'v2_B3'],
  kangaroo: ['v2_C1', 'v2_C2', 'v2_C3'],
  penguin: ['v2_D1', 'v2_D2', 'v2_D3'],
  crab: ['v2_F1', 'v2_F2', 'v2_F3'],
  meerkat: ['v2_G1', 'v2_G2', 'v2_G3'],
};

const W1 = 1.4;
const W2 = 1.2;
const W3 = 1.0;
const MAX_RAW = 14.4; // 4*1.4 + 4*1.2 + 4*1.0

/** unknown(미응답) → 계산 시 2로 치환 */
function resolveValue(
  answers: Record<string, TestAnswerValue>,
  qId: string
): number {
  const v = answers[qId];
  if (v === undefined || v === null) return 2;
  return v as number;
}

/** 모집단 표준편차: sqrt(mean((xi-avg)^2)) */
function populationStd(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const sumSq = values.reduce((s, x) => s + (x - avg) ** 2, 0);
  return Math.sqrt(sumSq / values.length);
}

export function calculateScoresV2(
  answers: Record<string, TestAnswerValue>
): ScoreResultV2 {
  const axisScores = { ...EMPTY_AXIS_SCORES } as Record<AnimalAxis, number>;
  const q1Values: Record<AnimalAxis, number> = {} as Record<
    AnimalAxis,
    number
  >;

  for (const axis of ANIMAL_AXES) {
    const [id1, id2, id3] = AXIS_QUESTION_IDS[axis];
    const q1 = resolveValue(answers, id1);
    const q2 = resolveValue(answers, id2);
    const q3 = resolveValue(answers, id3);
    q1Values[axis] = q1;

    let raw = q1 * W1 + q2 * W2 + q3 * W3;
    let base = (raw / MAX_RAW) * 100;
    if (q1 <= 2) base = Math.min(base, 75);
    axisScores[axis] = Math.round(base * 100) / 100;
  }

  const sorted = ([...ANIMAL_AXES] as AnimalAxis[])
    .map((axis) => ({ axis, score: axisScores[axis] }))
    .sort((a, b) => b.score - a.score);

  const top1Axis = sorted[0]!.axis;
  const top2Axis = sorted[1]!.axis;
  const top3Axis = sorted[2]!.axis;
  const top1 = sorted[0]!.score;
  const top2 = sorted[1]!.score;
  const top3 = sorted[2]!.score;

  const avg =
    ANIMAL_AXES.reduce((s, a) => s + axisScores[a], 0) / ANIMAL_AXES.length;
  const std = populationStd(
    ANIMAL_AXES.map((a) => axisScores[a]),
    avg
  );

  const triggerCountTop3 = [top1Axis, top2Axis, top3Axis].filter(
    (a) => q1Values[a] >= 3
  ).length;

  const EPSILON = 0.01;
  const isAll50 =
    ANIMAL_AXES.every((a) => Math.abs(axisScores[a] - 50) <= EPSILON);

  let resultType: 'MONKEY' | 'COMPOSITE_ARMADILLO' | 'COMPOSITE_SLOTH' | 'BASIC' =
    'BASIC';
  let compositeTag: 'armadillo' | 'sloth' | null = null;
  let baseType: AnimalAxis = top1Axis;
  let secondaryType: AnimalAxis | null = null;

  if (isAll50 || top1 < 55) {
    resultType = 'MONKEY';
    secondaryType = top2Axis;
  } else {
    compositeTag = getCompositeTagV2({
      axisScores,
      top1,
      top2,
      top3,
      top1Axis,
      top2Axis,
      top3Axis,
      avg,
      std,
      triggerCountTop3,
    });
    if (compositeTag === 'armadillo') resultType = 'COMPOSITE_ARMADILLO';
    else if (compositeTag === 'sloth') resultType = 'COMPOSITE_SLOTH';
    else {
      resultType = 'BASIC';
      if (top1 - top2 < 10) secondaryType = top2Axis;
    }
  }

  return {
    axisScores,
    tension: 0,
    asym: 0,
    avg6: Math.round(avg * 100) / 100,
    baseType,
    secondaryType,
    compositeTag,
    resultType,
    mainAnimal: top1Axis,
    subTendency: secondaryType,
    top3Axes: [top1Axis, top2Axis, top3Axis],
  };
}
