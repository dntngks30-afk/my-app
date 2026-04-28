/**
 * PR2-B shared lower-pair session-1 truth.
 * 목적: preview/bootstrap 경로와 materialized 경로에서 lower-pair rule drift 방지.
 */

export const LOWER_PAIR_GOLD_PATH_RULES = {
  lower_stability: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['trunk_control'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['lower_stability'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['lower_stability'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['deconditioned'], fallbackVectors: ['trunk_control'], preferredProgression: [1] },
  ],
  lower_mobility: [
    { title: 'Prep', kind: 'prep', preferredPhases: ['prep', 'accessory'], preferredVectors: ['lower_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
    { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['lower_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2, 3] },
    { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['lower_mobility'], fallbackVectors: ['trunk_control'], preferredProgression: [1, 2] },
    { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['lower_mobility'], fallbackVectors: ['deconditioned'], preferredProgression: [1] },
  ],
} as const;

/**
 * PR2-B: intent/scoring에서 확장한 lower 태그를 dominant-axis guard에서도 동기화.
 */
export const LOWER_AXIS_GUARD_TAGS = {
  lower_stability: ['lower_chain_stability', 'glute_medius', 'glute_activation', 'basic_balance', 'core_stability'],
  lower_mobility: ['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch', 'calf_release'],
} as const;

/** PR-FIRST-SESSION-LOWER-ANCHOR-MAIN-GUARD-01: 순환 import 방지 최소 shape */
export type LowerStabilityTemplateLike = {
  target_vector?: string[] | null;
  focus_tags: string[];
};

/** Main 앵커 후보: target_vector lower_stability 또는 허용 하체/밸런스 focus_tags */
export function isLowerStabilityMainAnchorCandidate(template: LowerStabilityTemplateLike): boolean {
  const targetVector = template.target_vector ?? [];
  if (targetVector.includes('lower_stability')) return true;
  return template.focus_tags.some((tag) =>
    ['lower_chain_stability', 'glute_activation', 'glute_medius', 'basic_balance', 'core_stability'].includes(tag)
  );
}

/** 후보가 하체 앵커가 아닌데 상체만 태그하면 true (이름 검사 금지) */
export function isUpperOnlyMainOffAxisForLowerStability(template: LowerStabilityTemplateLike): boolean {
  if (isLowerStabilityMainAnchorCandidate(template)) return false;
  return template.focus_tags.some((tag) =>
    ['upper_back_activation', 'shoulder_stability', 'shoulder_mobility', 'upper_mobility'].includes(tag)
  );
}
