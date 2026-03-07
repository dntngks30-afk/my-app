/**
 * PR-P2-1: Session feedback payload types
 * complete API optional payload. Backward compatible.
 */

export type DifficultyFeedback = 'too_easy' | 'ok' | 'too_hard';

export type SessionFeedbackPayload = {
  overallRpe?: number;
  painAfter?: number;
  difficultyFeedback?: DifficultyFeedback;
  completionRatio?: number;
  timeOverrun?: boolean;
  note?: string;
};

export type ExerciseFeedbackItem = {
  exerciseKey: string;
  completionRatio?: number;
  perceivedDifficulty?: number;
  painDelta?: number;
  wasReplaced?: boolean;
  skipped?: boolean;
  dislikedReason?: string;
};

export type FeedbackPayload = {
  sessionFeedback?: SessionFeedbackPayload;
  exerciseFeedback?: ExerciseFeedbackItem[];
};
