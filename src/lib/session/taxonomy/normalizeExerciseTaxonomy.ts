/**
 * PR-ALG-16B: Minimum viable taxonomy normalization.
 * Derives pattern_family, body_region, load_type, training_intent, risk_group from raw metadata.
 * No DB changes — application layer only.
 */

import type { ExerciseTaxonomy, TaxonomySource } from './types';

/** focus_tags[0] → pattern_family (alias for constraint/order/scoring) */
const FOCUS_TO_PATTERN: Record<string, string> = {
  full_body_reset: 'full_body_reset',
  core_control: 'core_control',
  core_stability: 'core_stability',
  global_core: 'global_core',
  lower_chain_stability: 'lower_chain_stability',
  glute_activation: 'glute_activation',
  glute_medius: 'glute_medius',
  basic_balance: 'basic_balance',
  hip_mobility: 'hip_mobility',
  ankle_mobility: 'ankle_mobility',
  thoracic_mobility: 'thoracic_mobility',
  shoulder_mobility: 'shoulder_mobility',
  shoulder_stability: 'shoulder_stability',
  upper_back_activation: 'upper_back_activation',
  upper_trap_release: 'upper_trap_release',
  neck_mobility: 'neck_mobility',
  hip_flexor_stretch: 'hip_flexor_stretch',
  calf_release: 'calf_release',
};

/** focus_tags → body_region */
const FOCUS_TO_BODY: Record<string, string> = {
  full_body_reset: 'full',
  core_control: 'trunk',
  core_stability: 'trunk',
  global_core: 'trunk',
  lower_chain_stability: 'lower',
  glute_activation: 'lower',
  glute_medius: 'lower',
  basic_balance: 'lower',
  hip_mobility: 'lower',
  ankle_mobility: 'lower',
  thoracic_mobility: 'upper',
  shoulder_mobility: 'upper',
  shoulder_stability: 'upper',
  upper_back_activation: 'upper',
  upper_trap_release: 'upper',
  neck_mobility: 'upper',
  hip_flexor_stretch: 'lower',
  calf_release: 'lower',
};

/** focus_tags → load_type */
const FOCUS_TO_LOAD: Record<string, string> = {
  full_body_reset: 'recovery',
  core_control: 'stability',
  core_stability: 'stability',
  global_core: 'stability',
  lower_chain_stability: 'stability',
  glute_activation: 'stability',
  glute_medius: 'stability',
  basic_balance: 'stability',
  hip_mobility: 'mobility',
  ankle_mobility: 'mobility',
  thoracic_mobility: 'mobility',
  shoulder_mobility: 'mobility',
  shoulder_stability: 'stability',
  upper_back_activation: 'strength',
  upper_trap_release: 'mobility',
  neck_mobility: 'mobility',
  hip_flexor_stretch: 'mobility',
  calf_release: 'mobility',
};

/** phase → training_intent */
const PHASE_TO_INTENT: Record<string, string> = {
  prep: 'prep',
  main: 'main',
  accessory: 'accessory',
  cooldown: 'cooldown',
};

/** difficulty + balance_demand + complexity + avoid_if_pain_mode → risk_group */
function deriveRiskGroup(source: TaxonomySource): string {
  const hasProtectedAvoid = (source.avoid_if_pain_mode ?? []).includes('protected');
  const hasCautionAvoid = (source.avoid_if_pain_mode ?? []).includes('caution');
  const balanceHigh = source.balance_demand === 'high';
  const complexityHigh = source.complexity === 'high';
  const diffHigh = source.difficulty === 'high';
  const progHigh = (source.progression_level ?? 1) >= 3;

  if (hasProtectedAvoid || (balanceHigh && diffHigh) || (complexityHigh && diffHigh) || progHigh) return 'high';
  if (hasCautionAvoid || balanceHigh || complexityHigh) return 'medium';
  return 'low';
}

export function normalizeExerciseTaxonomy(source: TaxonomySource): ExerciseTaxonomy {
  const primaryFocus = source.focus_tags[0] ?? '_none';
  const pattern_family = FOCUS_TO_PATTERN[primaryFocus] ?? primaryFocus;
  const body_region = FOCUS_TO_BODY[primaryFocus] ?? 'trunk';
  const load_type = FOCUS_TO_LOAD[primaryFocus] ?? 'stability';
  const training_intent = source.phase ? (PHASE_TO_INTENT[source.phase] ?? source.phase) : 'main';
  const risk_group = deriveRiskGroup(source);

  return {
    pattern_family,
    body_region,
    load_type,
    training_intent,
    risk_group,
  };
}
