/**
 * Deep Test Question IDs — SSOT (Single Source of Truth)
 *
 * All compatibility-critical logic (scoring, answeredCount, denominator)
 * MUST use these constants. No duplicated string literals elsewhere.
 *
 * Drift guard: scripts/deep-question-id-validate.mjs
 */

/** Canonical list of all deep v2 question IDs (scoring denominator) */
export const DEEP_V2_QUESTION_IDS = [
  'deep_basic_age',
  'deep_basic_gender',
  'deep_basic_experience',
  'deep_basic_workstyle',
  'deep_basic_primary_discomfort',
  'deep_squat_pain_intensity',
  'deep_squat_pain_location',
  'deep_squat_knee_alignment',
  'deep_wallangel_pain_intensity',
  'deep_wallangel_pain_location',
  'deep_wallangel_quality',
  'deep_sls_pain_intensity',
  'deep_sls_pain_location',
  'deep_sls_quality',
] as const;

export type DeepV2QuestionId = (typeof DEEP_V2_QUESTION_IDS)[number];

/** Total count for confidence/denominator (derived) */
export const DEEP_V2_TOTAL_COUNT = DEEP_V2_QUESTION_IDS.length;

/**
 * Context questions (future): IDs that may have different denominator logic.
 * Currently empty — all 14 are applicable for scoring.
 */
export const DEEP_CONTEXT_QUESTION_IDS: readonly string[] = [];

/**
 * Applicable question IDs for answeredCount / completeness.
 * Currently equals DEEP_V2_QUESTION_IDS.
 */
export function getApplicableQuestionIds(): readonly string[] {
  return DEEP_V2_QUESTION_IDS;
}
