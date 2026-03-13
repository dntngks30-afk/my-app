/**
 * PR-ALG-16B: Policy Registry — single source for session generation rules.
 */

export {
  SESSION_POLICY_RULES,
  getRulesByStage,
  getRuleById,
  RULE_IDS,
} from './sessionPolicyRegistry';
export { applySelectionExcludes } from './rules/selectionRules';
export type { PolicyRuleDef, RuleStage, RuleSeverity } from './types';
