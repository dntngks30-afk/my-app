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

