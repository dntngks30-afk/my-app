/**
 * PR-ALG-16A: General Session Constraint Engine — constants.
 * Centralized for tuning. Reusable by PR-ALG-18 Candidate Competition.
 */

/** Phase order: prep → main → cooldown (accessory merges with main in UI) */
export const PHASE_ORDER = ['Prep', 'Main', 'Accessory', 'Cooldown'] as const;
export const CONSTRAINT_ENGINE_VERSION = 'session_constraint_engine_v1' as const;

/** Main segment minimum count (non–first session). First session uses guardrail. */
export const MAIN_COUNT_MIN = 2;

/** Max same focus_tag in main segment (pattern cap) */
export const PATTERN_CAP_MAIN = 2;

/** Fatigue cap: max weighted score per session. Rule-based. */
export const FATIGUE_CAP_SCORE = 24;

/** Difficulty weight for fatigue: low=1, medium=2, high=4 */
export const FATIGUE_WEIGHT_DIFFICULTY: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 4,
};

/** Progression contributes to fatigue cap. */
export const FATIGUE_WEIGHT_PROGRESSION = 2;

/** Hold duration contributes by 15s unit. */
export const FATIGUE_HOLD_UNIT_SECONDS = 15;

/** First session: max total exercises */
export const FIRST_SESSION_MAX_TOTAL = 5;

/** First session: max main count */
export const FIRST_SESSION_MAX_MAIN = 1;

/** First session: max difficulty allowed */
export const FIRST_SESSION_MAX_DIFFICULTY = 'medium';

/** Low inventory heuristic for graceful degrade. */
export const LOW_INVENTORY_TEMPLATE_THRESHOLD = 8;
