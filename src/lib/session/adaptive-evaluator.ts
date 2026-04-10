/**
 * PR-B: Session Adaptive Evaluator v1
 * Rule-based evaluation from session_exercise_events.
 * Produces session_adaptive_summary for future PR-C adaptive generation.
 * PR-03: Observability trace for explainability.
 */

import { resolveAdaptiveModifier } from './adaptive-modifier-resolver';

export const EVALUATOR_TRACE_VERSION = '1.0';

export type AdaptiveEvaluatorTrace = {
  version: string;
  source_session_plan_id?: string;
  source_session_number?: number;
  input: {
    exercise_count?: number;
    completed_count?: number;
    skipped_count?: number;
    ratio_denom?: number;
    avg_rpe?: number | null;
    avg_discomfort?: number | null;
    completion_ratio?: number;
  };
  flags: {
    low_completion?: boolean;
    high_discomfort?: boolean;
    high_rpe?: boolean;
    skip_cluster?: boolean;
    recovery_bias?: boolean;
    complexity_cap_basic?: boolean;
    volume_reduction?: boolean;
    difficulty_adjustment?: -1 | 0 | 1;
    intensity_adjustment?: -1 | 0 | 1;
    caution_bias?: boolean;
  };
  decision: {
    reasons: string[];
    modifier: {
      volume_modifier: number;
      complexity_cap: string;
      recovery_bias: boolean;
      difficulty_adjustment?: -1 | 0 | 1;
      intensity_adjustment?: -1 | 0 | 1;
      caution_bias?: boolean;
    };
  };
};

export type AdaptiveSummaryRow = {
  user_id: string;
  session_plan_id: string;
  session_number: number;
  exercise_count: number;
  completed_exercises: number;
  skipped_exercises: number;
  avg_rpe: number | null;
  avg_discomfort: number | null;
  completion_ratio: number;
  effort_mismatch_score: number;
  discomfort_burden_score: number;
  dropout_risk_score: number;
  flags: string[];
  reasons: string[];
  /** PR-03: observability */
  ratio_denom: number;
  rpe_sample_count: number;
  discomfort_sample_count: number;
  summary_status: 'full' | 'partial';
};

export type AdaptiveSummaryDebug = {
  completion_ratio: number;
  dropout_risk_score: number;
  discomfort_burden_score: number;
  effort_mismatch_score: number;
  flags: string[];
  /** PR-03: observability */
  ratio_denom: number;
  rpe_sample_count: number;
  discomfort_sample_count: number;
  summary_status: 'full' | 'partial';
  /** PR-03: evaluator trace for explainability */
  evaluator_trace?: AdaptiveEvaluatorTrace;
};

type EventRow = {
  execution_granularity: string;
  data_quality: string;
  completed: boolean;
  skipped: boolean;
  actual_reps: number | null;
  prescribed_reps: number | null;
  rpe: number | null;
  discomfort: number | null;
};

/**
 * Load exercise-level events for a session plan.
 * PR-RISK-06: When grouping by item identity (replay/analytics), use resolveEventPlanItemKey
 * from exercise-log-identity to normalize legacy plan_item_key (seg{N}-item{M}, log{N}).
 */
export async function loadSessionEventsForEval(
  supabase: {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => PromiseLike<{ data: unknown[] | null }>;
      };
    };
  },
  sessionPlanId: string
): Promise<EventRow[]> {
  const { data } = await supabase
    .from('session_exercise_events')
    .select('execution_granularity, data_quality, completed, skipped, actual_reps, prescribed_reps, rpe, discomfort')
    .eq('session_plan_id', sessionPlanId);

  const rows = (data ?? []) as EventRow[];
  return rows.filter((r) => r.execution_granularity === 'exercise');
}

/**
 * Evaluate session from event rows. Deterministic, explainable.
 */
