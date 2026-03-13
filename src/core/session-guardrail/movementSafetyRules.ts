/**
 * PR-FIRST-SESSION: Movement Combination Safety
 *
 * Prevents unsafe exercise stacking.
 */

import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';

/** Tags implying high balance demand */
const HIGH_BALANCE_TAGS = new Set([
  'basic_balance',
  'glute_medius',
  'lower_chain_stability',
  'ankle_mobility',
]);

/** Tags implying high trunk demand */
const HIGH_TRUNK_TAGS = new Set([
  'core_stability',
  'global_core',
  'core_control',
  'upper_back_activation',
]);

/** Tags implying high mobility stretch */
const HIGH_MOBILITY_STRETCH_TAGS = new Set([
  'hip_flexor_stretch',
  'thoracic_mobility',
  'shoulder_mobility',
  'ankle_mobility',
]);

/** Tags implying unstable stance */
const UNSTABLE_STANCE_TAGS = new Set([
  'basic_balance',
  'glute_medius',
  'lower_chain_stability',
]);

/** Tags implying single-leg load */
const SINGLE_LEG_TAGS = new Set(['basic_balance', 'glute_medius', 'lower_chain_stability']);

/** Tags implying rotation load */
const ROTATION_TAGS = new Set(['thoracic_mobility', 'global_core', 'core_stability']);

function hasAny(template: SessionTemplateRow, tagSet: Set<string>): boolean {
  return (template.focus_tags ?? []).some((t) => tagSet.has(t));
}

export function hasHighBalanceDemand(template: SessionTemplateRow): boolean {
  return hasAny(template, HIGH_BALANCE_TAGS);
}

export function hasHighTrunkDemand(template: SessionTemplateRow): boolean {
  return hasAny(template, HIGH_TRUNK_TAGS);
}

export function hasHighMobilityStretch(template: SessionTemplateRow): boolean {
  return hasAny(template, HIGH_MOBILITY_STRETCH_TAGS);
}

export function hasUnstableStance(template: SessionTemplateRow): boolean {
  return hasAny(template, UNSTABLE_STANCE_TAGS);
}

export function hasSingleLegLoad(template: SessionTemplateRow): boolean {
  return hasAny(template, SINGLE_LEG_TAGS);
}

export function hasRotationLoad(template: SessionTemplateRow): boolean {
  return hasAny(template, ROTATION_TAGS);
}

/** Forbidden: high balance + high trunk demand */
export function isUnsafeComboBalanceTrunk(
  a: SessionTemplateRow,
  b: SessionTemplateRow
): boolean {
  return (
    (hasHighBalanceDemand(a) && hasHighTrunkDemand(b)) ||
    (hasHighTrunkDemand(a) && hasHighBalanceDemand(b))
  );
}

/** Forbidden: high mobility stretch + unstable stance */
export function isUnsafeComboMobilityUnstable(
  a: SessionTemplateRow,
  b: SessionTemplateRow
): boolean {
  return (
    (hasHighMobilityStretch(a) && hasUnstableStance(b)) ||
    (hasUnstableStance(a) && hasHighMobilityStretch(b))
  );
}

/** Forbidden: single-leg load + rotation load */
export function isUnsafeComboSingleLegRotation(
  a: SessionTemplateRow,
  b: SessionTemplateRow
): boolean {
  return (
    (hasSingleLegLoad(a) && hasRotationLoad(b)) ||
    (hasRotationLoad(a) && hasSingleLegLoad(b))
  );
}

export function isUnsafeCombination(
  a: SessionTemplateRow,
  b: SessionTemplateRow
): boolean {
  return (
    isUnsafeComboBalanceTrunk(a, b) ||
    isUnsafeComboMobilityUnstable(a, b) ||
    isUnsafeComboSingleLegRotation(a, b)
  );
}
