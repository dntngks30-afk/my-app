/**
 * PR-P2-2: 4-session progress report foundation
 * Read-only. Snapshot + feedback 기반 요약. 진단/치료 표현 금지.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import type { DeepSummarySnapshot } from './session-snapshot';

// ─── Constants ─────────────────────────────────────────────────────────────

export const WINDOW_SIZE = 4;
const MIN_SESSIONS_FOR_TREND = 2;
const PAIN_IMPROVE_DELTA = -0.5;
const PAIN_WORSEN_DELTA = 0.5;
const RPE_STEADY_BAND = 0.75;
const COMPLETION_GOOD = 0.8;
const COMPLETION_POOR = 0.5;

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrendAdherence = 'up' | 'steady' | 'down' | 'unknown';
export type TrendExertion = 'up' | 'steady' | 'down' | 'unknown';
export type TrendPain = 'improving' | 'steady' | 'worsening' | 'unknown';
export type TrendTolerance = 'improving' | 'steady' | 'worsening' | 'unknown';

export type ProgressWindowReport = {
  window_size: 4;
  available_sessions: number;
  sufficient_data: boolean;
  baseline: {
    result_type?: string | null;
    primary_focus?: string | null;
    secondary_focus?: string | null;
    effective_confidence?: number | null;
    safety_mode?: 'none' | 'yellow' | 'red' | null;
    scoring_version?: string | null;
  };
  current: {
    completed_sessions_in_window: number;
    completion_rate?: number | null;
    avg_rpe?: number | null;
    avg_pain_after?: number | null;
    avg_completion_ratio?: number | null;
    difficulty_mix?: {
      too_easy: number;
      ok: number;
      too_hard: number;
    };
    top_problem_exercises?: Array<{
      exercise_key: string;
      pain_delta_avg?: number | null;
      skip_count?: number;
      replace_count?: number;
    }>;
  };
  trends: {
    adherence: TrendAdherence;
    exertion: TrendExertion;
    pain_burden: TrendPain;
    session_tolerance: TrendTolerance;
  };
  summary: {
    headline: string;
    bullets: string[];
    caution?: string | null;
  };
};

type SessionPlanRow = {
  session_number: number;
  theme?: string | null;
  deep_summary_snapshot_json?: unknown;
};

type SessionFeedbackRow = {
  session_number: number;
  overall_rpe?: number | null;
  pain_after?: number | null;
  difficulty_feedback?: string | null;
  completion_ratio?: number | null;
};

type ExerciseFeedbackRow = {
  session_number: number;
  exercise_key: string;
  pain_delta?: number | null;
  was_replaced?: boolean | null;
  skipped?: boolean | null;
};

// ─── Baseline ──────────────────────────────────────────────────────────────

/**
 * Load baseline from session 1's deep_summary_snapshot_json.
 * Fallback: empty baseline (null-safe).
 */
export async function loadBaselineSummary(userId: string): Promise<{
  result_type?: string | null;
  primary_focus?: string | null;
  secondary_focus?: string | null;
  effective_confidence?: number | null;
  safety_mode?: 'none' | 'yellow' | 'red' | null;
  scoring_version?: string | null;
}> {
  const supabase = getServerSupabaseAdmin();
  const { data } = await supabase
    .from('session_plans')
    .select('deep_summary_snapshot_json')
    .eq('user_id', userId)
    .eq('session_number', 1)
    .maybeSingle();

  const snap = data?.deep_summary_snapshot_json;
  if (!snap || typeof snap !== 'object') {
    return {};
  }
  const s = snap as DeepSummarySnapshot;
  return {
    result_type: s.result_type ?? null,
    primary_focus: s.primary_focus ?? null,
    secondary_focus: s.secondary_focus ?? null,
    effective_confidence: s.effective_confidence ?? null,
    safety_mode: s.safety_mode ?? null,
    scoring_version: s.scoring_version ?? null,
  };
}

// ─── Window data ──────────────────────────────────────────────────────────

export async function loadRecentSessionWindow(
  userId: string,
  windowSize = WINDOW_SIZE
): Promise<{
  plans: SessionPlanRow[];
  feedback: SessionFeedbackRow[];
  exerciseFeedback: ExerciseFeedbackRow[];
}> {
  const supabase = getServerSupabaseAdmin();

  const [plansRes, feedbackRes, exRes] = await Promise.all([
    supabase
      .from('session_plans')
      .select('session_number, theme, deep_summary_snapshot_json')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('session_number', { ascending: false })
      .limit(windowSize),
    supabase
      .from('session_feedback')
      .select('session_number, overall_rpe, pain_after, difficulty_feedback, completion_ratio')
      .eq('user_id', userId)
      .order('session_number', { ascending: false })
      .limit(windowSize * 2),
    supabase
      .from('exercise_feedback')
      .select('session_number, exercise_key, pain_delta, was_replaced, skipped')
      .eq('user_id', userId)
      .order('session_number', { ascending: false })
      .limit(windowSize * 30),
  ]);

  const plans = (plansRes.data ?? []) as SessionPlanRow[];
  const feedback = (feedbackRes.data ?? []) as SessionFeedbackRow[];
  const exerciseFeedback = (exRes.data ?? []) as ExerciseFeedbackRow[];

  const sessionNumbers = new Set(plans.map((p) => p.session_number));
  const feedbackFiltered = feedback.filter((f) => sessionNumbers.has(f.session_number));
  const exFiltered = exerciseFeedback.filter((e) => sessionNumbers.has(e.session_number));

  return { plans, feedback: feedbackFiltered, exerciseFeedback: exFiltered };
}

