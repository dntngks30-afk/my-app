import type { Question } from '@/types/movement-test';

import { questionsPartA } from './partA';
import { questionsPartB } from './partB';
import { questionsPartC } from './partC';
import { questionsPartD } from './partD';

export const ALL_QUESTIONS: Question[] = [
  ...questionsPartA,
  ...questionsPartB,
  ...questionsPartC,
  ...questionsPartD,
];

export const TOTAL_QUESTIONS = ALL_QUESTIONS.length;

export const MULTIPLE_QUESTIONS_COUNT =
  questionsPartA.length + questionsPartB.length + questionsPartC.length;

export const BINARY_QUESTIONS_COUNT = questionsPartD.length;

// 필요하면 외부에서도 파트 사용 가능
export { questionsPartA, questionsPartB, questionsPartC, questionsPartD };
