import type { TestAnswerValue } from '@/features/movement-test/v2';

export const SURVEY_SESSION_KEY = 'movementTestSession:v2' as const;

export type SurveyAnswersById = Record<string, TestAnswerValue>;

export interface SurveySessionCacheV2 {
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: SurveyAnswersById;
}
