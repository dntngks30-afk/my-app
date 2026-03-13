/**
 * PR-ALG-12: Adaptive Engine v1 — Signal Extractor
 *
 * Extracts execution signals from exercise_logs, session completion, session reflection.
 */

export interface RawSessionFeedback {
  session_number: number;
  overall_rpe?: number | null;
  pain_after?: number | null;
  difficulty_feedback?: string | null;
  completion_ratio?: number | null;
  body_state_change?: string | null;
  discomfort_area?: string | null;
}

export interface RawAdaptiveSummary {
  completion_ratio: number;
  skipped_exercises: number;
  avg_rpe: number | null;
  avg_discomfort: number | null;
  dropout_risk_score: number;
  discomfort_burden_score: number;
}

export interface ExtractedSignals {
  completion_rate: number;
  avg_rpe: number | null;
  exercise_failures: number;
  skipped_exercises: number;
  difficulty_feedback: 'too_easy' | 'ok' | 'too_hard' | null;
  body_state_change: 'better' | 'same' | 'worse' | null;
  discomfort_area: string | null;
  total_exercises: number;
  completed_exercises: number;
}

/**
 * Merge session_feedback + session_adaptive_summary into unified signals.
 * Prefer event-based summary when available; fallback to session_feedback.
 */
export function extractSignals(
  sessionFeedback: RawSessionFeedback[],
  adaptiveSummary: RawAdaptiveSummary | null
): ExtractedSignals {
  const latest = sessionFeedback[0];
  const summary = adaptiveSummary;

  const completion_rate =
    summary != null
      ? summary.completion_ratio
      : (latest?.completion_ratio ?? null);
  const avg_rpe =
    summary?.avg_rpe != null ? summary.avg_rpe : (latest?.overall_rpe ?? null);
  const skipped_exercises = summary?.skipped_exercises ?? 0;
  const cr = typeof completion_rate === 'number' ? completion_rate : 0;
  const total_exercises =
    summary != null && summary.completion_ratio < 1 && summary.completion_ratio >= 0
      ? Math.max(1, Math.round(skipped_exercises / (1 - summary.completion_ratio)))
      : 0;
  const completed_exercises = total_exercises > 0 ? Math.round(total_exercises * cr) : 0;

  let difficulty_feedback: 'too_easy' | 'ok' | 'too_hard' | null = null;
  if (latest?.difficulty_feedback === 'too_easy' || latest?.difficulty_feedback === 'ok' || latest?.difficulty_feedback === 'too_hard') {
    difficulty_feedback = latest.difficulty_feedback;
  }

  let body_state_change: 'better' | 'same' | 'worse' | null = null;
  if (latest?.body_state_change === 'better' || latest?.body_state_change === 'same' || latest?.body_state_change === 'worse') {
    body_state_change = latest.body_state_change;
  }

  const discomfort_area =
    typeof latest?.discomfort_area === 'string' && latest.discomfort_area.trim()
      ? latest.discomfort_area.trim()
      : null;

  return {
    completion_rate: typeof completion_rate === 'number' ? completion_rate : 0,
    avg_rpe: typeof avg_rpe === 'number' && Number.isFinite(avg_rpe) ? avg_rpe : null,
    exercise_failures: skipped_exercises,
    skipped_exercises,
    difficulty_feedback,
    body_state_change,
    discomfort_area,
    total_exercises: total_exercises || (sessionFeedback.length > 0 ? 1 : 0),
    completed_exercises,
  };
}
