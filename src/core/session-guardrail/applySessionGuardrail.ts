/**
 * PR-FIRST-SESSION: First Session Guardrail Engine
 *
 * Compatibility wrapper around the general Session Constraint Engine.
 * Keeps external first-session API stable while delegating to the pure engine.
 */

import type { PlanJsonOutput } from '@/lib/session/plan-generator';
import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';
import { applySessionConstraints } from '@/lib/session/constraints';

export interface GuardrailContext {
  session_number: number;
  priority_vector?: Record<string, number> | null;
  pain_mode?: 'none' | 'caution' | 'protected' | null;
  scoring_version?: string;
}

export function applySessionGuardrailWithTemplates(
  plan: PlanJsonOutput,
  context: GuardrailContext,
  templates: SessionTemplateRow[]
): PlanJsonOutput {
  if (context.session_number !== 1) {
    return plan;
  }
  const result = applySessionConstraints(plan, templates, {
    sessionNumber: context.session_number,
    isFirstSession: true,
    painMode: context.pain_mode ?? null,
    priorityVector: context.priority_vector ?? null,
    scoringVersion: context.scoring_version,
  });
  return result.plan;
}

/**
 * Apply first session guardrail. Only runs when session_number === 1.
 * Returns modified plan or original if not first session.
 */
export async function applySessionGuardrail(
  plan: PlanJsonOutput,
  context: GuardrailContext
): Promise<PlanJsonOutput> {
  const { getTemplatesForSessionPlan } = await import('@/lib/workout-routine/exercise-templates-db');
  const templates = await getTemplatesForSessionPlan({
    scoringVersion: context.scoring_version ?? 'deep_v2',
  });
  return applySessionGuardrailWithTemplates(plan, context, templates);
}
