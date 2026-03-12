/**
 * PR-02: Centralized adaptive merge resolver.
 * Single source of truth for combining progression + summary modifier.
 * Safety-first precedence: pain/recovery/safety never weakened by progression.
 */

import type { AdaptiveModifiers } from './adaptive-progression';
import type { AdaptiveModifier } from './adaptive-modifier-resolver';
import {
  pickStricterDifficultyCap,
  mergeVolumeModifier,
  type DifficultyCap,
} from './adaptive-modifier-resolver';

export type ResolvedAdaptivePlanControls = {
  targetLevelDelta: -1 | 0 | 1;
  forceShort?: boolean;
  forceRecovery?: boolean;
  avoidTemplateIds: string[];
  maxDifficultyCap?: DifficultyCap;
  volumeModifier: number | undefined;
  reasons: string[];
  sources: {
    progression_reason?: string;
    summary_flags?: string[];
    summary_created_at?: string;
  };
  /** For plan-generator overlay compatibility. Undefined when no overlay needed. */
  overlay:
    | {
        targetLevelDelta: -1 | 0 | 1;
        forceShort?: boolean;
        forceRecovery?: boolean;
        avoidTemplateIds?: string[];
        maxDifficultyCap?: DifficultyCap;
      }
    | undefined;
};

type MergeInput = {
  progression: AdaptiveModifiers;
  modifier: AdaptiveModifier;
  summary?: {
    flags?: string[];
    created_at?: string;
  } | null;
};

/**
 * PRECEDENCE RULES (safety-first):
 * 1. recovery_bias true => forceRecovery true
 * 2. complexity_cap basic => maxDifficultyCap at most medium
 * 3. progression +1 + (recovery_bias OR complexity_cap basic) => targetLevelDelta 0 (neutralize aggression)
 * 4. targetLevelDelta clamped -1..+1
 * 5. avoidTemplateIds unioned, deduped, sorted
 * 6. volumeModifier from modifier (base undefined in current flow)
 */
export function resolveAdaptiveMerge(input: MergeInput): ResolvedAdaptivePlanControls {
  const { progression, modifier, summary } = input;

  const reasons: string[] = [];
  const sources = {
    progression_reason: progression.reason !== 'none' ? progression.reason : undefined,
    summary_flags: summary?.flags?.length ? summary.flags : undefined,
    summary_created_at: summary?.created_at,
  };

  // Volume: modifier-only (no base in current session/create flow)
  const volumeModifier = mergeVolumeModifier(undefined, modifier.volume_modifier);

  // forceRecovery: recovery must never be weakened
  const forceRecovery = modifier.recovery_bias || progression.forceRecovery || false;
  if (modifier.recovery_bias) reasons.push('summary_recovery_bias');

  // maxDifficultyCap: stricter wins
  const modifierCap: DifficultyCap | undefined =
    modifier.complexity_cap === 'basic' ? 'medium' : undefined;
  const maxDifficultyCap = pickStricterDifficultyCap(
    progression.maxDifficultyCap,
    modifierCap
  );
  if (modifier.complexity_cap === 'basic') reasons.push('summary_complexity_cap_basic');

  // targetLevelDelta: neutralize +1 when summary says be conservative
  const hasRecoverySignal = modifier.recovery_bias || modifier.complexity_cap === 'basic';
  let targetLevelDelta: -1 | 0 | 1 = progression.targetLevelDelta;

  if (targetLevelDelta === 1 && hasRecoverySignal) {
    targetLevelDelta = 0;
    reasons.push('progression_plus1_neutralized_by_summary');
  }

  targetLevelDelta = Math.max(-1, Math.min(1, targetLevelDelta)) as -1 | 0 | 1;

  // avoidTemplateIds: union, dedupe, sort
  const avoidSet = new Set<string>(progression.avoidExerciseKeys ?? []);
  const avoidTemplateIds = [...avoidSet].sort();

  // forceShort: from progression (summary doesn't override)
  const forceShort = progression.forceShort ?? false;

  const hasOverlay =
    targetLevelDelta !== 0 ||
    forceShort ||
    forceRecovery ||
    avoidTemplateIds.length > 0 ||
    !!maxDifficultyCap;

  const overlay = hasOverlay
    ? {
        targetLevelDelta,
        ...(forceShort && { forceShort: true }),
        ...(forceRecovery && { forceRecovery: true }),
        ...(avoidTemplateIds.length > 0 && { avoidTemplateIds }),
        ...(maxDifficultyCap && { maxDifficultyCap }),
      }
    : undefined;

  return {
    targetLevelDelta,
    forceShort: forceShort || undefined,
    forceRecovery: forceRecovery || undefined,
    avoidTemplateIds,
    maxDifficultyCap,
    volumeModifier,
    reasons,
    sources,
    overlay,
  };
}
