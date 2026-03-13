/**
 * PR-ALG-16B: Selection-time rules.
 * Exclude templates before they enter the candidate pool.
 * Single source: plan-generator imports these instead of inline logic.
 */

import type { PolicyRuleDef } from '../types';
import { SESSION_POLICY_RULES } from '../sessionPolicyRegistry';

/** Template shape for selection (minimal) */
export interface SelectionTemplateLike {
  id: string;
  focus_tags: string[];
  phase?: string | null;
  difficulty?: string | null;
  progression_level?: number | null;
  avoid_if_pain_mode?: readonly string[] | null;
  balance_demand?: string | null;
  complexity?: string | null;
  contraindications?: string[] | null;
}

/** Context for selection-time rules */
export interface SelectionContext {
  sessionNumber: number;
  painMode?: 'none' | 'caution' | 'protected' | null;
}

const rules = SESSION_POLICY_RULES.filter((r) => r.stage === 'selection');

/** Pain mode: avoid_if_pain_mode contains current pain_mode */
export function isExcludedByPainMode(
  template: SelectionTemplateLike,
  painMode?: 'none' | 'caution' | 'protected' | null
): boolean {
  if (!painMode || painMode === 'none') return false;
  return (template.avoid_if_pain_mode ?? []).includes(painMode);
}

/** First session: high difficulty, progression>=3, balance_demand/complexity high */
export function isExcludedByFirstSessionGuardrail(
  template: SelectionTemplateLike,
  sessionNumber: number
): boolean {
  if (sessionNumber !== 1) return false;
  if (template.difficulty === 'high') return true;
  if (typeof template.progression_level === 'number' && template.progression_level >= 3) return true;
  if (template.balance_demand === 'high') return true;
  if (template.complexity === 'high') return true;
  return false;
}

/** Protected pain mode: balance_demand high, complexity high */
export function isExcludedByProtectedV2Guardrail(
  template: SelectionTemplateLike,
  painMode?: 'none' | 'caution' | 'protected' | null
): boolean {
  if (!painMode || painMode !== 'protected') return false;
  if (template.balance_demand === 'high') return true;
  if (template.complexity === 'high') return true;
  return false;
}

/** Apply all selection-time exclude rules. Returns true if template should be excluded. */
export function shouldExcludeTemplate(
  template: SelectionTemplateLike,
  context: SelectionContext
): boolean {
  if (isExcludedByPainMode(template, context.painMode)) return true;
  if (isExcludedByFirstSessionGuardrail(template, context.sessionNumber)) return true;
  if (isExcludedByProtectedV2Guardrail(template, context.painMode)) return true;
  return false;
}

export function getSelectionRules(): PolicyRuleDef[] {
  return rules;
}
