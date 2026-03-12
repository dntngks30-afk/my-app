/**
 * PR-C: Adaptive Modifier Resolver
 * Loads session_adaptive_summaries and produces modifier for next session generation.
 * Deterministic, minimal. Does NOT modify session composer internals.
 */

export type AdaptiveModifier = {
  volume_modifier: number;
  complexity_cap: 'none' | 'basic';
  recovery_bias: boolean;
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
    .select('completion_ratio, skipped_exercises, dropout_risk_score, discomfort_burden_score, flags, avg_rpe, avg_discomfort, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = Array.isArray(data) && data.length > 0 ? (data[0] as { completion_ratio?: number; skipped_exercises?: number; dropout_risk_score?: number; discomfort_burden_score?: number; flags?: string[]; avg_rpe?: number | null; avg_discomfort?: number | null; created_at?: string }) : null;
  if (!row?.created_at) return null;
  if (row.created_at < cutoffIso) return null;

  return {
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
 */
export function resolveAdaptiveModifier(summary: {
  completion_ratio: number;
  skipped_exercises: number;
  dropout_risk_score: number;
  discomfort_burden_score?: number;
} | null): AdaptiveModifier {
  const neutral: AdaptiveModifier = {
    volume_modifier: 0,
    complexity_cap: 'none',
    recovery_bias: false,
  };
  if (!summary) return neutral;

  let volume_modifier = 0;
  if (summary.completion_ratio < 0.6) volume_modifier = -0.2;
  else if (summary.completion_ratio < 0.8) volume_modifier = -0.1;

  const complexity_cap = summary.skipped_exercises >= 2 ? 'basic' : 'none';
  const discomfortBurden = summary.discomfort_burden_score ?? 0;
  const recovery_bias = summary.dropout_risk_score >= 50 || discomfortBurden >= 60;

  return {
    volume_modifier,
    complexity_cap,
    recovery_bias,
  };
}
