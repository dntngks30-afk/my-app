/**
 * PR-PREP-COOLDOWN-AXIS-ALIGN-01: Prep/Cooldown axis preference (scoring + audit only).
 * No exclusions; positive-only fit scores.
 */

import type { SessionTemplateRow } from '@/lib/workout-routine/exercise-templates-db';

/** Final plan segment shape (post-order) — avoid importing plan-generator (cycle). */
type PlanItemLike = { templateId: string };
type PlanSegmentLike = { title: string; items: PlanItemLike[] };

const GOLD_PATH_VECTOR_KEYS = [
  'lower_stability',
  'lower_mobility',
  'upper_mobility',
  'trunk_control',
  'deconditioned',
  'balanced_reset',
] as const;

type GoldPathVectorKey = (typeof GOLD_PATH_VECTOR_KEYS)[number];

export type PrepCooldownSegmentKind = 'prep' | 'cooldown';

export type PrepCooldownAxisProfile = {
  prepPreferredTags: readonly string[];
  prepFallbackTags: readonly string[];
  cooldownPreferredTags: readonly string[];
  cooldownFallbackTags: readonly string[];
  neutralResetTags: readonly string[];
};

const PROFILES: Record<GoldPathVectorKey, PrepCooldownAxisProfile> = {
  lower_stability: {
    prepPreferredTags: ['hip_mobility', 'core_control', 'glute_activation', 'basic_balance'],
    prepFallbackTags: ['full_body_reset', 'ankle_mobility'],
    cooldownPreferredTags: ['full_body_reset', 'hip_flexor_stretch', 'calf_release'],
    cooldownFallbackTags: ['hip_mobility', 'ankle_mobility', 'core_control'],
    neutralResetTags: ['full_body_reset', 'core_control'],
  },
  lower_mobility: {
    prepPreferredTags: ['hip_mobility', 'ankle_mobility', 'hip_flexor_stretch'],
    prepFallbackTags: ['calf_release', 'core_control'],
    cooldownPreferredTags: ['hip_flexor_stretch', 'calf_release', 'ankle_mobility'],
    cooldownFallbackTags: ['hip_mobility', 'full_body_reset'],
    neutralResetTags: ['full_body_reset', 'core_control'],
  },
  upper_mobility: {
    prepPreferredTags: ['thoracic_mobility', 'shoulder_mobility', 'neck_mobility'],
    prepFallbackTags: ['upper_trap_release', 'core_control'],
    cooldownPreferredTags: ['thoracic_mobility', 'shoulder_mobility', 'upper_trap_release'],
    cooldownFallbackTags: ['neck_mobility', 'full_body_reset'],
    neutralResetTags: ['full_body_reset', 'core_control'],
  },
  trunk_control: {
    prepPreferredTags: ['core_control', 'full_body_reset', 'thoracic_mobility'],
    prepFallbackTags: ['hip_mobility', 'neck_mobility'],
    cooldownPreferredTags: ['full_body_reset', 'core_control', 'hip_flexor_stretch'],
    cooldownFallbackTags: ['thoracic_mobility', 'calf_release'],
    neutralResetTags: ['full_body_reset', 'core_control'],
  },
  deconditioned: {
    prepPreferredTags: ['full_body_reset', 'core_control'],
    prepFallbackTags: ['thoracic_mobility', 'hip_mobility'],
    cooldownPreferredTags: ['full_body_reset', 'calf_release', 'thoracic_mobility'],
    cooldownFallbackTags: ['shoulder_mobility', 'hip_flexor_stretch'],
    neutralResetTags: ['full_body_reset', 'core_control', 'calf_release'],
  },
  balanced_reset: {
    prepPreferredTags: ['full_body_reset', 'core_control', 'thoracic_mobility'],
    prepFallbackTags: ['shoulder_mobility', 'hip_mobility'],
    cooldownPreferredTags: ['full_body_reset', 'thoracic_mobility', 'shoulder_mobility'],
    cooldownFallbackTags: ['calf_release', 'hip_flexor_stretch'],
    neutralResetTags: ['full_body_reset', 'core_control'],
  },
};

const VECTOR_MATCH = 6;
const PREFERRED_PER_TAG = 5;
const PREFERRED_MAX = 10;
const FALLBACK_PER_TAG = 3;
const FALLBACK_MAX = 9;
const NEUTRAL_PER_TAG = 2;
const NEUTRAL_MAX = 4;

function isGoldPathVectorKey(s: string): s is GoldPathVectorKey {
  return (GOLD_PATH_VECTOR_KEYS as readonly string[]).includes(s);
}

export function getPrepCooldownAxisProfile(
  goldPathVector: string | null | undefined
): PrepCooldownAxisProfile | null {
  if (goldPathVector == null || goldPathVector === '') return null;
  return isGoldPathVectorKey(goldPathVector) ? PROFILES[goldPathVector] : null;
}

function segmentLists(
  profile: PrepCooldownAxisProfile,
  segmentKind: PrepCooldownSegmentKind
): { preferred: readonly string[]; fallback: readonly string[]; neutral: readonly string[] } {
  if (segmentKind === 'prep') {
    return {
      preferred: profile.prepPreferredTags,
      fallback: profile.prepFallbackTags,
      neutral: profile.neutralResetTags,
    };
  }
  return {
    preferred: profile.cooldownPreferredTags,
    fallback: profile.cooldownFallbackTags,
    neutral: profile.neutralResetTags,
  };
}

