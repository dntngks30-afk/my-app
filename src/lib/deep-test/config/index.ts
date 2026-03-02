/**
 * Deep v2 config loader
 * JSON 실패 시 fallback
 */

import weightsJson from './weights.json';
import patternsJson from './patterns.json';
import tagMapJson from './tag_map.json';

export type AxisKey = 'N' | 'L' | 'U' | 'Lo' | 'D';

const DEFAULT_PAIN_INTENSITY: Record<string, number> = {
  없음: 0,
  약간: 1,
  '약간(0~3)': 1,
  중간: 2,
  '중간(4~6)': 2,
  강함: 3,
  '강함(7~10)': 3,
};

const DEFAULT_FOCUS_TO_TAGS: Record<string, string[]> = {
  'NECK-SHOULDER': ['upper_trap_release', 'neck_mobility', 'thoracic_mobility'],
  'LUMBO-PELVIS': ['hip_mobility', 'glute_activation', 'core_control'],
  'UPPER-LIMB': ['shoulder_mobility', 'shoulder_stability'],
  'LOWER-LIMB': ['lower_chain_stability', 'glute_medius', 'ankle_mobility'],
  FULL: ['core_control', 'full_body_reset'],
};

const DEFAULT_AXIS_TO_AVOID: Record<string, string[]> = {
  N: ['shoulder_overhead'],
  L: ['lower_back_pain'],
  U: ['wrist_load'],
  Lo: ['knee_load', 'knee_ground_pain'],
  D: [],
};

export function getPainIntensityMap(): Record<string, number> {
  try {
    const w = weightsJson as { pain_intensity?: Record<string, number> };
    if (w?.pain_intensity && typeof w.pain_intensity === 'object') {
      return { ...DEFAULT_PAIN_INTENSITY, ...w.pain_intensity };
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_PAIN_INTENSITY;
}

export function getFocusToTags(): Record<string, string[]> {
  try {
    const t = tagMapJson as { focus_to_tags?: Record<string, string[]> };
    if (t?.focus_to_tags && typeof t.focus_to_tags === 'object') {
      return { ...DEFAULT_FOCUS_TO_TAGS, ...t.focus_to_tags };
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_FOCUS_TO_TAGS;
}

export function getAxisToAvoid(): Record<string, string[]> {
  try {
    const t = tagMapJson as { axis_to_avoid?: Record<string, string[]> };
    if (t?.axis_to_avoid && typeof t.axis_to_avoid === 'object') {
      return { ...DEFAULT_AXIS_TO_AVOID, ...t.axis_to_avoid };
    }
  } catch {
    /* fallback */
  }
  return DEFAULT_AXIS_TO_AVOID;
}
