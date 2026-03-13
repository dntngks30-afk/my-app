/**
 * PR-ALG-15: Adaptive Explanation Generator
 *
 * Converts adaptive modifier into human-readable explanation.
 * Purely descriptive. Does not modify adaptive logic.
 */

import type { AdaptiveModifierOutput } from '@/core/adaptive-engine/modifierTypes';
import type { ExecutionSignals } from './modifierInterpreter';
import { interpretModifier } from './modifierInterpreter';
import { EXPLANATION_TEMPLATES } from './explanationTemplates';

export type AdaptiveExplanation = {
  title: string;
  message: string;
};

/**
 * Generate user-facing explanation from modifier and optional signals.
 * Returns null when modifier is neutral (no adjustment).
 */
export function generateAdaptiveExplanation(
  modifier: AdaptiveModifierOutput,
  signals?: ExecutionSignals
): AdaptiveExplanation | null {
  const templateKey = interpretModifier(modifier, signals);

  if (templateKey === 'neutral' || !templateKey) {
    return null;
  }

  const template = EXPLANATION_TEMPLATES[templateKey];
  if (!template) {
    return null;
  }

  return {
    title: template.title,
    message: template.message.replace(/\n/g, ' ').trim(),
  };
}
