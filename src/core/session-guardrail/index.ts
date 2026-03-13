/**
 * PR-FIRST-SESSION: First Session Guardrail Engine
 *
 * Post-generation guardrail for session_number === 1.
 * Volume clamp, difficulty clamp, movement safety, pain protection.
 */

export { applySessionGuardrail, type GuardrailContext } from './applySessionGuardrail';
export {
  VOLUME_LIMITS,
  DIFFICULTY_CAP,
  PROGRESSION_LEVEL_CAP,
  DECONDITIONED_REDUCTIONS,
} from './guardrailRules';
export { exceedsVolumeLimits, clampVolume, countTotalExercises, countMainExercises, countTotalSets, estimateSessionTimeMinutes } from './volumeClamp';
export { exceedsDifficultyCap, isSafeForFirstSession } from './difficultyClamp';
export {
  isUnsafeCombination,
  hasHighBalanceDemand,
  hasHighTrunkDemand,
  hasSingleLegLoad,
} from './movementSafetyRules';
