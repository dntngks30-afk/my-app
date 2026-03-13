/**
 * PR-DATA-01A: Evidence gate threshold and scoring constants.
 * Centralized for easy tuning. Do not over-engineer.
 */

/** Minimum ratio of total items that must be completed (0.5 = 50%) */
export const EVIDENCE_GATE_COMPLETION_MIN_RATIO = 0.5;

/** Evidence score threshold: >= this value allows completion */
export const EVIDENCE_GATE_SCORE_ALLOW_THRESHOLD = 50;

/** Evidence score threshold: >= this and < ALLOW = recoverable reject */
export const EVIDENCE_GATE_SCORE_RECOVERABLE_MIN = 35;

/** Max points for completion coverage (completed/total) */
export const EVIDENCE_SCORE_COVERAGE_MAX = 40;

/** Max points for performed value density (items with sets/reps) */
export const EVIDENCE_SCORE_PERFORMED_VALUE_MAX = 20;

/** Max points for reflection/RPE/discomfort presence */
export const EVIDENCE_SCORE_REFLECTION_MAX = 15;

/**
 * PR-RISK-08a: Threshold profile identifier for observability.
 * Relaxed threshold operation must remain observable.
 * Threshold changes should be evaluated against allow-quality metrics.
 */
export const EVIDENCE_GATE_THRESHOLD_PROFILE = 'relaxed';
