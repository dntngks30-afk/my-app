/**
 * PR-ALG-16A: General Session Constraint Engine — types.
 * Pure-function friendly. No route or DB dependency.
 */

export type ConstraintOutcome =
  | 'hard_block'
  | 'soft_discourage'
  | 'degrade_applied';

export type ConstraintReasonCode =
  | 'blocked_by_pain_mode'
  | 'blocked_by_pattern_cap'
  | 'blocked_by_fatigue_cap'
  | 'degraded_due_to_low_inventory'
  | 'degraded_due_to_main_count_shortage'
  | 'first_session_guardrail_applied'
  | 'reduced_due_to_deconditioned'
  | 'replaced_unsafe_combination'
  | 'phase_order_violation';

export type ConstraintScope = 'session' | 'plan' | 'segment' | 'item';

/** PR-ALG-16B: rule_id/stage for 1:1 traceability with policy registry */
export interface ConstraintReason {
  kind: ConstraintOutcome;
  code: ConstraintReasonCode;
  scope: ConstraintScope;
  message: string;
  /** Policy registry rule id (1:1 with reason) */
  rule_id?: string;
  /** selection | post_selection | audit */
  stage?: string;
  segmentIndex?: number;
  itemIndex?: number;
  beforeValue?: number | string;
  afterValue?: number | string;
}

export interface ConstraintEngineContext {
  sessionNumber: number;
  totalSessions?: number;
  painMode?: 'none' | 'caution' | 'protected' | null;
  isFirstSession: boolean;
  priorityVector?: Record<string, number> | null;
  scoringVersion?: string;
}

export interface ConstraintTemplateLike {
  id: string;
  name: string;
  phase?: string | null;
  focus_tags: string[];
  difficulty?: string | null;
  progression_level?: number | null;
  avoid_if_pain_mode?: string[] | null;
  balance_demand?: string | null;
  complexity?: string | null;
  media_ref?: unknown;
}

export interface ConstraintEngineSummary {
  hard_block_count: number;
  soft_discourage_count: number;
  degrade_applied_count: number;
  total_items: number;
  main_items: number;
  fatigue_score: number;
}

export interface ConstraintEngineMeta {
  version: 'session_constraint_engine_v1';
  reasons: ConstraintReason[];
  flags: Record<string, boolean>;
  summary: ConstraintEngineSummary;
  applied_rule_count: number;
}

export interface ConstraintEngineResult<TPlan> {
  plan: TPlan;
  meta: ConstraintEngineMeta;
}
