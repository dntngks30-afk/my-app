import type {
  ConstraintOutcome,
  ConstraintReason,
  ConstraintReasonCode,
  ConstraintScope,
} from './types';

export function createConstraintReason(
  kind: ConstraintOutcome,
  code: ConstraintReasonCode,
  scope: ConstraintScope,
  message: string,
  extras?: Partial<Omit<ConstraintReason, 'kind' | 'code' | 'scope' | 'message'>>
): ConstraintReason {
  return {
    kind,
    code,
    scope,
    message,
    ...extras,
  };
}

/** PR-ALG-16B: Create reason with rule_id/stage for registry traceability */
export function createConstraintReasonWithRule(
  kind: ConstraintOutcome,
  code: ConstraintReasonCode,
  scope: ConstraintScope,
  message: string,
  ruleId: string,
  stage: 'selection' | 'post_selection' | 'audit',
  extras?: Partial<Omit<ConstraintReason, 'kind' | 'code' | 'scope' | 'message' | 'rule_id' | 'stage'>>
): ConstraintReason {
  return {
    kind,
    code,
    scope,
    message,
    rule_id: ruleId,
    stage,
    ...extras,
  };
}
