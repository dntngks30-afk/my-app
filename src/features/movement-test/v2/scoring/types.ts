/**
 * v2 Movement Test - 스코어링 타입 정의
 * PR2-1: sloth 축 제거, meerkat 축 추가 / sloth 복합 타입으로 이동
 */

export type AnimalAxis =
  | 'turtle'
  | 'hedgehog'
  | 'kangaroo'
  | 'penguin'
  | 'crab'
  | 'meerkat';

export type CompositeTag = 'armadillo' | 'sloth' | null;

/** 6축 상수 (순서 고정, scoring 계산용) */
export const ANIMAL_AXES: readonly AnimalAxis[] = [
  'turtle',
  'hedgehog',
  'kangaroo',
  'penguin',
  'crab',
  'meerkat',
] as const;

export type TestAnswerValue = 0 | 1 | 2 | 3 | 4;

export interface QuestionV2 {
  id: string;
  text: string;
  weights: Partial<Record<AnimalAxis | 'tension' | 'asym', number>>;
}

export type ResultTypeV2 =
  | 'MONKEY'
  | 'COMPOSITE_ARMADILLO'
  | 'COMPOSITE_SLOTH'
  | 'BASIC';

/** 최종 표시 타입 (monkey는 축이 아닌 결과 타입 전용) */
export type FinalTypeV2 = AnimalAxis | 'armadillo' | 'sloth' | 'monkey';

export interface ScoreResultV2 {
  axisScores: Record<AnimalAxis, number>; // 0~100
  tension: number; // 0~100
  asym: number; // 0~100
  avg6: number; // 0~100
  baseType: AnimalAxis;
  secondaryType: AnimalAxis | null;
  compositeTag: CompositeTag;
  /** 의사결정 트리 결과 유형 (optional, 향후 신뢰도/UI용) */
  resultType?: ResultTypeV2;
  /** BASIC 시 mainAnimal = top1 axis (baseType과 동일) */
  mainAnimal?: AnimalAxis;
  /** BASIC: (top1-top2)<10일 때 top2. MONKEY: top2 포함 가능 */
  subTendency?: AnimalAxis | null;
  /** 근거 문항 TOP3 (optional, 향후 신뢰도 표시용) */
  top3Axes?: [AnimalAxis, AnimalAxis, AnimalAxis];
}
