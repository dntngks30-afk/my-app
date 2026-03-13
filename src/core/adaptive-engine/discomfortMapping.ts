/**
 * PR-ALG-12: discomfort_area → contraindication tags for session composer
 *
 * Maps reflection discomfort_area to exercise template avoid tags.
 */

/** discomfort_area (reflection) → contraindication tags to add to avoid set */
export const DISCOMFORT_TO_AVOID_TAGS: Record<string, string[]> = {
  knee: ['knee_load', 'knee_ground_pain', 'deep_squat'],
  lower_back: ['lower_back_pain'],
  wrist: ['wrist_load'],
  shoulder: ['shoulder_overhead', 'shoulder_anterior_pain'],
  neck: ['shoulder_overhead'],
};

export function getAvoidTagsForDiscomfort(discomfortArea: string | null): string[] {
  if (!discomfortArea || typeof discomfortArea !== 'string') return [];
  const key = discomfortArea.trim().toLowerCase();
  return DISCOMFORT_TO_AVOID_TAGS[key] ?? [];
}
