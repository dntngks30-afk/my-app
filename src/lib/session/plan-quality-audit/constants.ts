/**
 * PR-ALG-19: Plan Quality Audit — constants.
 */

export const AUDIT_VERSION = 'plan_quality_audit_v1' as const;

export const BASE_SCORE = 100;
export const PENALTY_HIGH = 20;
export const PENALTY_WARN = 10;
export const PENALTY_INFO = 5;
export const BONUS_STRENGTH = 4;

export const FIRST_SESSION_MAX_MAIN_ITEMS = 1;

export const PATTERN_OVERLOAD_THRESHOLD = 0.6;
export const BODY_OVERLOAD_THRESHOLD = 0.6;
export const FALLBACK_HEAVY_THRESHOLD = 0.5;
