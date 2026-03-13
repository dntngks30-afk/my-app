/**
 * PR-ALG-15: Modifier Interpreter
 *
 * Maps adaptive modifier output to template keys.
 * Read-only interpretation. Does not modify adaptive logic.
 */

import type { AdaptiveModifierOutput } from '@/core/adaptive-engine/modifierTypes';
import type { TemplateKey } from './explanationTemplates';

export type ExecutionSignals = {
  completion_rate?: number;
  avg_rpe?: number | null;
  difficulty_feedback?: 'too_easy' | 'ok' | 'too_hard' | null;
  body_state_change?: 'better' | 'same' | 'worse' | null;
  discomfort_area?: string | null;
};

/**
 * Interpret modifier and signals to determine which explanation template to use.
 * Priority: protection > discomfort > difficulty > volume.
 */
export function interpretModifier(
  modifier: AdaptiveModifierOutput,
  _signals?: ExecutionSignals
): TemplateKey | null {
  if (
    modifier.volume_modifier === 0 &&
    modifier.difficulty_modifier === 0 &&
    !modifier.protection_mode &&
    !modifier.discomfort_area
  ) {
    return 'neutral';
  }

  // Protection mode (body_state_change worse) takes precedence
  if (modifier.protection_mode) {
    return 'protection_mode';
  }

  // Discomfort area (specific body part) — filter/avoid applied
  if (modifier.discomfort_area && modifier.discomfort_area.trim()) {
    return 'discomfort_protection';
  }

  // Difficulty reduction (too hard, high RPE)
  if (modifier.difficulty_modifier === -1) {
    return 'difficulty_reduction';
  }

  // Progression (difficulty up)
  if (modifier.difficulty_modifier === 1) {
    return 'difficulty_progression';
  }

  // Volume reduction
  if (modifier.volume_modifier === -1) {
    return 'volume_reduction';
  }

  // Volume increase
  if (modifier.volume_modifier === 1) {
    return 'volume_increase';
  }

  return 'neutral';
}
