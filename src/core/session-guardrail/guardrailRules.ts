/**
 * PR-FIRST-SESSION: First Session Guardrail Rules
 *
 * Volume, difficulty, and safety limits for session_number === 1.
 */

/** Volume limits */
export const VOLUME_LIMITS = {
  max_exercises: 4,
  max_main_exercises: 1,
  max_total_sets: 8,
  max_session_time_minutes: 12,
} as const;

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
