/**
 * PR-ALG-12: Adaptive Engine v1 — Rule-based Adaptive Rules
 *
 * Deterministic rules: execution signals → modifier decisions.
 */

import type { ExtractedSignals } from './signalExtractor';
import type { AdaptiveModifierOutput, VolumeModifier, DifficultyModifier } from './modifierTypes';

const LOW_COMPLETION = 0.6;
const HIGH_COMPLETION = 0.85;
const HIGH_RPE = 4;
const LOW_RPE = 2;

/**
 * Volume Down: completion_rate < 0.6 → volume_modifier = -1
 */
function ruleVolumeDown(signals: ExtractedSignals): VolumeModifier {
  if (signals.completion_rate < LOW_COMPLETION) return -1;
  return 0;
}

/**
 * Volume Up: completion_rate > 0.85 AND avg_rpe ≤ 2 (optional, conservative)
 */
function ruleVolumeUp(signals: ExtractedSignals): VolumeModifier {
  if (signals.completion_rate > HIGH_COMPLETION && (signals.avg_rpe == null || signals.avg_rpe <= LOW_RPE)) {
    return 1;
  }
  return 0;
}

/**
 * Difficulty Down: avg_rpe ≥ 4 → difficulty_modifier = -1
 */
function ruleDifficultyDown(signals: ExtractedSignals): DifficultyModifier {
  if (signals.avg_rpe != null && signals.avg_rpe >= HIGH_RPE) return -1;
  if (signals.difficulty_feedback === 'too_hard') return -1;
  return 0;
}

/**
 * Difficulty Up (Progression Up): completion_rate > 0.85 AND avg_rpe ≤ 2
 */
function ruleDifficultyUp(signals: ExtractedSignals): DifficultyModifier {
  if (signals.completion_rate > HIGH_COMPLETION && (signals.avg_rpe == null || signals.avg_rpe <= LOW_RPE)) {
    if (signals.difficulty_feedback !== 'too_hard') return 1;
  }
  return 0;
}

/**
 * Protection Mode: body_state_change == "worse" → protection_mode = true
 */
function ruleProtectionMode(signals: ExtractedSignals): boolean {
  return signals.body_state_change === 'worse';
}

/**
 * Discomfort Protection: discomfort_area != null → pass through for filtering
 */
function ruleDiscomfortArea(signals: ExtractedSignals): string | null {
  return signals.discomfort_area;
}

/**
 * Apply all rules. Precedence: protection > regression > progression.
 */
export function applyAdaptiveRules(signals: ExtractedSignals): AdaptiveModifierOutput {
  const protection_mode = ruleProtectionMode(signals);
  const discomfort_area = ruleDiscomfortArea(signals);

  let volume_modifier: VolumeModifier = 0;
  const volDown = ruleVolumeDown(signals);
  const volUp = ruleVolumeUp(signals);
  if (volDown === -1) volume_modifier = -1;
  else if (volUp === 1 && !protection_mode) volume_modifier = 1;

  let difficulty_modifier: DifficultyModifier = 0;
  const diffDown = ruleDifficultyDown(signals);
  const diffUp = ruleDifficultyUp(signals);
  if (diffDown === -1 || protection_mode) difficulty_modifier = -1;
  else if (diffUp === 1 && !protection_mode) difficulty_modifier = 1;

  return {
    volume_modifier,
    difficulty_modifier,
    protection_mode,
    discomfort_area,
  };
}
