/**
 * MOVE RE - Filter Strategies for Deep V2 Routine Engine
 *
 * Pure functions only. No side effects.
 * Rule 1: Array intersection for avoid_tags — ANY overlap = exclude.
 *
 * @module workout-routine/strategies/filter-strategy
 */

import type { ExerciseTemplate } from '../exercise-templates';

/**
 * Returns true if the two arrays have at least one element in common.
 * Used for safety: if template.avoid_tags ∩ userAvoidTags is non-empty, exclude template.
 */
function hasIntersection(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  return a.some((x) => setB.has(x));
}

/**
 * Apply safety filter (Rule 1).
 * Return only templates where template.avoid_tags has NO intersection with userAvoidTags.
 * If a template has ANY avoid_tag that the user must avoid, it is pruned.
 *
 * @param templates - Pool of exercise templates
 * @param userAvoidTags - User's avoid_tags from DeepV2ExtendedResult
 * @returns Templates safe for this user (no forbidden tags)
 */
export function applySafetyFilter(
  templates: readonly ExerciseTemplate[],
  userAvoidTags: readonly string[]
): ExerciseTemplate[] {
  if (userAvoidTags.length === 0) {
    return [...templates];
  }
  return templates.filter(
    (t) => !hasIntersection(t.avoid_tags, userAvoidTags)
  );
}

/**
 * Apply level filter.
 * Return only templates where template.level <= userLevel.
 * Level 1 user: only level 1 templates. Level 3 user: all levels.
 *
 * @param templates - Pool of exercise templates
 * @param userLevel - User's level from DeepV2ExtendedResult (1, 2, or 3)
 * @returns Templates within user's ability
 */
export function applyLevelFilter(
  templates: readonly ExerciseTemplate[],
  userLevel: number
): ExerciseTemplate[] {
  const level = Math.max(1, Math.min(3, Math.floor(userLevel)));
  return templates.filter((t) => t.level <= level);
}

/**
 * Score templates by number of matching focus_tags.
 * Higher match count = higher priority. Does not mutate; returns new sorted array.
 *
 * @param templates - Pool of exercise templates
 * @param userFocusTags - User's focus_tags from DeepV2ExtendedResult
 * @returns Templates sorted descending by focus_tag match count
 */
export function scoreByFocusTags(
  templates: readonly ExerciseTemplate[],
  userFocusTags: readonly string[]
): ExerciseTemplate[] {
  if (userFocusTags.length === 0) {
    return [...templates];
  }
  const setUser = new Set(userFocusTags);
  return [...templates].sort((a, b) => {
    const countA = a.focus_tags.filter((t) => setUser.has(t)).length;
    const countB = b.focus_tags.filter((t) => setUser.has(t)).length;
    return countB - countA; // descending
  });
}
