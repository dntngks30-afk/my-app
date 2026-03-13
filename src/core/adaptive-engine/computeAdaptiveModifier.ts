/**
 * PR-ALG-12: Adaptive Engine v1 — Compute Adaptive Modifier
 *
 * Orchestrates signal extraction + rules → modifier output.
 * Pure logic layer. No DB access; receives pre-loaded data.
 */

import { extractSignals } from './signalExtractor';
import type { RawSessionFeedback, RawAdaptiveSummary } from './signalExtractor';
import { applyAdaptiveRules } from './adaptiveRules';
import type { AdaptiveModifierOutput } from './modifierTypes';

export interface AdaptiveEngineInput {
  sessionFeedback: RawSessionFeedback[];
  adaptiveSummary: RawAdaptiveSummary | null;
}

/**
 * Compute adaptive modifier from execution signals.
 * Rule-based, deterministic. No ML.
 */
export function computeAdaptiveModifier(input: AdaptiveEngineInput): AdaptiveModifierOutput {
  const signals = extractSignals(input.sessionFeedback, input.adaptiveSummary);
  return applyAdaptiveRules(signals);
}
