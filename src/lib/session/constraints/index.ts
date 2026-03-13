/**
 * PR-ALG-16A: General Session Constraint Engine.
 */

export { applySessionConstraints } from './applySessionConstraints';
export { applyFirstSessionPolicy } from './applyFirstSessionPolicy';
export { createConstraintReason } from './reasons';
export type {
  ConstraintEngineContext,
  ConstraintEngineMeta,
  ConstraintEngineResult,
  ConstraintReason,
  ConstraintTemplateLike,
} from './types';
export {
  CONSTRAINT_ENGINE_VERSION,
  PHASE_ORDER,
  MAIN_COUNT_MIN,
  PATTERN_CAP_MAIN,
  FATIGUE_CAP_SCORE,
  FIRST_SESSION_MAX_TOTAL,
  FIRST_SESSION_MAX_MAIN,
} from './constants';
