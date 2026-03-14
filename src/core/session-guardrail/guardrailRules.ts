/**
 * PR-FIRST-SESSION: First Session Guardrail Rules
 * PR-ALG-21: Risk-tiered limits. conservative=protected/red, moderate=caution/yellow/deconditioned, normal=general.
 */

/** Volume limits — conservative (protected/red). Rehab-level safe. */
export const VOLUME_LIMITS_CONSERVATIVE = {
  max_exercises: 5,
  max_main_exercises: 1,
  max_total_sets: 8,
  max_session_time_minutes: 12,
} as const;

/** Volume limits — moderate (caution/yellow). Slight relaxation. */
export const VOLUME_LIMITS_MODERATE = {
  max_exercises: 5,
  max_main_exercises: 2,
  max_total_sets: 10,
  max_session_time_minutes: 14,
} as const;

/** Volume limits — normal (none + general). Minimum workout feel. */
export const VOLUME_LIMITS_NORMAL = {
  max_exercises: 6,
  max_main_exercises: 2,
  max_total_sets: 12,
  max_session_time_minutes: 16,
} as const;

/** @deprecated Use tiered limits. Kept for backward compat. */
export const VOLUME_LIMITS = VOLUME_LIMITS_CONSERVATIVE;

/** Difficulty clamp: difficulty ≤ medium */
export const DIFFICULTY_CAP = 'medium' as const;

/** progression_level ≤ 2 */
export const PROGRESSION_LEVEL_CAP = 2;

/** Deconditioned reductions */
export const DECONDITIONED_REDUCTIONS = {
  sets_factor: 0.7,      // reduce sets by 30%
  hold_factor: 0.7,      // reduce hold by 30%
  session_time_factor: 0.8, // reduce session time by 20%
} as const;
