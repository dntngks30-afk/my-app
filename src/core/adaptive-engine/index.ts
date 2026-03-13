/**
 * PR-ALG-12: Adaptive Engine v1
 *
 * Execution signals → next session modifier.
 * Rule-based. No ML dependencies.
 */

export {
  computeAdaptiveModifier,
  type AdaptiveEngineInput,
} from './computeAdaptiveModifier';

export { extractSignals, type RawSessionFeedback, type RawAdaptiveSummary, type ExtractedSignals } from './signalExtractor';

export { applyAdaptiveRules } from './adaptiveRules';

export {
  type AdaptiveModifierOutput,
  type VolumeModifier,
  type DifficultyModifier,
  type DiscomfortArea,
  VALID_DISCOMFORT_AREAS,
} from './modifierTypes';

export { getAvoidTagsForDiscomfort, DISCOMFORT_TO_AVOID_TAGS } from './discomfortMapping';
