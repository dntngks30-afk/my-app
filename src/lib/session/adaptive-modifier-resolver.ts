/**
 * PR-C: Adaptive Modifier Resolver
 * Loads session_adaptive_summaries and produces modifier for next session generation.
 * Deterministic, minimal. Does NOT modify session composer internals.
 * PR-01: Safety-first merge helpers for overlay + modifier combination.
 */

/** Difficulty cap strictness: low = strictest, high = loosest */
export type DifficultyCap = 'low' | 'medium' | 'high';

const CAP_STRICTNESS: Record<DifficultyCap, number> = { low: 1, medium: 2, high: 3 };

/**
 * Returns the stricter of two difficulty caps. Does not mutate inputs.
 * low < medium < high in strictness.
 */
export function pickStricterDifficultyCap(
  a: DifficultyCap | undefined | null,
  b: DifficultyCap | undefined | null
): DifficultyCap | undefined {
  if (!a && !b) return undefined;
  if (!a) return b ?? undefined;
  if (!b) return a;
  return CAP_STRICTNESS[a] <= CAP_STRICTNESS[b] ? a : b;
}

/**
 * Merges volume modifiers. Larger reduction wins. Does not mutate inputs.
 * undefined + -0.2 => -0.2; -0.1 + -0.2 => -0.2; -0.2 + 0 => -0.2;
 * undefined + 0 => undefined (neutral modifier = no volume change).
 */
export function mergeVolumeModifier(
  base: number | undefined | null,
  next: number | undefined | null
): number | undefined {
  if (next === undefined || next === null) return base ?? undefined;
  if (next === 0) return base ?? undefined;
  if (base === undefined || base === null) return next;
  return Math.min(base, next);
}

/** Overlay shape consumed by plan-generator */
export type AdaptiveOverlayShape = {
  targetLevelDelta?: -1 | 0 | 1;
  forceShort?: boolean;
  forceRecovery?: boolean;
  avoidTemplateIds?: string[];
  maxDifficultyCap?: DifficultyCap;
};

/**
 * Merges modifier into base overlay with safety-first semantics.
 * - Neutral modifier is no-op.
 * - forceRecovery true overrides false.
 * - Stricter difficulty cap wins (existing cap must NOT be weakened).
 * - Does not mutate input objects.
 */
export function mergeAdaptiveOverlayWithModifier(
  baseOverlay: AdaptiveOverlayShape | undefined | null,
  modifier: AdaptiveModifier
): AdaptiveOverlayShape | undefined {
  const diffAdj = modifier.difficulty_adjustment ?? 0;
  const intAdj = modifier.intensity_adjustment ?? 0;
  const caution = modifier.caution_bias ?? false;
  const isNeutral =
    modifier.volume_modifier === 0 &&
    modifier.complexity_cap === 'none' &&
    !modifier.recovery_bias &&
    diffAdj === 0 &&
    intAdj === 0 &&
    !caution;
  if (isNeutral) return baseOverlay ?? undefined;

  const modifierCap: DifficultyCap | undefined =
    modifier.complexity_cap === 'basic' ? 'medium' : undefined;

  const mergedCap = pickStricterDifficultyCap(
    baseOverlay?.maxDifficultyCap,
    modifierCap
  );

  const forceRecovery = modifier.recovery_bias || baseOverlay?.forceRecovery;

  const result: AdaptiveOverlayShape = {
    ...(baseOverlay ?? {}),
    ...(forceRecovery && { forceRecovery: true }),
    ...(mergedCap && { maxDifficultyCap: mergedCap }),
  };

  return Object.keys(result).length > 0 ? result : undefined;
}

export type AdaptiveModifier = {
  volume_modifier: number;
  complexity_cap: 'none' | 'basic';
  recovery_bias: boolean;
  /** PR-SESSION-ADAPTIVE-01: completion-based difficulty adjustment */
  difficulty_adjustment?: -1 | 0 | 1;
  /** PR-SESSION-ADAPTIVE-01: RPE-based intensity adjustment */
  intensity_adjustment?: -1 | 0 | 1;
  /** PR-SESSION-ADAPTIVE-01: discomfort present → caution */
  caution_bias?: boolean;
};

const SUMMARY_MAX_AGE_DAYS = 30;

/**
 * Load latest session_adaptive_summary for user. Ignore older than 30 days.
 */
