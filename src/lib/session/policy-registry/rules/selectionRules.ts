/**
 * PR-ALG-16B: Selection-time rules.
 * Exclude templates before they enter the candidate pool.
 * Single source: plan-generator imports these instead of inline logic.
 * Taxonomy-derived risk_group is primary signal; raw metadata is fallback.
 */

import type { PolicyRuleDef } from '../types';
import { SESSION_POLICY_RULES, RULE_IDS } from '../sessionPolicyRegistry';
import { normalizeExerciseTaxonomy } from '@/lib/session/taxonomy';

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

/** Minimal trace entry for explainability */
export interface SelectionTraceEntry {
  ruleId: string;
  reasonCode: string;
  templateId: string;
  category: string;
  risk_group?: string;
}

/** Result of applySelectionExcludesWithTrace */
export interface SelectionExcludeTraceResult<T> {
  templates: T[];
  excludedCountByRule: Record<string, number>;
  appliedRuleIds: string[];
  trace: SelectionTraceEntry[];
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

/** First session: taxonomy risk_group high → exclude. Raw metadata fallback. */
export function isExcludedByFirstSessionGuardrail(
  template: SelectionTemplateLike,
  sessionNumber: number,
  riskGroup?: string
): boolean {
  if (sessionNumber !== 1) return false;
  if (riskGroup === 'high') return true;
  if (template.difficulty === 'high') return true;
  if (typeof template.progression_level === 'number' && template.progression_level >= 3) return true;
  if (template.balance_demand === 'high') return true;
  if (template.complexity === 'high') return true;
  return false;
}

/** Protected pain mode: taxonomy risk_group high/medium → exclude. Raw fallback. */
export function isExcludedByProtectedV2Guardrail(
  template: SelectionTemplateLike,
  painMode?: 'none' | 'caution' | 'protected' | null,
  riskGroup?: string
): boolean {
  if (!painMode || painMode !== 'protected') return false;
  if (riskGroup === 'high' || riskGroup === 'medium') return true;
  if (template.balance_demand === 'high') return true;
  if (template.complexity === 'high') return true;
  return false;
}

/** Apply all selection-time exclude rules. Returns true if template should be excluded. */
export function shouldExcludeTemplate(
  template: SelectionTemplateLike,
  context: SelectionContext,
  taxonomy?: { risk_group: string }
): boolean {
  const riskGroup = taxonomy?.risk_group;
  if (isExcludedByPainMode(template, context.painMode)) return true;
  if (isExcludedByFirstSessionGuardrail(template, context.sessionNumber, riskGroup)) return true;
  if (isExcludedByProtectedV2Guardrail(template, context.painMode, riskGroup)) return true;
  return false;
}

/** Determine which rule excluded the template (first match). Returns rule id or null. */
function getExcludingRuleId(
  template: SelectionTemplateLike,
  context: SelectionContext,
  taxonomy?: { risk_group: string }
): { ruleId: string; reasonCode: string; category: string } | null {
  if (isExcludedByPainMode(template, context.painMode)) {
    const rule = rules.find((r) => r.id === RULE_IDS.sel_pain_avoid) ?? rules[0];
    return { ruleId: RULE_IDS.sel_pain_avoid, reasonCode: rule.reasonCode, category: rule.category };
  }
  if (isExcludedByProtectedV2Guardrail(template, context.painMode, taxonomy?.risk_group)) {
    const rule = rules.find((r) => r.id === RULE_IDS.sel_protected_v2) ?? rules[1];
    return { ruleId: RULE_IDS.sel_protected_v2, reasonCode: rule.reasonCode, category: rule.category };
  }
  if (isExcludedByFirstSessionGuardrail(template, context.sessionNumber, taxonomy?.risk_group)) {
    const rule = rules.find((r) => r.id === RULE_IDS.sel_first_session) ?? rules[2];
    return { ruleId: RULE_IDS.sel_first_session, reasonCode: rule.reasonCode, category: rule.category };
  }
  return null;
}

/**
 * Apply selection excludes with trace. Uses taxonomy risk_group as primary signal.
 * Rule evaluation is SESSION_POLICY_RULES.filter(stage === 'selection') based.
 */
export function applySelectionExcludesWithTrace<T extends SelectionTemplateLike>(
  templates: T[],
  context: SelectionContext
): SelectionExcludeTraceResult<T> {
  const excludedCountByRule: Record<string, number> = {};
  const trace: SelectionTraceEntry[] = [];
  const appliedRuleIds = new Set<string>();

  const filtered = templates.filter((template) => {
    const taxonomy = normalizeExerciseTaxonomy(template);
    const excluding = getExcludingRuleId(template, context, taxonomy);
    if (!excluding) return true;

    excludedCountByRule[excluding.ruleId] = (excludedCountByRule[excluding.ruleId] ?? 0) + 1;
    appliedRuleIds.add(excluding.ruleId);
    trace.push({
      ruleId: excluding.ruleId,
      reasonCode: excluding.reasonCode,
      templateId: template.id,
      category: excluding.category,
      risk_group: taxonomy.risk_group,
    });
    return false;
  });

  return {
    templates: filtered,
    excludedCountByRule,
    appliedRuleIds: Array.from(appliedRuleIds),
    trace,
  };
}

/**
 * Apply selection excludes. Wrapper for backward compatibility.
 * Use applySelectionExcludesWithTrace in plan-generator for traceability.
 */
export function applySelectionExcludes<T extends SelectionTemplateLike>(
  templates: T[],
  context: SelectionContext
): T[] {
  return applySelectionExcludesWithTrace(templates, context).templates;
}

export function getSelectionRules(): PolicyRuleDef[] {
  return rules;
}