// ─── Aggregation ────────────────────────────────────────────────────────────

function aggregateSessionFeedback(
  feedback: SessionFeedbackRow[],
  sessionNumbers: number[]
): {
  avgRpe: number | null;
  avgPainAfter: number | null;
  avgCompletionRatio: number | null;
  difficultyMix: { too_easy: number; ok: number; too_hard: number };
} {
  const inWindow = feedback.filter((f) => sessionNumbers.includes(f.session_number));
  const rpes = inWindow.map((f) => f.overall_rpe).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const pains = inWindow.map((f) => f.pain_after).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const ratios = inWindow.map((f) => f.completion_ratio).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const mix = { too_easy: 0, ok: 0, too_hard: 0 };
  for (const f of inWindow) {
    if (f.difficulty_feedback === 'too_easy') mix.too_easy++;
    else if (f.difficulty_feedback === 'ok') mix.ok++;
    else if (f.difficulty_feedback === 'too_hard') mix.too_hard++;
  }

  return {
    avgRpe: rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
    avgPainAfter: pains.length > 0 ? pains.reduce((a, b) => a + b, 0) / pains.length : null,
    avgCompletionRatio: ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null,
    difficultyMix: mix,
  };
}

function aggregateExerciseFeedback(
  exFeedback: ExerciseFeedbackRow[],
  sessionNumbers: number[]
): Array<{
  exercise_key: string;
  pain_delta_avg: number | null;
  skip_count: number;
  replace_count: number;
}> {
  const inWindow = exFeedback.filter((e) => sessionNumbers.includes(e.session_number));
  const byKey = new Map<
    string,
    { painDeltas: number[]; skipCount: number; replaceCount: number }
  >();

  for (const e of inWindow) {
    const key = e.exercise_key;
    if (!key) continue;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { painDeltas: [], skipCount: 0, replaceCount: 0 };
      byKey.set(key, entry);
    }
    if (typeof e.pain_delta === 'number' && Number.isFinite(e.pain_delta)) {
      entry.painDeltas.push(e.pain_delta);
    }
    if (e.skipped === true) entry.skipCount++;
    if (e.was_replaced === true) entry.replaceCount++;
  }

  return Array.from(byKey.entries())
    .filter(([, v]) => v.painDeltas.length > 0 || v.skipCount > 0 || v.replaceCount > 0)
    .map(([exercise_key, v]) => ({
      exercise_key,
      pain_delta_avg: v.painDeltas.length > 0
        ? v.painDeltas.reduce((a, b) => a + b, 0) / v.painDeltas.length
        : null,
      skip_count: v.skipCount,
      replace_count: v.replaceCount,
    }))
    .sort((a, b) => {
      const scoreA = (a.pain_delta_avg ?? 0) + a.skip_count * 2 + a.replace_count;
      const scoreB = (b.pain_delta_avg ?? 0) + b.skip_count * 2 + b.replace_count;
      return scoreB - scoreA;
    })
    .slice(0, 5);
}

// ─── Trend derivation ───────────────────────────────────────────────────────

function deriveAdherenceTrend(
  completedInWindow: number,
  sufficient: boolean
): TrendAdherence {
  if (!sufficient) return 'unknown';
  if (completedInWindow >= 3) return 'steady';
  if (completedInWindow <= 1) return 'down';
  return 'steady';
}

function deriveExertionTrend(
  avgRpe: number | null,
  sufficient: boolean
): TrendExertion {
  if (!sufficient || avgRpe == null) return 'unknown';
  return 'steady';
}

function derivePainBurdenTrend(
  feedback: SessionFeedbackRow[],
  sessionNumbers: number[],
  sufficient: boolean
): TrendPain {
  if (!sufficient || sessionNumbers.length < MIN_SESSIONS_FOR_TREND) return 'unknown';
  const inWindow = feedback.filter((f) => sessionNumbers.includes(f.session_number));
  const pains = inWindow.map((f) => f.pain_after).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (pains.length < 2) return 'unknown';

  const mid = Math.floor(pains.length / 2);
  const recent = pains.slice(0, mid);
  const older = pains.slice(mid);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const delta = recentAvg - olderAvg;

  if (delta <= PAIN_IMPROVE_DELTA) return 'improving';
  if (delta >= PAIN_WORSEN_DELTA) return 'worsening';
  return 'steady';
}

