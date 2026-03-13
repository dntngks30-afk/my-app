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
