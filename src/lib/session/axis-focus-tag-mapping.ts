/**
 * PR-RISK-07: SSOT for priority_vector axis ↔ template focus_tags ↔ target_vector → focus axis.
 * Shared by selection (priority-layer) and final-plan display reconciliation.
 */

const PRIORITY_AXIS_TO_FOCUS_TAGS_RAW = {
  lower_stability: ['lower_chain_stability', 'glute_medius', 'basic_balance', 'core_stability'],
  lower_mobility: ['hip_mobility', 'ankle_mobility'],
  upper_mobility: ['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability'],
  trunk_control: ['core_control', 'core_stability', 'global_core'],
  asymmetry: ['basic_balance', 'lower_chain_stability'],
  deconditioned: ['full_body_reset', 'core_control'],
} as const;

/** priority_vector axis → focus_tags for template scoring and tag→axis back-projection */
export const PRIORITY_AXIS_TO_FOCUS_TAGS: Record<string, readonly string[]> =
  PRIORITY_AXIS_TO_FOCUS_TAGS_RAW;

/** template target_vector string → session focus axis; balanced_reset splits trunk vs upper in consumers */
export type TargetVectorAxisMapping = string | 'split_trunk_upper';

export const VECTOR_TO_FOCUS_AXIS: Readonly<Record<string, TargetVectorAxisMapping>> = {
  lower_stability: 'lower_stability',
  lower_mobility: 'lower_mobility',
  upper_mobility: 'upper_mobility',
  trunk_control: 'trunk_control',
  deconditioned: 'deconditioned',
  balanced_reset: 'split_trunk_upper',
} as const;

/** Inverse map: focus_tag → axes that claim that tag under PRIORITY_AXIS_TO_FOCUS_TAGS */
export const TAG_TO_AXES: Map<string, string[]> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [axis, tags] of Object.entries(PRIORITY_AXIS_TO_FOCUS_TAGS)) {
    for (const tag of tags) {
      if (!m.has(tag)) m.set(tag, new Set());
      m.get(tag)!.add(axis);
    }
  }
  return new Map([...m.entries()].map(([k, v]) => [k, [...v]]));
})();
