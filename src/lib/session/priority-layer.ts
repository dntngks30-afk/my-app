/**
 * PR-ALG-03: Priority Layer for Session Plan Generator
 *
 * Safety Gate + Priority Selector.
 * Additive front-layer only. Generator core unchanged.
 */

/** priority_vector axis → focus_tags for template scoring */
const PRIORITY_AXIS_TO_FOCUS_TAGS: Record<string, string[]> = {
  lower_stability: ['lower_chain_stability', 'glute_medius', 'basic_balance', 'core_stability'],
  lower_mobility: ['hip_mobility', 'ankle_mobility'],
  upper_mobility: ['thoracic_mobility', 'shoulder_mobility', 'shoulder_stability'],
  trunk_control: ['core_control', 'core_stability', 'global_core'],
  asymmetry: ['basic_balance', 'lower_chain_stability'],
  deconditioned: ['full_body_reset', 'core_control'],
};

/** pain_mode=protected 시 추가 제외할 contraindication 코드. PR-SESSION-QUALITY-01: deep_squat 추가 */
const PAIN_PROTECTED_EXTRA_AVOID = [
  'knee_load',
  'wrist_load',
  'shoulder_overhead',
  'ankle_instability',
  'deep_squat',
];

/** pain_mode=caution 시 추가 제외 (완화) */
const PAIN_CAUTION_EXTRA_AVOID = ['knee_load', 'wrist_load'];

/** PR-ALG-21: resultType (user-facing) → focus_tags for type-to-session alignment */
const RESULT_TYPE_TO_FOCUS_TAGS: Record<string, string[]> = {
  'NECK-SHOULDER': ['upper_trap_release', 'neck_mobility', 'thoracic_mobility', 'shoulder_stability'],
  'UPPER-LIMB': ['shoulder_mobility', 'shoulder_stability', 'upper_back_activation'],
  'LOWER-LIMB': ['lower_chain_stability', 'glute_medius', 'ankle_mobility', 'glute_activation'],
  'LUMBO-PELVIS': ['hip_mobility', 'glute_activation', 'core_control', 'core_stability'],
};

export type PainMode = 'none' | 'caution' | 'protected';

/**
 * PR-ALG-21: resultType-aligned focus tags for scoring bonus.
 * Ensures first session main has at least one item matching user-facing type.
 */
export function getResultTypeFocusTags(resultType?: string | null): string[] {
  if (!resultType || typeof resultType !== 'string') return [];
  return RESULT_TYPE_TO_FOCUS_TAGS[resultType] ?? [];
}

/**
 * Safety Gate: pain_mode에 따라 추가 exclude 태그 반환.
 * 기존 avoid + painFlags에 더해 사용.
 */
export function getPainModeExtraAvoid(painMode?: PainMode | null): string[] {
  if (!painMode || painMode === 'none') return [];
  if (painMode === 'protected') return [...PAIN_PROTECTED_EXTRA_AVOID];
  if (painMode === 'caution') return [...PAIN_CAUTION_EXTRA_AVOID];
  return [];
}

/**
 * Priority Selector: priority_vector → 이번 세션 우선 focus_tags 2~3개.
 * deep_v3 없으면 null (fallback to existing focus).
 */
export function resolveSessionPriorities(priorityVector?: Record<string, number> | null): string[] | null {
  if (!priorityVector || typeof priorityVector !== 'object') return null;

  const axes = Object.entries(priorityVector)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  if (axes.length === 0) return null;

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const [axis] of axes.slice(0, 3)) {
    const axisTags = PRIORITY_AXIS_TO_FOCUS_TAGS[axis] ?? [];
    for (const t of axisTags) {
      if (!seen.has(t)) {
        seen.add(t);
        tags.push(t);
      }
    }
  }
  return tags.length > 0 ? tags : null;
}

/**
 * priority 기반 bonus 점수.
 * template의 focus_tags가 priorityTags와 겹치면 bonus.
 */
export function scoreByPriority(
  templateFocusTags: string[],
  priorityTags: string[] | null,
  bonusPerMatch = 2
): number {
  if (!priorityTags || priorityTags.length === 0) return 0;
  const set = new Set(priorityTags);
  const matches = templateFocusTags.filter((t) => set.has(t)).length;
  return matches * bonusPerMatch;
}

/**
 * pain_mode 기반 penalty.
 * protected: 고위험 contraindication 있으면 penalty.
 * caution: 완화된 penalty.
 */
export function getPainModePenalty(
  contraindications: string[],
  painMode?: PainMode | null
): number {
  if (!painMode || painMode === 'none') return 0;
  const highRisk = new Set(PAIN_PROTECTED_EXTRA_AVOID);
  const hasHighRisk = contraindications.some((c) => highRisk.has(c));
  if (!hasHighRisk) return 0;
  if (painMode === 'protected') return 50;
  if (painMode === 'caution') return 20;
  return 0;
}
