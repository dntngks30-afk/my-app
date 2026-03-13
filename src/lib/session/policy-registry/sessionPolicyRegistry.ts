/**
 * PR-ALG-16B: Session Policy Registry.
 * Single source of rule definitions. Used by plan-generator and constraint engine.
 */

import type { PolicyRuleDef } from './types';

/** All session generation rules — declarative, single source */
export const SESSION_POLICY_RULES: PolicyRuleDef[] = [
  // ─── selection-time: candidate pool exclusion ─────────────────────────────
  {
    id: 'sel_pain_avoid',
    stage: 'selection',
    severity: 'hard',
    reasonCode: 'blocked_by_pain_mode',
    category: 'pain_mode_rules',
    enabledCondition: "pain_mode !== 'none'",
  },
  {
    id: 'sel_protected_v2',
    stage: 'selection',
    severity: 'hard',
    reasonCode: 'blocked_by_pain_mode',
    category: 'pain_mode_rules',
    enabledCondition: "pain_mode === 'protected'",
  },
  {
    id: 'sel_first_session',
    stage: 'selection',
    severity: 'hard',
    reasonCode: 'first_session_guardrail_applied',
    category: 'first_session_rules',
    enabledCondition: 'sessionNumber === 1',
  },
  // ─── post_selection: plan audit/degrade ───────────────────────────────────
  {
    id: 'post_phase_order',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'phase_order_violation',
    category: 'general_session_rules',
  },
  {
    id: 'post_pain_safety',
    stage: 'post_selection',
    severity: 'hard',
    reasonCode: 'blocked_by_pain_mode',
    category: 'pain_mode_rules',
    enabledCondition: "pain_mode !== 'none'",
  },
  {
    id: 'post_main_min',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'degraded_due_to_main_count_shortage',
    category: 'general_session_rules',
  },
  {
    id: 'post_main_low_inventory',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'degraded_due_to_low_inventory',
    category: 'fallback_rules',
  },
  {
    id: 'post_pattern_cap',
    stage: 'post_selection',
    severity: 'hard',
    reasonCode: 'blocked_by_pattern_cap',
    category: 'pattern_rules',
  },
  {
    id: 'post_fatigue_cap',
    stage: 'post_selection',
    severity: 'hard',
    reasonCode: 'blocked_by_fatigue_cap',
    category: 'fatigue_rules',
  },
  {
    id: 'post_first_session_item',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'first_session_guardrail_applied',
    category: 'first_session_rules',
    enabledCondition: 'isFirstSession',
  },
  {
    id: 'post_first_session_unsafe_combo',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'replaced_unsafe_combination',
    category: 'first_session_rules',
    enabledCondition: 'isFirstSession',
  },
  {
    id: 'post_first_session_volume',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'first_session_guardrail_applied',
    category: 'first_session_rules',
    enabledCondition: 'isFirstSession',
  },
  {
    id: 'post_deconditioned',
    stage: 'post_selection',
    severity: 'degrade',
    reasonCode: 'reduced_due_to_deconditioned',
    category: 'first_session_rules',
    enabledCondition: 'isFirstSession && priorityVector.deconditioned > 0',
  },
];

export function getRulesByStage(stage: 'selection' | 'post_selection'): PolicyRuleDef[] {
  return SESSION_POLICY_RULES.filter((r) => r.stage === stage);
}

export function getRuleById(id: string): PolicyRuleDef | undefined {
  return SESSION_POLICY_RULES.find((r) => r.id === id);
}

export function getRulesByCategory(category: string): PolicyRuleDef[] {
  return SESSION_POLICY_RULES.filter((r) => r.category === category);
}

/** Rule IDs for traceability in constraint engine meta */
export const RULE_IDS = {
  post_phase_order: 'post_phase_order',
  post_pain_safety: 'post_pain_safety',
  post_main_min: 'post_main_min',
  post_main_low_inventory: 'post_main_low_inventory',
  post_pattern_cap: 'post_pattern_cap',
  post_fatigue_cap: 'post_fatigue_cap',
  post_first_session_item: 'post_first_session_item',
  post_first_session_unsafe_combo: 'post_first_session_unsafe_combo',
  post_first_session_volume: 'post_first_session_volume',
  post_deconditioned: 'post_deconditioned',
} as const;