function deriveSessionToleranceTrend(
  avgCompletion: number | null,
  difficultyMix: { too_easy: number; ok: number; too_hard: number },
  problemCount: number,
  sufficient: boolean
): TrendTolerance {
  if (!sufficient) return 'unknown';
  const total = difficultyMix.too_easy + difficultyMix.ok + difficultyMix.too_hard;
  const tooHardRatio = total > 0 ? difficultyMix.too_hard / total : 0;

  if ((avgCompletion ?? 0) >= COMPLETION_GOOD && tooHardRatio < 0.3 && problemCount === 0) {
    return 'improving';
  }
  if ((avgCompletion ?? 0) < COMPLETION_POOR || tooHardRatio > 0.5 || problemCount >= 3) {
    return 'worsening';
  }
  return 'steady';
}

// ─── Summary copy ───────────────────────────────────────────────────────────

function buildProgressHeadline(
  sufficient: boolean,
  completedInWindow: number,
  trends: ProgressWindowReport['trends']
): string {
  if (!sufficient) {
    return '아직 최근 4세션 데이터가 충분하지 않습니다.';
  }
  if (trends.pain_burden === 'worsening') {
    return '최근 세션에서는 통증 부담 신호가 비슷하거나 다소 높게 나타났습니다.';
  }
  if (trends.session_tolerance === 'worsening') {
    return '최근 세션에서 난이도나 완료율에 부담이 있을 수 있습니다.';
  }
  if (trends.adherence === 'down') {
    return '최근 4세션 중 완료 횟수가 적습니다.';
  }
  return '최근 4세션 기준으로 루틴 적응이 비교적 안정적입니다.';
}

function buildProgressBullets(
  sufficient: boolean,
  completedInWindow: number,
  avgRpe: number | null,
  avgPain: number | null,
  windowSize: number
): string[] {
  const bullets: string[] = [];
  if (!sufficient) return bullets;
  bullets.push(`최근 ${windowSize}세션 중 ${completedInWindow}세션 완료`);
  if (avgRpe != null) {
    bullets.push(`평균 운동 체감 난이도 ${avgRpe.toFixed(1)}/10`);
  }
  if (avgPain != null) {
    bullets.push(`운동 후 통증 부담 평균 ${avgPain.toFixed(1)}/10`);
  }
  return bullets;
}

function buildProgressCaution(
  trends: ProgressWindowReport['trends'],
  problemCount: number
): string | null {
  if (trends.pain_burden === 'worsening') {
    return '통증 신호가 높아지면 무리하지 말고 휴식을 고려해 보세요.';
  }
  if (problemCount > 0) {
    return '특정 운동에서 반복적으로 부담 신호가 관찰됩니다.';
  }
  return null;
}

// ─── Main entry ─────────────────────────────────────────────────────────────

/**
 * Build full progress window report. Null-safe, fallback for sparse data.
 */
export async function getProgressWindowReport(
  userId: string,
  opts?: { windowSize?: number }
): Promise<ProgressWindowReport> {
  const windowSize = opts?.windowSize ?? WINDOW_SIZE;
  const { plans, feedback, exerciseFeedback } = await loadRecentSessionWindow(userId, windowSize);
  const baseline = await loadBaselineSummary(userId);
  const sessionNumbers = plans.map((p) => p.session_number);

  const completedInWindow = plans.length;
  const sufficient = completedInWindow >= MIN_SESSIONS_FOR_TREND;

  const agg = aggregateSessionFeedback(feedback, sessionNumbers);
  const topProblems = aggregateExerciseFeedback(exerciseFeedback, sessionNumbers);

  const adherence = deriveAdherenceTrend(completedInWindow, sufficient);
  const exertion = deriveExertionTrend(agg.avgRpe, sufficient);
  const painBurden = derivePainBurdenTrend(feedback, sessionNumbers, sufficient);
  const tolerance = deriveSessionToleranceTrend(
    agg.avgCompletionRatio,
    agg.difficultyMix,
    topProblems.length,
    sufficient
  );

  const trends = { adherence, exertion, pain_burden: painBurden, session_tolerance: tolerance };

  const headline = buildProgressHeadline(sufficient, completedInWindow, trends);
  const bullets = buildProgressBullets(
    sufficient,
    completedInWindow,
    agg.avgRpe,
    agg.avgPainAfter,
    windowSize
  );
  const caution = buildProgressCaution(trends, topProblems.length);

  const completionRate = sufficient && sessionNumbers.length > 0
    ? completedInWindow / windowSize
    : null;

  return {
    window_size: 4,
    available_sessions: completedInWindow,
    sufficient_data: sufficient,
    baseline: {
      result_type: baseline.result_type ?? null,
      primary_focus: baseline.primary_focus ?? null,
      secondary_focus: baseline.secondary_focus ?? null,
      effective_confidence: baseline.effective_confidence ?? null,
      safety_mode: baseline.safety_mode ?? null,
      scoring_version: baseline.scoring_version ?? null,
    },
    current: {
      completed_sessions_in_window: completedInWindow,
      completion_rate: completionRate,
      avg_rpe: agg.avgRpe,
      avg_pain_after: agg.avgPainAfter,
      avg_completion_ratio: agg.avgCompletionRatio,
      difficulty_mix: agg.difficultyMix,
      top_problem_exercises: topProblems.length > 0 ? topProblems : undefined,
    },
    trends,
    summary: {
      headline,
      bullets,
      caution: caution ?? null,
    },
  };
}
