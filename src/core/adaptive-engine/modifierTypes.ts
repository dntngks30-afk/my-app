/**
 * PR-ALG-12: Adaptive Engine v1 — Modifier Types
 *
 * Execution signals → modifier output for session composer.
 */

/** Volume modifier: -1 reduce, 0 neutral, +1 increase */
export type VolumeModifier = -1 | 0 | 1;

/** Difficulty modifier: -1 easier, 0 neutral, +1 harder */
export type DifficultyModifier = -1 | 0 | 1;

/** Adaptive modifier output for next session generation */
export interface AdaptiveModifierOutput {
  volume_modifier: VolumeModifier;
  difficulty_modifier: DifficultyModifier;
  protection_mode: boolean;
  discomfort_area: string | null;
}

/** Valid discomfort areas from reflection */
export type DiscomfortArea = 'neck' | 'lower_back' | 'knee' | 'wrist' | 'shoulder';

export const VALID_DISCOMFORT_AREAS: readonly DiscomfortArea[] = [
  'neck',
  'lower_back',
  'knee',
  'wrist',
  'shoulder',
] as const;