export async function loadLatestAdaptiveSummary(
  supabase: {
    from: (t: string) => {
      select: (cols: string) => { eq: (col: string, val: unknown) => { order: (col: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } } };
    };
  },
  userId: string
): Promise<{
  id?: string;
  completion_ratio: number;
  skipped_exercises: number;
  dropout_risk_score: number;
  discomfort_burden_score: number;
  flags: string[];
  avg_rpe: number | null;
  avg_discomfort: number | null;
  created_at: string;
} | null> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUMMARY_MAX_AGE_DAYS);
  const cutoffIso = cutoff.toISOString();

  const { data } = await supabase
    .from('session_adaptive_summaries')
    .select('id, completion_ratio, skipped_exercises, dropout_risk_score, discomfort_burden_score, flags, avg_rpe, avg_discomfort, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = Array.isArray(data) && data.length > 0 ? (data[0] as { id?: string; completion_ratio?: number; skipped_exercises?: number; dropout_risk_score?: number; discomfort_burden_score?: number; flags?: string[]; avg_rpe?: number | null; avg_discomfort?: number | null; created_at?: string }) : null;
  if (!row?.created_at) return null;
  if (row.created_at < cutoffIso) return null;

  return {
    id: row.id,
    completion_ratio: row.completion_ratio ?? 0,
    skipped_exercises: row.skipped_exercises ?? 0,
    dropout_risk_score: row.dropout_risk_score ?? 0,
    discomfort_burden_score: row.discomfort_burden_score ?? 0,
    flags: Array.isArray(row.flags) ? row.flags : [],
    avg_rpe: row.avg_rpe ?? null,
    avg_discomfort: row.avg_discomfort ?? null,
    created_at: row.created_at,
  };
}

/**
 * Resolve modifier from summary. No summary → neutral modifier.
 * recovery_bias: dropout_risk >= 50 OR discomfort_burden >= 60 (event-level discomfort alone can trigger recovery).
 * PR-SESSION-ADAPTIVE-01: difficulty_adjustment from completion, intensity_adjustment from RPE, caution_bias from discomfort.
 */
export function resolveAdaptiveModifier(summary: {
  completion_ratio: number;
  skipped_exercises: number;
  dropout_risk_score: number;
  discomfort_burden_score?: number;
  avg_rpe?: number | null;
  avg_discomfort?: number | null;
} | null): AdaptiveModifier {
  const neutral: AdaptiveModifier = {
    volume_modifier: 0,
    complexity_cap: 'none',
    recovery_bias: false,
    difficulty_adjustment: 0,
    intensity_adjustment: 0,
    caution_bias: false,
  };
  if (!summary) return neutral;

  let volume_modifier = 0;
  if (summary.completion_ratio < 0.6) volume_modifier = -0.2;
  else if (summary.completion_ratio < 0.8) volume_modifier = -0.1;

  const complexity_cap = summary.skipped_exercises >= 2 ? 'basic' : 'none';
  const discomfortBurden = summary.discomfort_burden_score ?? 0;
  const recovery_bias = summary.dropout_risk_score >= 50 || discomfortBurden >= 60;

  // PR-SESSION-ADAPTIVE-01: completion_rate < 60% → difficulty_down, >= 90% → difficulty_up
  let difficulty_adjustment: -1 | 0 | 1 = 0;
  if (summary.completion_ratio < 0.6) difficulty_adjustment = -1;
  else if (summary.completion_ratio >= 0.9) difficulty_adjustment = 1;

  // PR-SESSION-ADAPTIVE-01: RPE >= 8 → intensity_down, RPE <= 4 → intensity_up
  let intensity_adjustment: -1 | 0 | 1 = 0;
  const avgRpe = summary.avg_rpe ?? null;
  if (avgRpe != null) {
    if (avgRpe >= 8) intensity_adjustment = -1;
    else if (avgRpe <= 4) intensity_adjustment = 1;
  }
  if (intensity_adjustment === -1 && volume_modifier === 0) volume_modifier = -0.15;

  // PR-SESSION-ADAPTIVE-01: discomfort present → caution_bias
  const avgDiscomfort = summary.avg_discomfort ?? null;
  const caution_bias = avgDiscomfort != null && avgDiscomfort >= 6;

  return {
    volume_modifier,
    complexity_cap,
    recovery_bias,
    difficulty_adjustment,
    intensity_adjustment,
    caution_bias,
  };
}
