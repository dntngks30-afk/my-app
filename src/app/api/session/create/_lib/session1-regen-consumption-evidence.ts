/**
 * PR-RISK-08: Session-1 profile-mismatch safe regeneration — consumption evidence classification.
 * Conservative: ambiguous or strong evidence → do not regenerate; reuse active plan.
 */

import type { SessionCreatePlanRow } from './types';

export type Session1ConsumptionEvidenceClass =
  | 'no_consumption_evidence'
  | 'strong_consumption_evidence'
  | 'ambiguous_consumption_evidence';

export type Session1ConsumptionEvidence = {
  classification: Session1ConsumptionEvidenceClass;
  reasons: string[];
};

function isNonEmptyExecutionSummary(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.keys(v as Record<string, unknown>).length > 0;
}

/**
 * Classifies whether an active session-1 plan row shows meaningful consumption beyond a fresh draft.
 * Uses grounded session_plans columns (not logs-only).
 */
export function classifySession1PlanConsumptionEvidence(plan: SessionCreatePlanRow): Session1ConsumptionEvidence {
  if (plan.session_number !== 1) {
    return { classification: 'strong_consumption_evidence', reasons: ['not_session_1'] };
  }

  if (plan.status !== 'draft') {
    return { classification: 'strong_consumption_evidence', reasons: ['plan_status_not_draft'] };
  }

  if (typeof plan.started_at === 'string' && plan.started_at.trim().length > 0) {
    return { classification: 'strong_consumption_evidence', reasons: ['started_at_present'] };
  }

  if (typeof plan.completed_at === 'string' && plan.completed_at.trim().length > 0) {
    return { classification: 'strong_consumption_evidence', reasons: ['completed_at_present'] };
  }

  if (typeof plan.duration_seconds === 'number' && Number.isFinite(plan.duration_seconds) && plan.duration_seconds > 0) {
    return { classification: 'strong_consumption_evidence', reasons: ['duration_seconds_positive'] };
  }

  if (typeof plan.completion_mode === 'string' && plan.completion_mode.trim().length > 0) {
    return { classification: 'strong_consumption_evidence', reasons: ['completion_mode_present'] };
  }

  if (isNonEmptyExecutionSummary(plan.execution_summary_json)) {
    return { classification: 'strong_consumption_evidence', reasons: ['execution_summary_present'] };
  }

  const logs = plan.exercise_logs;
  if (logs != null && !Array.isArray(logs)) {
    return { classification: 'ambiguous_consumption_evidence', reasons: ['exercise_logs_malformed'] };
  }

  if (Array.isArray(logs) && logs.length > 0) {
    return { classification: 'strong_consumption_evidence', reasons: ['exercise_logs_non_empty'] };
  }

  return { classification: 'no_consumption_evidence', reasons: [] };
}

export function isSafeSession1ProfileMismatchRegen(plan: SessionCreatePlanRow): boolean {
  return classifySession1PlanConsumptionEvidence(plan).classification === 'no_consumption_evidence';
}
