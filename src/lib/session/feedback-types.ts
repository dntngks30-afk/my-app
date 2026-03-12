/**
 * PR-P2-1: Session feedback payload types
 * complete API optional payload. Backward compatible.
 */

export type DifficultyFeedback = 'too_easy' | 'ok' | 'too_hard';

/** PR-UX-00: 부위별 통증 (목/허리/무릎/손목/어깨) */
export type SessionPainArea = 'neck' | 'lower_back' | 'knee' | 'wrist' | 'shoulder';

export type SessionFeedbackPayload = {
  overallRpe?: number;
  painAfter?: number;
  difficultyFeedback?: DifficultyFeedback;
  completionRatio?: number;
  /** PR-UX-00: 운동 중 통증 발생 부위 (복수 선택) */
  painAreas?: SessionPainArea[];
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
