/**
 * PR-FIRST-SESSION: Difficulty Clamp
 *
 * Ensures difficulty ≤ medium, progression_level ≤ 2.
 * balance_demand, complexity inferred from focus_tags when not in DB.
 */

import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { DIFFICULTY_CAP, PROGRESSION_LEVEL_CAP } from './guardrailRules';

const DIFFICULTY_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** focus_tags that imply high balance demand */
const HIGH_BALANCE_TAGS = new Set(['basic_balance', 'glute_medius', 'lower_chain_stability']);

/** focus_tags that imply high complexity */
const HIGH_COMPLEXITY_TAGS = new Set(['global_core', 'upper_back_activation', 'shoulder_stability']);

export function exceedsDifficultyCap(template: SessionTemplateRow): boolean {
  const diff = template.difficulty ?? null;
  if (diff && (DIFFICULTY_ORDER[diff] ?? 0) > (DIFFICULTY_ORDER[DIFFICULTY_CAP] ?? 2)) {
    return true;
  }
  const pl = template.progression_level;
  if (typeof pl === 'number' && pl > PROGRESSION_LEVEL_CAP) {
    return true;
  }
  const balanceHigh = template.focus_tags?.some((t) => HIGH_BALANCE_TAGS.has(t));
  const complexityHigh = template.focus_tags?.some((t) => HIGH_COMPLEXITY_TAGS.has(t));
  if (balanceHigh && (diff === 'high' || (typeof pl === 'number' && pl >= 3))) return true;
  if (complexityHigh && (diff === 'high' || (typeof pl === 'number' && pl >= 3))) return true;
  return false;
}

export function isSafeForFirstSession(template: SessionTemplateRow): boolean {
  return !exceedsDifficultyCap(template);
}
