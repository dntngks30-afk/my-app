/**
 * PR-ALG-10: Session Rationale Engine
 *
 * Deep Result → Session Rationale → Exercise Mapping
 * 사용자 신뢰와 처방 투명성 향상.
 */

export {
  AXIS_DESCRIPTIONS,
  getAxisLabel,
  getAxisDescription,
  getAxisSessionGoal,
  type AxisDescription,
} from './axisDescriptions';

export {
  FOCUS_TAG_TO_RATIONALE,
  getExerciseRationale,
} from './exerciseRationaleMap';

export {
  generateSessionRationale,
  type DeepResultInput,
  type SessionRationaleOutput,
} from './generateSessionRationale';