/**
 * Positive-only. Caps: vector +6; preferred 5 ea / max 10; fallback 3 ea / max 9; neutral 2 ea / max 4.
 */
export function scorePrepCooldownAxisFit(input: {
  goldPathVector: string | null | undefined;
  segmentKind: PrepCooldownSegmentKind;
  focusTags: readonly string[];
  targetVector?: readonly string[] | null;
}): number {
  const profile = getPrepCooldownAxisProfile(input.goldPathVector);
  if (!profile) return 0;

  const gpv = String(input.goldPathVector ?? '').trim();
  let score = 0;

  if (gpv && (input.targetVector?.some((v) => v === gpv) ?? false)) {
    score += VECTOR_MATCH;
  }

  const { preferred, fallback, neutral } = segmentLists(profile, input.segmentKind);
  const prefSet = new Set(preferred);
  const fbSet = new Set(fallback);
  const neuSet = new Set(neutral);

  let prefN = 0;
  let fbN = 0;
  let neuN = 0;
  const seen = new Set<string>();
  for (const tag of input.focusTags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    if (prefSet.has(tag)) prefN++;
    else if (fbSet.has(tag)) fbN++;
    else if (neuSet.has(tag)) neuN++;
  }

  score += Math.min(PREFERRED_MAX, prefN * PREFERRED_PER_TAG);
  score += Math.min(FALLBACK_MAX, fbN * FALLBACK_PER_TAG);
  score += Math.min(NEUTRAL_MAX, neuN * NEUTRAL_PER_TAG);

  return score;
}

export function classifyPrepCooldownAxisFit(input: {
  goldPathVector: string | null | undefined;
  segmentKind: PrepCooldownSegmentKind;
  focusTags: readonly string[];
  targetVector?: readonly string[] | null;
}): 'axis_match' | 'neutral_accepted' | 'off_axis' | 'unknown' {
  const profile = getPrepCooldownAxisProfile(input.goldPathVector);
  if (!profile) return 'unknown';

  const gpv = String(input.goldPathVector ?? '').trim();
  if (gpv && (input.targetVector?.some((v) => v === gpv) ?? false)) {
    return 'axis_match';
  }

  const { preferred, fallback, neutral } = segmentLists(profile, input.segmentKind);
  const hasPref = input.focusTags.some((t) => preferred.includes(t));
  const hasFb = input.focusTags.some((t) => fallback.includes(t));
  if (hasPref || hasFb) {
    return 'axis_match';
  }
  if (input.focusTags.some((t) => neutral.includes(t))) {
    return 'neutral_accepted';
  }
  if (input.focusTags.length === 0) {
    return 'off_axis';
  }
  return 'off_axis';
}

export type PrepCooldownAlignmentMetaV1 = {
  version: 'prep_cooldown_alignment_v1';
  gold_path_vector: string | null;
  prep_axis_match: boolean | null;
  cooldown_axis_match: boolean | null;
  off_axis_items: string[];
  neutral_accepted_items: string[];
};

/**
 * After ordering/reconcile: classify Prep/Cooldown items only. Template rows must be resolved from templatesById.
 */
export function buildPrepCooldownAlignmentMeta(
  segments: PlanSegmentLike[],
  templatesById: Map<string, SessionTemplateRow | undefined>,
  goldPathVector: string | null
): PrepCooldownAlignmentMetaV1 {
  if (goldPathVector == null) {
    return {
      version: 'prep_cooldown_alignment_v1',
      gold_path_vector: null,
      prep_axis_match: null,
      cooldown_axis_match: null,
      off_axis_items: [],
      neutral_accepted_items: [],
    };
  }

  const off: string[] = [];
  const neutralItems: string[] = [];
  const prepOff: string[] = [];
  const coolOff: string[] = [];

  function collect(segmentTitle: 'Prep' | 'Cooldown', items: PlanItemLike[], intoOff: string[]) {
    for (const item of items) {
      const row = templatesById.get(item.templateId);
      const c = classifyPrepCooldownAxisFit({
        goldPathVector,
        segmentKind: segmentTitle === 'Prep' ? 'prep' : 'cooldown',
        focusTags: row?.focus_tags ?? [],
        targetVector: row?.target_vector,
      });
      if (c === 'off_axis') {
        off.push(item.templateId);
        intoOff.push(item.templateId);
      } else if (c === 'neutral_accepted') {
        neutralItems.push(item.templateId);
      }
    }
  }

  const prep = segments.find((s) => s.title === 'Prep');
  const cool = segments.find((s) => s.title === 'Cooldown');
  if (prep?.items.length) {
    collect('Prep', prep.items, prepOff);
  }
  if (cool?.items.length) {
    collect('Cooldown', cool.items, coolOff);
  }

  const prepHasItems = (prep?.items.length ?? 0) > 0;
  const coolHasItems = (cool?.items.length ?? 0) > 0;

  return {
    version: 'prep_cooldown_alignment_v1',
    gold_path_vector: goldPathVector,
    prep_axis_match: prepHasItems ? prepOff.length === 0 : null,
    cooldown_axis_match: coolHasItems ? coolOff.length === 0 : null,
    off_axis_items: [...new Set(off)],
    neutral_accepted_items: [...new Set(neutralItems)],
  };
}
