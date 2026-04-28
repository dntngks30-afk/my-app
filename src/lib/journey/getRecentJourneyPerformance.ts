/**
 * 최근 7일 완료 세션 및 session_feedback 기반 수행 지표.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { buildJourneyRecent7dSummary } from '@/lib/journey/journeySummaryText';
import {
  getCompletedAtUtcRange,
  getSevenDayInclusiveWindow,
} from '@/lib/journey/tz-window';
import {
  difficultyLabelFromAvg,
  painAfterToQualityFive,
  qualityLabelFromAggregate,
  rpe10ToDifficultyFive,
} from '@/lib/journey/journeyMetrics';
import type { JourneyRecent7dBlock } from '@/lib/journey/types';

function meanExerciseDifficulty(logs: unknown): number | null {
  if (!Array.isArray(logs)) return null;
  const vals: number[] = [];
  for (const raw of logs) {
    const o = raw as Record<string, unknown>;
    const d = o.difficulty;
    if (typeof d !== 'number' || !Number.isFinite(d)) continue;
    const v = Math.min(5, Math.max(1, d <= 5 ? d : Math.floor(d)));
    vals.push(v);
  }
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function difficultyScoreForPlan(params: {
  overallRpe: number | null;
  exerciseLogs: unknown;
}): number | null {
  if (params.overallRpe != null && Number.isFinite(params.overallRpe)) {
    const r = params.overallRpe;
    if (r >= 1 && r <= 10) return rpe10ToDifficultyFive(r);
    if (r >= 1 && r <= 5) return Math.min(5, Math.max(1, r));
    return null;
  }
  return meanExerciseDifficulty(params.exerciseLogs);
}

type FeedbackRow = {
  session_plan_id: string | null;
  session_number: number;
  overall_rpe: number | null;
  pain_after: number | null;
  body_state_change: string | null;
  discomfort_area: string | null;
  updated_at: string | null;
  created_at: string | null;
};

function pickLatestFeedback(rows: FeedbackRow[]): FeedbackRow | undefined {
  if (!rows.length) return undefined;
  const scored = [...rows];
  scored.sort((a, b) => {
    const ta =
      typeof a.updated_at === 'string'
        ? Date.parse(a.updated_at)
        : typeof a.created_at === 'string'
          ? Date.parse(a.created_at)
          : 0;
    const tb =
      typeof b.updated_at === 'string'
        ? Date.parse(b.updated_at)
        : typeof b.created_at === 'string'
          ? Date.parse(b.created_at)
          : 0;
    return tb - ta;
  });
  return scored[0];
}

function qualityPartsForFeedback(f: FeedbackRow | undefined): {
  score: number | null;
  hasPainWorse: boolean;
  usedForAvg: boolean;
} {
  if (!f) return { score: null, hasPainWorse: false, usedForAvg: false };

  const bodyWorse = f.body_state_change === 'worse';
  const sevPain =
    typeof f.pain_after === 'number' && Number.isFinite(f.pain_after) && f.pain_after >= 7;
  const hasPainWorse = bodyWorse || sevPain;

  if (typeof f.pain_after === 'number' && Number.isFinite(f.pain_after)) {
    return {
      score: painAfterToQualityFive(f.pain_after),
      hasPainWorse,
      usedForAvg: true,
    };
  }
  if (f.body_state_change === 'better')
    return { score: 4, hasPainWorse: false, usedForAvg: true };
  if (f.body_state_change === 'same')
    return { score: 3, hasPainWorse: false, usedForAvg: true };
  if (bodyWorse) return { score: null, hasPainWorse: true, usedForAvg: false };
  return { score: null, hasPainWorse: false, usedForAvg: false };
}

export async function getRecentJourneyPerformance(userId: string): Promise<JourneyRecent7dBlock> {
  const supabase = getServerSupabaseAdmin();

  let prefTz: string | null | undefined;
  try {
    const prefRes = await supabase
      .from('user_notification_preferences')
      .select('daily_workout_timezone')
      .eq('user_id', userId)
      .maybeSingle();
    const raw = prefRes.data as { daily_workout_timezone?: string | null } | null;
    if (raw?.daily_workout_timezone && typeof raw.daily_workout_timezone === 'string') {
      prefTz = raw.daily_workout_timezone.trim();
    }
  } catch {
    prefTz = undefined;
  }

  const { from, to, timeZone } = getSevenDayInclusiveWindow(new Date(), prefTz);
  const range = getCompletedAtUtcRange(from, to, timeZone);

  const tfRes = await supabase
    .from('session_user_profile')
    .select('target_frequency')
    .eq('user_id', userId)
    .maybeSingle();

  const rawTf =
    typeof (tfRes.data as { target_frequency?: unknown } | null)?.target_frequency === 'number'
      ? (tfRes.data as { target_frequency: number }).target_frequency
      : null;

  let target_frequency = 3;
  let target_frequency_source: 'onboarding' | 'default' = 'default';
  if (
    rawTf !== null &&
    Number.isFinite(rawTf) &&
    Number.isInteger(rawTf) &&
    rawTf >= 2 &&
    rawTf <= 5
  ) {
    target_frequency = rawTf;
    target_frequency_source = 'onboarding';
  }

  const plansRes = await supabase
    .from('session_plans')
    .select('id, session_number, completed_at, exercise_logs')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', range.startInclusiveUtcIso)
    .lt('completed_at', range.endExclusiveUtcIso);

  type PlanRow = {
    id: string;
    session_number: number;
    exercise_logs?: unknown;
  };

  const planRowsRaw = plansRes.data as PlanRow[] | null;

  const byPlanId = new Map<string, PlanRow>();
  if (planRowsRaw) {
    for (const row of planRowsRaw) {
      if (typeof row.id === 'string' && row.id.length > 0) byPlanId.set(row.id, row);
    }
  }

  const dedupPlans = [...byPlanId.values()];
  const completed_count = dedupPlans.length;
  const sessionNums = [...new Set(dedupPlans.map((p) => p.session_number))];

  const fbByPlan = new Map<string, FeedbackRow>();
  const fbRowsBySessionNumber = new Map<number, FeedbackRow[]>();

  if (sessionNums.length > 0) {
    const fbRes = await supabase
      .from('session_feedback')
      .select(
        'session_plan_id, session_number, overall_rpe, pain_after, body_state_change, discomfort_area, updated_at, created_at'
      )
      .eq('user_id', userId)
      .in('session_number', sessionNums);

    const fbList = ((fbRes.data ?? []) as FeedbackRow[]) ?? [];
    for (const fb of fbList) {
      const arr = fbRowsBySessionNumber.get(fb.session_number) ?? [];
      arr.push(fb);
      fbRowsBySessionNumber.set(fb.session_number, arr);
      if (typeof fb.session_plan_id === 'string') {
        fbByPlan.set(String(fb.session_plan_id), fb);
      }
    }
  }

  const difficultySamples: number[] = [];
  const qualityScoresForAvg: number[] = [];
  let hasPainWorseAny = false;

  for (const plan of dedupPlans) {
    const list = fbRowsBySessionNumber.get(plan.session_number) ?? [];
    const fromPlanId =
      typeof plan.id === 'string' ? fbByPlan.get(plan.id) ?? undefined : undefined;

    let fbChosen: FeedbackRow | undefined =
      typeof plan.id === 'string'
        ? list.find((f) => String(f.session_plan_id ?? '') === plan.id)
        : undefined;

    fbChosen =
      fbChosen ??
      fromPlanId ??
      pickLatestFeedback(list);

    const dScore = difficultyScoreForPlan({
      overallRpe: typeof fbChosen?.overall_rpe === 'number' ? fbChosen.overall_rpe : null,
      exerciseLogs: plan.exercise_logs,
    });
    if (dScore != null && Number.isFinite(dScore)) difficultySamples.push(dScore);

    const q = qualityPartsForFeedback(fbChosen);
    if (q.hasPainWorse) hasPainWorseAny = true;
    if (q.usedForAvg && q.score != null && Number.isFinite(q.score)) {
      qualityScoresForAvg.push(q.score);
    }
  }

  let diffAvg: number | null =
    difficultySamples.length > 0
      ? difficultySamples.reduce((s, x) => s + x, 0) / difficultySamples.length
      : null;

  let qualAvg: number | null =
    qualityScoresForAvg.length > 0
      ? qualityScoresForAvg.reduce((s, x) => s + x, 0) / qualityScoresForAvg.length
      : null;

  const difficultySourceCount = difficultySamples.length;
  const qualitySourceCount =
    completed_count === 0
      ? 0
      : qualityScoresForAvg.length > 0 || hasPainWorseAny
        ? qualityScoresForAvg.length
        : 0;

  const difficultyLabel = difficultyLabelFromAvg(diffAvg, difficultySourceCount);

  const qualityLabelResult = qualityLabelFromAggregate({
    hasPainWorse: hasPainWorseAny,
    avgScore: qualAvg,
    sourceCount: qualityScoresForAvg.length,
  });

  const recent: JourneyRecent7dBlock = {
    window: { from, to },
    target_frequency,
    target_frequency_source,
    completed_count,
    completion_label: `${completed_count}/${target_frequency}회`,
    difficulty: {
      label: difficultyLabel,
      source_count: difficultySourceCount,
      avg_score: diffAvg,
    },
    quality: {
      label: qualityLabelResult,
      source_count: qualityScoresForAvg.length,
      avg_score: qualAvg,
    },
    summary: '',
  };

  recent.summary = buildJourneyRecent7dSummary({
    completed_count,
    target_frequency,
    difficultyLabel: recent.difficulty.label,
    qualityLabel: recent.quality.label,
  });

  return recent;
}