export function evaluateSession(
  events: EventRow[],
  ctx: { userId: string; sessionPlanId: string; sessionNumber: number }
): AdaptiveSummaryRow | null {
  if (events.length === 0) return null;

  const fullQuality = events.filter((e) => e.data_quality === 'full');
  const ratioDenom = fullQuality.length > 0 ? fullQuality.length : events.length;
  const completedForRatio = fullQuality.length > 0
    ? fullQuality.filter((e) => e.completed).length
    : events.filter((e) => e.completed).length;
  const completedExercises = events.filter((e) => e.completed).length;
  const skippedExercises = events.filter((e) => e.skipped).length;
  const completionRatio = ratioDenom > 0 ? completedForRatio / ratioDenom : 0;

  const rpeVals = events.map((e) => e.rpe).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const discomfortVals = events.map((e) => e.discomfort).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null;
  const avgDiscomfort = discomfortVals.length > 0 ? discomfortVals.reduce((a, b) => a + b, 0) / discomfortVals.length : null;

  let effortMismatch = 0;
  const effortReasons: string[] = [];
  if (completionRatio < 0.8) {
    effortMismatch += 30;
    effortReasons.push('completion ratio below 0.8');
  }
  if (completionRatio < 0.6) {
    effortMismatch += 50;
    effortReasons.push('completion ratio below 0.6');
  }
  effortMismatch = Math.min(100, effortMismatch);

  let discomfortBurden = 0;
  const discomfortReasons: string[] = [];
  if (avgDiscomfort != null) {
    if (avgDiscomfort >= 8) {
      discomfortBurden = 80;
      discomfortReasons.push('average discomfort above 8');
    } else if (avgDiscomfort >= 7) {
      discomfortBurden = 60;
      discomfortReasons.push('average discomfort above 7');
    } else if (avgDiscomfort >= 6) {
      discomfortBurden = 40;
      discomfortReasons.push('average discomfort above 6');
    }
  }

  let dropoutRisk = 0;
  const dropoutReasons: string[] = [];
  if (skippedExercises >= 2) {
    dropoutRisk += 30;
    dropoutReasons.push('multiple skipped exercises');
  }
  if (avgRpe != null && avgRpe >= 8) {
    dropoutRisk += 20;
    dropoutReasons.push('high average RPE');
  }
  if (discomfortBurden >= 60) {
    dropoutRisk += 20;
    dropoutReasons.push('high discomfort burden');
  }
  dropoutRisk = Math.min(100, Math.max(0, dropoutRisk));

  const flags: string[] = [];
  if (completionRatio < 0.8) flags.push('low_completion');
  if (avgDiscomfort != null && avgDiscomfort >= 6) flags.push('high_discomfort');
  if (avgRpe != null && avgRpe >= 8) flags.push('high_rpe');
  if (skippedExercises >= 2) flags.push('skip_cluster');

  const reasons = [...new Set([...effortReasons, ...discomfortReasons, ...dropoutReasons])];

  const rpeSampleCount = rpeVals.length;
  const discomfortSampleCount = discomfortVals.length;
  const summaryStatus: 'full' | 'partial' =
    rpeSampleCount > 0 && discomfortSampleCount > 0 ? 'full' : 'partial';

  return {
    user_id: ctx.userId,
    session_plan_id: ctx.sessionPlanId,
    session_number: ctx.sessionNumber,
    exercise_count: events.length,
    completed_exercises: completedExercises,
    skipped_exercises: skippedExercises,
    avg_rpe: avgRpe,
    avg_discomfort: avgDiscomfort,
    completion_ratio: Math.round(completionRatio * 1000) / 1000,
    effort_mismatch_score: effortMismatch,
    discomfort_burden_score: discomfortBurden,
    dropout_risk_score: dropoutRisk,
    flags,
    reasons,
    ratio_denom: ratioDenom,
    rpe_sample_count: rpeSampleCount,
    discomfort_sample_count: discomfortSampleCount,
    summary_status: summaryStatus,
  };
}

