/**
 * PR-SESSION-ADAPTIVE-01: Execution signals from session_exercise_events.
 * Extracts signals for adaptive summary generation.
 */

export type SessionExerciseEventRow = {
  completed: boolean;
  skipped: boolean;
  actual_reps: number | null;
  prescribed_reps: number | null;
  rpe: number | null;
  discomfort: number | null;
};

export type ExecutionSignals = {
  completion_rate: number;
  avg_rpe: number | null;
  discomfort_signal: number | null;
  skipped_count: number;
  completed_count: number;
  total_count: number;
};

/**
 * Derive execution signals from event rows.
 * Used by adaptive evaluator and for adaptive summary generation.
 */
export function deriveExecutionSignals(
  events: SessionExerciseEventRow[]
): ExecutionSignals {
  if (events.length === 0) {
    return {
      completion_rate: 0,
      avg_rpe: null,
      discomfort_signal: null,
      skipped_count: 0,
      completed_count: 0,
      total_count: 0,
    };
  }

  const completedCount = events.filter((e) => e.completed).length;
  const skippedCount = events.filter((e) => e.skipped).length;
  const completionRate = events.length > 0 ? completedCount / events.length : 0;

  const rpeVals = events
    .map((e) => e.rpe)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgRpe = rpeVals.length > 0
    ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length
    : null;

  const discomfortVals = events
    .map((e) => e.discomfort)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const discomfortSignal = discomfortVals.length > 0
    ? discomfortVals.reduce((a, b) => a + b, 0) / discomfortVals.length
    : null;

  return {
    completion_rate: Math.round(completionRate * 1000) / 1000,
    avg_rpe: avgRpe,
    discomfort_signal: discomfortSignal,
    skipped_count: skippedCount,
    completed_count: completedCount,
    total_count: events.length,
  };
}
