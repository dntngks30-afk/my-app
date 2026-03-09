/**
 * PR-ALG-06: Execution summary builder
 * Deterministic. Same feedback → same summary.
 * Used at session complete to store execution_summary_json.
 */

import type { FeedbackPayload } from './feedback-types';

const SUMMARY_VERSION = 'execution_summary_v1';

export type ExecutionSummary = {
  session_number: number;
  completed_at: string;
  completion_mode: 'all_done' | 'partial_done' | 'stop_early';
  completion_ratio?: number | null;
  overall_rpe?: number | null;
  pain_after?: number | null;
  difficulty_feedback?: string | null;
  skip_count: number;
  replace_count: number;
  problem_exercise_keys: string[];
  feedback_saved: boolean;
  summary_version: string;
};

const PROBLEM_PAIN_DELTA = 2;

/**
 * Build execution summary from feedback payload and context.
 * Deterministic. Always returns a summary (feedback null → defaults).
 */
export function buildExecutionSummary(
  sessionNumber: number,
  completedAt: string,
  completionMode: 'all_done' | 'partial_done' | 'stop_early',
  feedbackPayload: FeedbackPayload | null,
  feedbackSaved: boolean
): ExecutionSummary {
  let completion_ratio: number | null = null;
  let overall_rpe: number | null = null;
  let pain_after: number | null = null;
  let difficulty_feedback: string | null = null;
  let skip_count = 0;
  let replace_count = 0;
  const problem_exercise_keys: string[] = [];

  if (feedbackPayload) {
    const sf = feedbackPayload.sessionFeedback;
    if (sf) {
      completion_ratio = sf.completionRatio ?? null;
      overall_rpe = sf.overallRpe ?? null;
      pain_after = sf.painAfter ?? null;
      difficulty_feedback = sf.difficultyFeedback ?? null;
    }

    const ef = feedbackPayload.exerciseFeedback ?? [];
    for (const item of ef) {
      if (item.skipped === true) skip_count++;
      if (item.wasReplaced === true) replace_count++;
      const isProblem =
        (typeof item.painDelta === 'number' && item.painDelta >= PROBLEM_PAIN_DELTA) ||
        item.skipped === true ||
        item.wasReplaced === true;
      if (isProblem && item.exerciseKey) {
        problem_exercise_keys.push(item.exerciseKey);
      }
    }
  }

  return {
    session_number: sessionNumber,
    completed_at: completedAt,
    completion_mode: completionMode,
    completion_ratio: completion_ratio ?? undefined,
    overall_rpe: overall_rpe ?? undefined,
    pain_after: pain_after ?? undefined,
    difficulty_feedback: difficulty_feedback ?? undefined,
    skip_count,
    replace_count,
    problem_exercise_keys: [...new Set(problem_exercise_keys)].sort(),
    feedback_saved: feedbackSaved,
    summary_version: SUMMARY_VERSION,
  };
}
