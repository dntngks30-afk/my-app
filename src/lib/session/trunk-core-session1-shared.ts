/**
 * PR2-D shared trunk/core session-1 truth.
 * Keeps materialized generation and bootstrap preview aligned for CORE_CONTROL_DEFICIT.
 */

import type { SessionSegmentKind } from '@/lib/session/upper-mobility-session1-shared';

type TrunkCoreSessionTemplateProjectionRow = {
  id: string;
  focus_tags?: string[] | null;
  target_vector?: string[] | null;
};

export const TRUNK_CORE_GOLD_PATH_RULES = [
  { title: 'Prep', kind: 'prep', preferredPhases: ['prep'], preferredVectors: ['trunk_control', 'deconditioned'], fallbackVectors: ['upper_mobility'], preferredProgression: [1] },
  { title: 'Main', kind: 'main', preferredPhases: ['main'], preferredVectors: ['trunk_control'], fallbackVectors: ['lower_stability'], preferredProgression: [1, 2, 3] },
  { title: 'Accessory', kind: 'accessory', preferredPhases: ['accessory', 'main'], preferredVectors: ['trunk_control'], fallbackVectors: ['lower_stability', 'upper_mobility'], preferredProgression: [1, 2] },
  { title: 'Cooldown', kind: 'cooldown', preferredPhases: ['accessory', 'prep'], preferredVectors: ['deconditioned', 'trunk_control'], fallbackVectors: ['upper_mobility'], preferredProgression: [1] },
] as const;

const TRUNK_CORE_MAIN_TAGS = new Set(['core_stability', 'global_core']);
const TRUNK_CORE_CONTROL_TAGS = new Set(['core_control', 'core_stability', 'global_core']);
const TRUNK_CORE_SUPPORT_TAGS = new Set(['glute_activation', 'lower_chain_stability', 'basic_balance']);
const TRUNK_CORE_SESSION1_MAIN_SUPPORT_TEMPLATE_IDS = new Set(['M12']);
const UPPER_DISTRACTOR_TAGS = new Set([
  'shoulder_mobility',
  'thoracic_mobility',
  'upper_back_activation',
  'shoulder_stability',
]);

function appendUnique(values: readonly string[], additions: readonly string[]): string[] {
  return [...new Set([...values, ...additions])];
}

function countMatches(tags: readonly string[], tagSet: ReadonlySet<string>): number {
  return tags.filter((tag) => tagSet.has(tag)).length;
}

export function applyTrunkCoreSession1TemplateProjection<T extends TrunkCoreSessionTemplateProjectionRow>(
  templates: readonly T[],
  anchorType?: string | null
): T[] {
  if (anchorType !== 'trunk_control') return templates as T[];

  return templates.map((template) => {
    if (!TRUNK_CORE_SESSION1_MAIN_SUPPORT_TEMPLATE_IDS.has(template.id)) return template;

    return {
      ...template,
      focus_tags: appendUnique(template.focus_tags ?? [], ['core_control']),
      target_vector: appendUnique(template.target_vector ?? [], ['trunk_control']),
    };
  });
}

export function scoreTrunkCoreIntentFit(
  templateFocusTags: readonly string[],
  ruleKind: SessionSegmentKind
): number {
  const coreMainMatches = countMatches(templateFocusTags, TRUNK_CORE_MAIN_TAGS);
  const coreControlMatches = countMatches(templateFocusTags, TRUNK_CORE_CONTROL_TAGS);
  const supportMatches = countMatches(templateFocusTags, TRUNK_CORE_SUPPORT_TAGS);
  const upperDistractorMatches = countMatches(templateFocusTags, UPPER_DISTRACTOR_TAGS);

  if (ruleKind === 'main') {
    let score = 11;
    score += coreMainMatches * 4;
    score += coreControlMatches * 2;
    score += supportMatches;
    if (upperDistractorMatches > 0 && coreMainMatches === 0) score -= 6;
    return score;
  }
  if (ruleKind === 'accessory') return 5 + coreControlMatches * 2 + supportMatches;
  if (ruleKind === 'prep') return 5 + (templateFocusTags.includes('core_control') ? 2 : 0);
  return 2 + (templateFocusTags.includes('core_control') ? 2 : 0);
}

export function scoreTrunkCoreReplacementFit(
  templateFocusTags: readonly string[],
  sessionFocusAxes: readonly string[]
): number {
  if (!sessionFocusAxes.includes('trunk_control')) return 0;

  let score = 0;
  score += countMatches(templateFocusTags, TRUNK_CORE_MAIN_TAGS) * 6;
  score += (templateFocusTags.includes('core_control') ? 4 : 0);
  score += countMatches(templateFocusTags, TRUNK_CORE_SUPPORT_TAGS) * 3;
  score -= countMatches(templateFocusTags, UPPER_DISTRACTOR_TAGS) * 4;
  return score;
}
