/**
 * PR-ALG-16B: Policy Registry types.
 * Declarative rule definitions for session generation.
 */

/** Rule execution stage: when the rule applies */
export type RuleStage = 'selection' | 'post_selection' | 'audit';

/** Rule severity for explainability */
export type RuleSeverity = 'hard' | 'soft' | 'degrade';

/** Rule identity for 1:1 traceability with reason codes */
export interface PolicyRuleDef {
  id: string;
  stage: RuleStage;
  severity: RuleSeverity;
  reasonCode: string;
  /** Category for grouping (general_session, first_session, pain_mode, pattern, fatigue, fallback) */
  category: string;
  /** When enabled (e.g. "pain_mode !== 'none'" or "isFirstSession") */
  enabledCondition?: string;
}

/** Selection-time: exclude template from candidate pool */
export type SelectionExcludeFn<T> = (template: T, context: unknown) => boolean;

/** Post-selection: modify plan (segments, items) */
export type PostSelectionApplyFn = (
  segments: unknown[],
  templates: unknown[],
  context: unknown,
  addReason: (r: { ruleId: string; reasonCode: string; severity: RuleSeverity; message: string; extras?: Record<string, unknown> }) => void
) => void;
