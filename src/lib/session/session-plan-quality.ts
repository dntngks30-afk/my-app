/**
 * PR-SESSION-QUALITY-01: Session plan quality validation.
 * Basic guardrails check after plan generation.
 */

import type { PlanJsonOutput } from './plan-generator';

const MIN_EXERCISE_COUNT = 1;
const MAX_FIRST_SESSION_EXERCISES = 5;

export type SessionPlanQualityResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function countExercises(plan: PlanJsonOutput): number {
  return plan.segments.reduce((sum, seg) => sum + seg.items.length, 0);
}

/**
 * Validate session plan quality. Non-blocking: returns errors/warnings.
 * Does not mutate plan.
 */
export function validateSessionPlanQuality(plan: PlanJsonOutput): SessionPlanQualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sessionNumber = plan.meta?.session_number ?? 0;
  const isFirstSession = sessionNumber === 1;

  const exerciseCount = countExercises(plan);
  if (exerciseCount < MIN_EXERCISE_COUNT) {
    errors.push(`exercise_count (${exerciseCount}) < minimum (${MIN_EXERCISE_COUNT})`);
  }
  if (isFirstSession && exerciseCount > MAX_FIRST_SESSION_EXERCISES) {
    warnings.push(`first_session: exercise_count (${exerciseCount}) > max (${MAX_FIRST_SESSION_EXERCISES})`);
  }

  const painMode = plan.meta?.pain_mode;
  if (painMode === 'caution' || painMode === 'protected') {
    if (!plan.meta?.constraint_flags?.pain_gate_applied) {
      warnings.push('pain_mode conflict: pain_gate not applied');
    }
  }

  if (plan.meta?.priority_vector && Object.keys(plan.meta.priority_vector).length > 0) {
    const focusAxes = plan.meta.session_focus_axes ?? [];
    if (focusAxes.length === 0) {
      warnings.push('priority_vector present but session_focus_axes empty');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
