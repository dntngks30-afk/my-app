/**
 * PR-P2-3: Adaptive progression v1 (rule-based)
 * 최근 1~2세션 feedback 기반 보수적 조정. deterministic.
 */

/* Lazy import to allow deriveAdaptiveModifiers (pure) to run without Supabase env */

// ─── Constants ─────────────────────────────────────────────────────────────

const HIGH_PAIN_AFTER = 5;
const HIGH_PAIN_DELTA = 2;
const LOW_COMPLETION = 0.6;
const HIGH_COMPLETION = 0.9;
const HIGH_RPE = 8;
const LOW_RPE = 4;
const PROBLEM_EXERCISE_THRESHOLD = 2;
const MAX_LEVEL_CAP = 3;
const ADAPTIVE_WINDOW = 2;

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdaptiveReason = 'pain_flare' | 'low_tolerance' | 'high_tolerance' | 'none';

/** PR-ALG-05: difficulty cap when regression (template metadata) */
export type DifficultyCap = 'low' | 'medium' | 'high';

export type AdaptiveModifiers = {
  reason: AdaptiveReason;
  targetLevelDelta: -1 | 0 | 1;
  forceShort?: boolean;
  forceRecovery?: boolean;
  avoidExerciseKeys: string[];
  /** PR-ALG-05: exclude templates with difficulty above this */
  maxDifficultyCap?: DifficultyCap;
  signalSummary?: {
    avg_rpe?: number | null;
    avg_pain_after?: number | null;
    avg_completion_ratio?: number | null;
    skip_count?: number;
    replace_count?: number;
    difficulty_mix?: { too_easy: number; ok: number; too_hard: number };
  };
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

// ─── Load signals ───────────────────────────────────────────────────────────

/**
 * Load recent 1~2 completed sessions' feedback for adaptation.
 * Only sessions < nextSessionNumber (completed only).
 */
export async function loadRecentAdaptiveSignals(
  userId: string,
  nextSessionNumber: number
): Promise<{
  sessionFeedback: SessionFeedbackRow[];
  exerciseFeedback: ExerciseFeedbackRow[];
  sourceSessionNumbers: number[];
}> {
  if (nextSessionNumber <= 1) {
    return { sessionFeedback: [], exerciseFeedback: [], sourceSessionNumbers: [] };
  }

  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();
  const fromSession = Math.max(1, nextSessionNumber - ADAPTIVE_WINDOW);
  const toSession = nextSessionNumber - 1;

  const [sfRes, exRes, plansRes] = await Promise.all([
    supabase
      .from('session_feedback')
      .select('session_number, overall_rpe, pain_after, difficulty_feedback, completion_ratio')
      .eq('user_id', userId)
      .gte('session_number', fromSession)
      .lte('session_number', toSession)
      .order('session_number', { ascending: false }),
    supabase
      .from('exercise_feedback')
      .select('session_number, exercise_key, pain_delta, was_replaced, skipped')
      .eq('user_id', userId)
      .gte('session_number', fromSession)
      .lte('session_number', toSession),
    supabase
      .from('session_plans')
      .select('session_number')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('session_number', fromSession)
      .lte('session_number', toSession)
      .order('session_number', { ascending: false })
      .limit(ADAPTIVE_WINDOW),
  ]);

  const completedNumbers = new Set((plansRes.data ?? []).map((r) => r.session_number));
  const sf = (sfRes.data ?? []).filter((r) => completedNumbers.has(r.session_number)) as SessionFeedbackRow[];
  const ex = (exRes.data ?? []).filter((r) => completedNumbers.has(r.session_number)) as ExerciseFeedbackRow[];

  return {
    sessionFeedback: sf,
    exerciseFeedback: ex,
    sourceSessionNumbers: Array.from(completedNumbers).sort((a, b) => b - a),
  };
}

// ─── Derive modifiers ────────────────────────────────────────────────────────

function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function getProblemExerciseKeys(
  exFeedback: ExerciseFeedbackRow[],
  sessionNumbers: number[]
): string[] {
  const inWindow = exFeedback.filter((e) => sessionNumbers.includes(e.session_number));
  const byKey = new Map<string, { painDeltas: number[]; skipCount: number; replaceCount: number }>();

  for (const e of inWindow) {
    if (!e.exercise_key) continue;
    let entry = byKey.get(e.exercise_key);
    if (!entry) {
      entry = { painDeltas: [], skipCount: 0, replaceCount: 0 };
      byKey.set(e.exercise_key, entry);
    }
    if (typeof e.pain_delta === 'number' && Number.isFinite(e.pain_delta)) {
      entry.painDeltas.push(e.pain_delta);
    }
    if (e.skipped === true) entry.skipCount++;
    if (e.was_replaced === true) entry.replaceCount++;
  }

  const problemKeys: string[] = [];
  for (const [key, v] of byKey.entries()) {
    const avgPain = v.painDeltas.length > 0
      ? v.painDeltas.reduce((a, b) => a + b, 0) / v.painDeltas.length
      : 0;
    const problemScore = avgPain >= HIGH_PAIN_DELTA ? 2 : 0;
    const skipReplaceScore = v.skipCount + v.replaceCount;
    if (problemScore >= 2 || skipReplaceScore >= PROBLEM_EXERCISE_THRESHOLD) {
      problemKeys.push(key);
    }
  }
  return [...new Set(problemKeys)].sort();
}

/** PR-ALG-05: deep_v3 context for adaptive weighting */
export type AdaptiveContext = {
  priority_vector?: Record<string, number> | null;
  pain_mode?: 'none' | 'caution' | 'protected' | null;
};

/**
 * Deterministic. Priority: pain_flare > low_tolerance > high_tolerance > none.
 * PR-ALG-05: ctx.pain_mode=protected → regression bias; ctx.pain_mode=none + high_tolerance → progression.
 */
export function deriveAdaptiveModifiers(
  sessionFeedback: SessionFeedbackRow[],
  exerciseFeedback: ExerciseFeedbackRow[],
  sourceSessionNumbers: number[],
  ctx?: AdaptiveContext | null
): AdaptiveModifiers {
  const none: AdaptiveModifiers = {
    reason: 'none',
    targetLevelDelta: 0,
    avoidExerciseKeys: [],
  };

  if (sourceSessionNumbers.length === 0) return none;

  const inWindow = sessionFeedback.filter((f) => sourceSessionNumbers.includes(f.session_number));
  const avgRpe = avg(inWindow.map((f) => f.overall_rpe));
  const avgPainAfter = avg(inWindow.map((f) => f.pain_after));
  const avgCompletion = avg(inWindow.map((f) => f.completion_ratio));

  let skipCount = 0;
  let replaceCount = 0;
  for (const e of exerciseFeedback) {
    if (sourceSessionNumbers.includes(e.session_number)) {
      if (e.skipped === true) skipCount++;
      if (e.was_replaced === true) replaceCount++;
    }
  }

  const difficultyMix = { too_easy: 0, ok: 0, too_hard: 0 };
  for (const f of inWindow) {
    if (f.difficulty_feedback === 'too_easy') difficultyMix.too_easy++;
    else if (f.difficulty_feedback === 'ok') difficultyMix.ok++;
    else if (f.difficulty_feedback === 'too_hard') difficultyMix.too_hard++;
  }

  const signalSummary = {
    avg_rpe: avgRpe,
    avg_pain_after: avgPainAfter,
    avg_completion_ratio: avgCompletion,
    skip_count: skipCount,
    replace_count: replaceCount,
    difficulty_mix: difficultyMix,
  };

  const painMode = ctx?.pain_mode ?? 'none';
  const isProtected = painMode === 'protected';
  const isCaution = painMode === 'caution';

  // PR-ALG-05: protected → lower thresholds for regression
  const painAfterThreshold = isProtected ? 4 : HIGH_PAIN_AFTER;
  const painDeltaThreshold = isProtected ? 1.5 : HIGH_PAIN_DELTA;
  const lowCompletionThreshold = isProtected ? 0.75 : LOW_COMPLETION;

  const hasPainFlare =
    (avgPainAfter != null && avgPainAfter >= painAfterThreshold) ||
    exerciseFeedback.some(
      (e) =>
        sourceSessionNumbers.includes(e.session_number) &&
        typeof e.pain_delta === 'number' &&
        e.pain_delta >= painDeltaThreshold
    );

  const hasLowTolerance =
    (avgCompletion != null && avgCompletion < lowCompletionThreshold) ||
    inWindow.some((f) => f.difficulty_feedback === 'too_hard') ||
    (avgRpe != null && avgRpe >= HIGH_RPE) ||
    skipCount + replaceCount >= PROBLEM_EXERCISE_THRESHOLD;

  // PR-ALG-05: none only → allow progression; protected/caution block
  const hasHighTolerance =
    !hasPainFlare &&
    painMode === 'none' &&
    inWindow.length >= 2 &&
    inWindow.every((f) => (f.completion_ratio ?? 1) >= HIGH_COMPLETION) &&
    (avgRpe == null || avgRpe <= LOW_RPE) &&
    (avgPainAfter == null || avgPainAfter < HIGH_PAIN_AFTER) &&
    skipCount + replaceCount < 2;

  const problemKeys = getProblemExerciseKeys(exerciseFeedback, sourceSessionNumbers);

  // PR-ALG-05: regression → maxDifficultyCap by pain_mode
  const regressionCap: DifficultyCap | undefined =
    isProtected ? 'low' : isCaution ? 'medium' : undefined;

  if (hasPainFlare) {
    return {
      reason: 'pain_flare',
      targetLevelDelta: -1,
      forceShort: true,
      forceRecovery: true,
      avoidExerciseKeys: problemKeys,
      ...(regressionCap && { maxDifficultyCap: regressionCap }),
      signalSummary,
    };
  }

  if (hasLowTolerance) {
    return {
      reason: 'low_tolerance',
      targetLevelDelta: -1,
      forceShort: true,
      forceRecovery: false,
      avoidExerciseKeys: problemKeys,
      ...(regressionCap && { maxDifficultyCap: regressionCap }),
      signalSummary,
    };
  }

  if (hasHighTolerance) {
    return {
      reason: 'high_tolerance',
      targetLevelDelta: 1,
      forceShort: false,
      forceRecovery: false,
      avoidExerciseKeys: [],
      signalSummary,
    };
  }

  return { ...none, signalSummary };
}

// ─── Build trace ────────────────────────────────────────────────────────────

export type AdaptationTrace = {
  reason: AdaptiveReason;
  source_sessions: number[];
  applied_modifiers: {
    target_level_delta: -1 | 0 | 1;
    force_short?: boolean;
    force_recovery?: boolean;
    avoid_exercise_keys?: string[];
    /** PR-ALG-05: exclude templates with difficulty above this */
    max_difficulty_cap?: DifficultyCap;
  };
  signal_summary?: {
    avg_rpe?: number | null;
    avg_pain_after?: number | null;
    avg_completion_ratio?: number | null;
    skip_count?: number;
    replace_count?: number;
    difficulty_mix?: { too_easy: number; ok: number; too_hard: number };
  };
  /** Event-based summary from session_adaptive_summaries (exercise-level rpe/discomfort). For trace/debug. */
  event_based_summary?: {
    completion_ratio: number;
    avg_rpe: number | null;
    avg_discomfort: number | null;
    dropout_risk_score: number;
    discomfort_burden_score: number;
    flags: string[];
  };
  /** User-facing one-liner derived from reason. Only when reason !== 'none'. */
  reason_summary?: string;
  /** PR-ALG-05: deep_v3 context used */
  pain_mode?: 'none' | 'caution' | 'protected';
  priority_vector_keys?: string[];
};

const REASON_SUMMARY: Record<AdaptiveReason, string> = {
  pain_flare: '최근 통증/부담 기록을 반영해 회복 중심으로 조정했어요',
  low_tolerance: '이전 수행 난이도를 반영해 강도를 소폭 조정했어요',
  high_tolerance: '이전 수행이 원활해 강도를 소폭 올렸어요',
  none: '',
};

export function buildAdaptationTrace(
  modifiers: AdaptiveModifiers,
  sourceSessionNumbers: number[],
  ctx?: AdaptiveContext | null
): AdaptationTrace {
  const trace: AdaptationTrace = {
    reason: modifiers.reason,
    source_sessions: [...sourceSessionNumbers].sort((a, b) => a - b),
    applied_modifiers: {
      target_level_delta: modifiers.targetLevelDelta,
    },
  };

  if (modifiers.forceShort) trace.applied_modifiers.force_short = true;
  if (modifiers.forceRecovery) trace.applied_modifiers.force_recovery = true;
  if (modifiers.avoidExerciseKeys.length > 0) {
    trace.applied_modifiers.avoid_exercise_keys = modifiers.avoidExerciseKeys;
  }
  if (modifiers.maxDifficultyCap) {
    trace.applied_modifiers.max_difficulty_cap = modifiers.maxDifficultyCap;
  }
  if (modifiers.signalSummary) trace.signal_summary = modifiers.signalSummary;
  if (ctx?.pain_mode) trace.pain_mode = ctx.pain_mode;
  if (ctx?.priority_vector && Object.keys(ctx.priority_vector).length > 0) {
    trace.priority_vector_keys = Object.keys(ctx.priority_vector);
  }
  if (modifiers.reason !== 'none') {
    trace.reason_summary = REASON_SUMMARY[modifiers.reason] || '';
  }

  return trace;
}