function buildEvaluatorTrace(
  summary: AdaptiveSummaryRow,
  ctx: { sessionPlanId: string; sessionNumber: number },
  modifier?: ReturnType<typeof resolveAdaptiveModifier>
): AdaptiveEvaluatorTrace {
  const _modifier = modifier ?? resolveAdaptiveModifier({
    completion_ratio: summary.completion_ratio,
    skipped_exercises: summary.skipped_exercises,
    dropout_risk_score: summary.dropout_risk_score,
    discomfort_burden_score: summary.discomfort_burden_score,
    avg_rpe: summary.avg_rpe,
    avg_discomfort: summary.avg_discomfort,
  });
  const flags = new Set(summary.flags);
  return {
    version: EVALUATOR_TRACE_VERSION,
    source_session_plan_id: ctx.sessionPlanId,
    source_session_number: ctx.sessionNumber,
    input: {
      exercise_count: summary.exercise_count,
      completed_count: summary.completed_exercises,
      skipped_count: summary.skipped_exercises,
      ratio_denom: summary.ratio_denom,
      avg_rpe: summary.avg_rpe,
      avg_discomfort: summary.avg_discomfort,
      completion_ratio: summary.completion_ratio,
    },
    flags: {
      low_completion: flags.has('low_completion'),
      high_discomfort: flags.has('high_discomfort'),
      high_rpe: flags.has('high_rpe'),
      skip_cluster: flags.has('skip_cluster'),
      recovery_bias: _modifier.recovery_bias,
      complexity_cap_basic: _modifier.complexity_cap === 'basic',
      volume_reduction: _modifier.volume_modifier < 0,
      difficulty_adjustment: _modifier.difficulty_adjustment,
      intensity_adjustment: _modifier.intensity_adjustment,
      caution_bias: _modifier.caution_bias,
    },
    decision: {
      reasons: summary.reasons,
      modifier: {
        volume_modifier: _modifier.volume_modifier,
        complexity_cap: _modifier.complexity_cap,
        recovery_bias: _modifier.recovery_bias,
        difficulty_adjustment: _modifier.difficulty_adjustment,
        intensity_adjustment: _modifier.intensity_adjustment,
        caution_bias: _modifier.caution_bias,
      },
    },
  };
}

/**
 * Run evaluator and upsert summary. Returns summary for debug.
 */
export async function runEvaluatorAndUpsert(
  supabase: {
    from: (t: string) => {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => PromiseLike<{ data: unknown[] | null }>;
      };
      upsert: (row: unknown[], opts?: object) => PromiseLike<{ error: unknown }>;
    };
  },
  ctx: { userId: string; sessionPlanId: string; sessionNumber: number }
): Promise<AdaptiveSummaryDebug | { summary_status: 'insufficient_data' } | null> {
  const events = await loadSessionEventsForEval(supabase, ctx.sessionPlanId);
  const summary = evaluateSession(events, ctx);
  if (!summary) return { summary_status: 'insufficient_data' };

  const modifier = resolveAdaptiveModifier({
    completion_ratio: summary.completion_ratio,
    skipped_exercises: summary.skipped_exercises,
    dropout_risk_score: summary.dropout_risk_score,
    discomfort_burden_score: summary.discomfort_burden_score,
    avg_rpe: summary.avg_rpe,
    avg_discomfort: summary.avg_discomfort,
  });

  const row = {
    user_id: summary.user_id,
    session_plan_id: summary.session_plan_id,
    session_number: summary.session_number,
    exercise_count: summary.exercise_count,
    completed_exercises: summary.completed_exercises,
    skipped_exercises: summary.skipped_exercises,
    avg_rpe: summary.avg_rpe,
    avg_discomfort: summary.avg_discomfort,
    completion_ratio: summary.completion_ratio,
    effort_mismatch_score: summary.effort_mismatch_score,
    discomfort_burden_score: summary.discomfort_burden_score,
    dropout_risk_score: summary.dropout_risk_score,
    flags: summary.flags,
    reasons: summary.reasons,
    ratio_denom: summary.ratio_denom,
    rpe_sample_count: summary.rpe_sample_count,
    discomfort_sample_count: summary.discomfort_sample_count,
    summary_status: summary.summary_status,
    difficulty_adjustment: modifier.difficulty_adjustment ?? null,
    intensity_adjustment: modifier.intensity_adjustment ?? null,
    caution_bias: modifier.caution_bias ?? null,
  };

  const { error } = await supabase.from('session_adaptive_summaries').upsert([row], {
    onConflict: 'session_plan_id',
  });
  if (error) {
    console.error('[adaptive-evaluator] upsert failed', error);
    return null;
  }

  const evaluator_trace = buildEvaluatorTrace(summary, {
    sessionPlanId: ctx.sessionPlanId,
    sessionNumber: ctx.sessionNumber,
  }, modifier);

  return {
    completion_ratio: summary.completion_ratio,
    dropout_risk_score: summary.dropout_risk_score,
    discomfort_burden_score: summary.discomfort_burden_score,
    effort_mismatch_score: summary.effort_mismatch_score,
    flags: summary.flags,
    ratio_denom: summary.ratio_denom,
    rpe_sample_count: summary.rpe_sample_count,
    discomfort_sample_count: summary.discomfort_sample_count,
    summary_status: summary.summary_status,
    evaluator_trace,
  };
}
