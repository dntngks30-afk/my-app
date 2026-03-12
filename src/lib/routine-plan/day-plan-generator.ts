/**
 * MOVE RE - Day Plan Generator (Rule-based v1)
 *
 * SSOT: 룰/태그/제약. LLM 없음.
 * 입력: deep result, daily condition, routine_id, day_number
 * 출력: selected_template_ids (2~3개), reasons, constraints_applied
 *
 * @module routine-plan/day-plan-generator
 */

import { calculateDeepV2, extendDeepV2 } from '@/lib/deep-test/scoring/deep_v2';
import { calculateDeepV3 } from '@/lib/deep-test/scoring/deep_v3';
import type { DeepAnswerValue } from '@/lib/deep-test/types';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import {
  getAllExerciseTemplates,
  getFallbackTemplates,
} from '@/lib/workout-routine/exercise-templates-db';
import type { ExerciseTemplate } from '@/lib/workout-routine/exercise-templates';
import {
  applySafetyFilter,
  applyLevelFilter,
  applyFirstSessionGuardrail,
  scoreByFocusTags,
} from '@/lib/workout-routine/strategies/filter-strategy';

export const GENERATOR_VERSION = 'gen_v1';
export const RULE_VERSION = 'rule_v1';

/** Daily condition from client */
export interface DailyCondition {
  pain_today?: number; // 0–10
  stiffness?: number;
  sleep?: number;
  time_available?: number; // 5, 10, or 15 (min)
  equipment_available?: string[];
}

/** Normalized deep result shape (from DB or computed) */
export interface DeepResultInput {
  level: number;
  focus_tags: string[];
  avoid_tags: string[];
  primaryFocus?: string;
  secondaryFocus?: string;
  finalScores?: Record<string, number>;
}

/** Output day plan row */
export interface DayPlanRow {
  routine_id: string;
  day_number: number;
  selected_template_ids: string[];
  reasons: string[];
  constraints_applied: string[];
  generator_version: string;
  scoring_version: string;
  rule_version?: string;
  daily_condition_snapshot: DailyCondition | null;
  plan_hash: string;
}

/** Theme tags per day (day-specific to avoid identical Day2/4/5 selection) */
const DAY_THEMES: ReadonlyArray<{
  primaryTags: readonly string[];
  secondaryTags?: readonly string[];
  levelFilter?: number;
}> = [
  { primaryTags: ['core_control', 'full_body_reset'], secondaryTags: ['core_stability'], levelFilter: 1 },
  { primaryTags: ['thoracic_mobility', 'shoulder_mobility'], secondaryTags: ['hip_mobility'] },
  { primaryTags: ['core_stability', 'core_control', 'global_core'], secondaryTags: ['lower_chain_stability', 'glute_medius'] },
  { primaryTags: ['glute_activation', 'upper_back_activation'], secondaryTags: ['core_stability'] },
  { primaryTags: ['lower_chain_stability', 'global_core'], secondaryTags: ['basic_balance'] },
  { primaryTags: ['full_body_reset', 'core_stability'], secondaryTags: ['lower_chain_stability'] },
  { primaryTags: ['full_body_reset', 'basic_balance'], levelFilter: 1 },
];

const FALLBACK_IDS = ['M01', 'M28'];

/** Fallback diversification: day-specific preferred ID order (no DB/seed change) */
const FALLBACK_SETS: readonly (readonly string[])[] = [
  ['M01', 'M28'],
  ['M28', 'M02'],
  ['M02', 'M01'],
  ['M28', 'M01'],
];

const RECENT_USE_EXCLUSION_DAYS = 2;
const MIN_POOL_AFTER_EXCLUSION = 2;
const MIN_POOL_LEVEL1_RELAX = 4;
const SAFE_LEVEL2_TAGS = ['full_body_reset', 'core_control', 'core_stability'];

/** 재생성 트리거 사유 */
export type RegenReason =
  | 'user_request'
  | 'pain_delta'
  | 'pain_high'
  | 'condition_new'
  | 'condition_null_to_value'
  | 'time_available_drop';

const PAIN_DELTA_THRESHOLD = 3;
const PAIN_SAFE_THRESHOLD = 5;
const PAIN_TRIGGER_THRESHOLD = 7; // pain_today >= 7 → regeneration trigger
const STIFFNESS_SAFE_THRESHOLD = 6;

function computePlanHash(ids: string[]): string {
  const sorted = [...ids].sort();
  return sorted.join(',');
}

/** Pain >= 7: 추가 제약 (통증 급증 시) */
function getExtraConstraints(dailyCondition?: DailyCondition): string[] {
  const pain = dailyCondition?.pain_today ?? 0;
  if (pain >= 7) {
    return ['knee_load', 'wrist_load', 'shoulder_overhead'];
  }
  return [];
}

/** 안전모드: pain/stiffness 기준 level downshift */
function getEffectiveLevel(
  baseLevel: number,
  dailyCondition?: DailyCondition | null
): number {
  const pain = dailyCondition?.pain_today ?? 0;
  const stiffness = dailyCondition?.stiffness ?? 0;
  if (pain >= PAIN_SAFE_THRESHOLD || stiffness >= STIFFNESS_SAFE_THRESHOLD) {
    return Math.max(1, baseLevel - 1);
  }
  return baseLevel;
}

/** 안전모드: time_available <= 10 → 최대 2개 템플릿 */
function getMaxTemplates(dailyCondition?: DailyCondition | null): number {
  const time = dailyCondition?.time_available ?? 15;
  return time <= 10 ? 2 : 3;
}


/** derived shape from scores.derived (DeepV2ExtendedResult) */
function toDeepResultInput(extended: {
  level?: number;
  focus_tags?: string[];
  avoid_tags?: string[];
  primaryFocus?: string;
  secondaryFocus?: string;
  finalScores?: Record<string, number>;
}): DeepResultInput {
  return {
    level: extended.level ?? 1,
    focus_tags: Array.isArray(extended.focus_tags) ? extended.focus_tags : [],
    avoid_tags: Array.isArray(extended.avoid_tags) ? extended.avoid_tags : [],
    primaryFocus: extended.primaryFocus,
    secondaryFocus: extended.secondaryFocus,
    finalScores: extended.finalScores,
  };
}

/** STABLE 기본값 (derived 없을 때 크래시 방지) */
const STABLE_FALLBACK: DeepResultInput = {
  level: 2,
  focus_tags: ['core_control', 'full_body_reset'],
  avoid_tags: [],
  primaryFocus: 'FULL',
  secondaryFocus: 'NONE',
};

export async function loadDeepResultForUser(
  userId: string
): Promise<DeepResultInput | null> {
  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error } = await supabase
    .from('deep_test_attempts')
    .select('answers, scoring_version, scores')
    .eq('user_id', userId)
    .eq('status', 'final')
    .order('finalized_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  if (!attempt) return null;

  if (attempt.scoring_version === 'deep_v1') {
    return null;
  }

  const scores = attempt.scores as Record<string, unknown> | null;
  const derived = scores?.derived as Record<string, unknown> | null | undefined;

  if (derived && typeof derived.level === 'number' && Array.isArray(derived.focus_tags)) {
    return toDeepResultInput(derived as Parameters<typeof toDeepResultInput>[0]);
  }

  const answers = (attempt.answers ?? {}) as Record<string, DeepAnswerValue>;
  if (!answers || Object.keys(answers).length === 0) {
    return STABLE_FALLBACK;
  }

  try {
    if (attempt.scoring_version === 'deep_v3') {
      const v3 = calculateDeepV3(answers);
      const derived = v3.derived;
      return toDeepResultInput({
        level: derived.level,
        focus_tags: derived.focus_tags,
        avoid_tags: derived.avoid_tags,
        primaryFocus: derived.primaryFocus,
        secondaryFocus: derived.secondaryFocus,
        finalScores: derived.finalScores,
      });
    }
    const v2 = calculateDeepV2(answers);
    const extended = extendDeepV2(v2);
    return toDeepResultInput(extended);
  } catch {
    return STABLE_FALLBACK;
  }
}

async function loadRecentUsedIds(
  supabase: ReturnType<typeof import('@/lib/supabase').getServerSupabaseAdmin>,
  routineId: string,
  dayNumber: number
): Promise<Set<string>> {
  const fromDay = Math.max(1, dayNumber - RECENT_USE_EXCLUSION_DAYS);
  const toDay = dayNumber - 1;
  if (fromDay > toDay) return new Set();

  const { data: rows, error } = await supabase
    .from('routine_day_plans')
    .select('selected_template_ids')
    .eq('routine_id', routineId)
    .gte('day_number', fromDay)
    .lte('day_number', toDay);

  if (error || !rows?.length) return new Set();
  const ids = new Set<string>();
  for (const row of rows) {
    const arr = row?.selected_template_ids as string[] | null;
    if (Array.isArray(arr)) arr.forEach((id) => ids.add(id));
  }
  return ids;
}

export type GenerateDayPlanResult = {
  plan: DayPlanRow;
  regenerated: boolean;
  regen_reason?: RegenReason;
  /** debug=1일 때만 포함 */
  generator_timings?: {
    t_ctx_deep: number;
    t_ctx_recent: number;
    t_templates: number;
    t_rules: number;
    t_db_write: number;
    t_generate_total: number;
  };
};

function computeRegenReason(
  opts: { forceRegenerate?: boolean },
  existing: { data: { daily_condition_snapshot: unknown } | null },
  dailyCondition: DailyCondition | null
): RegenReason | undefined {
  if (opts?.forceRegenerate) return 'user_request';
  if (!existing.data) return 'condition_new';

  const prev = existing.data.daily_condition_snapshot as DailyCondition | null;
  const prevPain = prev?.pain_today ?? null;
  const currPain = dailyCondition?.pain_today ?? null;
  const prevTime = prev?.time_available ?? null;
  const currTime = dailyCondition?.time_available ?? null;

  if (prev === null && dailyCondition !== null) return 'condition_null_to_value';
  if (currPain != null && currPain >= PAIN_TRIGGER_THRESHOLD) return 'pain_high';
  if (prevPain != null && currPain != null && Math.abs(currPain - prevPain) >= PAIN_DELTA_THRESHOLD) return 'pain_delta';
  if (prevTime === 15 && currTime === 5) return 'time_available_drop';

  return undefined;
}

/** Preloaded context from ensure to avoid duplicate DB round-trips */
export interface GenerateDayPlanPreloadedContext {
  userId: string;
}

export async function generateDayPlan(
  routineId: string,
  dayNumber: number,
  dailyCondition: DailyCondition | null,
  opts?: {
    forceRegenerate?: boolean;
    preloadedContext?: GenerateDayPlanPreloadedContext;
    intensityScale?: number;
    debug?: boolean;
  }
): Promise<GenerateDayPlanResult> {
  const supabase = getServerSupabaseAdmin();

  let userId: string;
  if (opts?.preloadedContext?.userId) {
    userId = opts.preloadedContext.userId;
  } else {
    const routine = await supabase
      .from('workout_routines')
      .select('id, user_id')
      .eq('id', routineId)
      .single();

    if (routine.error || !routine.data) {
      throw new Error('Routine not found');
    }
    userId = routine.data.user_id;
  }

  const existing = await supabase
    .from('routine_day_plans')
    .select('*')
    .eq('routine_id', routineId)
    .eq('day_number', dayNumber)
    .maybeSingle();

  const conditionsEqual = (a: DailyCondition | null, b: DailyCondition | null): boolean => {
    const pa = a?.pain_today ?? null;
    const pb = b?.pain_today ?? null;
    const sa = a?.stiffness ?? null;
    const sb = b?.stiffness ?? null;
    const ta = a?.time_available ?? null;
    const tb = b?.time_available ?? null;
    return pa === pb && sa === sb && ta === tb;
  };

  /**
   * 다음 day plan 재생성 트리거 (설문 기반).
   * - pain_today >= 7: 통증 급증 → softer plan
   * - pain_delta >= 3: 통증 변화 → 조절
   * - time_available 15→5: 시간 부족 → fewer templates
   * - condition_null_to_value: 신규 설문 입력
   */
  const shouldRegenerate = (): boolean => {
    if (opts?.forceRegenerate) return true;
    if (!existing.data) return true;

    const prev = existing.data.daily_condition_snapshot as DailyCondition | null;
    const curr = dailyCondition;

    if (conditionsEqual(prev, curr)) return false;

    const prevPain = prev?.pain_today ?? null;
    const currPain = curr?.pain_today ?? null;
    const prevTime = prev?.time_available ?? null;
    const currTime = curr?.time_available ?? null;

    if (currPain != null && currPain >= PAIN_TRIGGER_THRESHOLD) return true;
    if (prevPain != null && currPain != null && currPain - prevPain >= PAIN_DELTA_THRESHOLD) return true;
    if (prev === null && curr !== null) return true;
    if (prevPain != null && currPain != null && prevPain - currPain >= PAIN_DELTA_THRESHOLD) return true;
    if (prevTime === 15 && currTime === 5) return true;

    return false;
  };

  if (existing.data && !shouldRegenerate()) {
    const plan = {
      routine_id: existing.data.routine_id,
      day_number: existing.data.day_number,
      selected_template_ids: existing.data.selected_template_ids,
      reasons: existing.data.reasons ?? [],
      constraints_applied: existing.data.constraints_applied ?? [],
      generator_version: existing.data.generator_version,
      scoring_version: existing.data.scoring_version,
      daily_condition_snapshot: existing.data.daily_condition_snapshot,
      plan_hash: existing.data.plan_hash ?? '',
    } as DayPlanRow;
    return { plan, regenerated: false };
  }

  const regenReason = computeRegenReason(opts ?? {}, existing, dailyCondition);
  const isDebug = opts?.debug === true;
  const timings: Record<string, number> = {};

  const genT0 = performance.now();

  const [deepResult, recentUsedIds, poolRaw, allFallbacks] = await Promise.all([
    (async () => {
      const t0 = performance.now();
      const r = await loadDeepResultForUser(userId);
      if (isDebug) timings.t_ctx_deep = Math.round(performance.now() - t0);
      return r;
    })(),
    (async () => {
      const t0 = performance.now();
      const r = await loadRecentUsedIds(supabase, routineId, dayNumber);
      if (isDebug) timings.t_ctx_recent = Math.round(performance.now() - t0);
      return r;
    })(),
    (async () => {
      const t0 = performance.now();
      const r = await getAllExerciseTemplates({ scoringVersion: 'deep_v2' });
      if (isDebug) timings.t_templates = Math.round(performance.now() - t0);
      return r;
    })(),
    getFallbackTemplates(),
  ]);

  const baseLevel = deepResult?.level ?? 1;
  const intensityScale = opts?.intensityScale ?? 1.0;
  const scaledLevel = Math.max(1, Math.min(3, Math.round(baseLevel * intensityScale)));
  const level = getEffectiveLevel(scaledLevel, dailyCondition);
  const focusTags = deepResult?.focus_tags ?? [];
  const avoidTags = [...(deepResult?.avoid_tags ?? []), ...getExtraConstraints(dailyCondition ?? undefined)];

  const tRules0 = performance.now();
  let pool = applySafetyFilter(poolRaw, avoidTags);
  let poolAfterLevel = applyLevelFilter(pool, level);
  let levelRelaxUsed = false;
  if (level === 1 && poolAfterLevel.length < MIN_POOL_LEVEL1_RELAX) {
    const safeL2 = pool.filter(
      (t) => t.level === 2 && t.avoid_tags.length === 0 &&
        t.focus_tags.some((tag) => SAFE_LEVEL2_TAGS.includes(tag))
    );
    const seen = new Set(poolAfterLevel.map((t) => t.id));
    for (const t of safeL2) {
      if (!seen.has(t.id)) {
        poolAfterLevel = [...poolAfterLevel, t];
        seen.add(t.id);
        levelRelaxUsed = true;
      }
    }
  }
  pool = poolAfterLevel;

  // First-session guardrail: no high difficulty / high progression
  let firstSessionGuardrailUsed = false;
  if (dayNumber === 1) {
    const before = pool.length;
    pool = applyFirstSessionGuardrail(pool);
    firstSessionGuardrailUsed = pool.length < before;
  }

  const theme = DAY_THEMES[dayNumber - 1];
  const baseTags = theme.primaryTags.length > 0
    ? [...theme.primaryTags, ...(theme.secondaryTags ?? [])]
    : focusTags.length > 0 ? [...focusTags] : ['core_stability', 'core_control'];
  const themeTags = focusTags.length > 0 ? [...new Set([...baseTags, ...focusTags])] : baseTags;

  const levelFilter = theme.levelFilter ?? level;
  pool = pool.filter((t) => t.level <= levelFilter);
  let poolForScoring = pool;
  let excludedCount = 0;
  let usePenalty = false;
  if (recentUsedIds.size > 0) {
    const poolExcluded = pool.filter((t) => !recentUsedIds.has(t.id));
    if (poolExcluded.length >= MIN_POOL_AFTER_EXCLUSION) {
      poolForScoring = poolExcluded;
      excludedCount = pool.length - poolExcluded.length;
    } else {
      usePenalty = true;
    }
  }

  let scored = scoreByFocusTags(poolForScoring, themeTags);
  if (usePenalty && recentUsedIds.size > 0) {
    const [notRecent, recent] = scored.reduce<[ExerciseTemplate[], ExerciseTemplate[]]>(
      (acc, t) => {
        acc[recentUsedIds.has(t.id) ? 1 : 0].push(t);
        return acc;
      },
      [[], []]
    );
    scored = [...notRecent, ...recent];
  }

  const maxTemplates = getMaxTemplates(dailyCondition);
  const selected: ExerciseTemplate[] = [];
  const usedTags = new Set<string>();

  for (const t of scored) {
    if (selected.length >= maxTemplates) break;

    const tTags = new Set(t.focus_tags);
    const overlap = [...tTags].filter((tag) => usedTags.has(tag)).length;
    if (selected.length >= 2 && overlap === tTags.size) continue;

    selected.push(t);
    t.focus_tags.forEach((tag) => usedTags.add(tag));
  }

  let fallbackUsed = false;
  if (selected.length < 2) {
    fallbackUsed = true;
    const preferredSet = FALLBACK_SETS[dayNumber % FALLBACK_SETS.length];
    const safePoolL1 = pool.filter((t) => t.level <= 1 && t.avoid_tags.length === 0);
    const candidates: ExerciseTemplate[] = [];
    const seen = new Set<string>();
    for (const id of preferredSet) {
      const t = allFallbacks.find((x) => x.id === id) ?? safePoolL1.find((x) => x.id === id);
      if (t && !seen.has(t.id)) {
        candidates.push(t);
        seen.add(t.id);
      }
    }
    for (const t of [...allFallbacks, ...safePoolL1]) {
      if (!seen.has(t.id)) {
        candidates.push(t);
        seen.add(t.id);
      }
    }
    for (const t of candidates) {
      if (selected.length >= 2) break;
      if (selected.some((s) => s.id === t.id)) continue;
      if (recentUsedIds.has(t.id) && selected.length >= 1) continue;
      selected.push(t);
    }
    for (const fb of allFallbacks) {
      if (selected.length >= 2) break;
      if (selected.some((s) => s.id === fb.id)) continue;
      selected.push(fb);
    }
  }

  selected.sort((a, b) => {
    const aWarmup = a.focus_tags.some((t) => ['full_body_reset', 'calf_release'].includes(t)) ? 0 : 1;
    const bWarmup = b.focus_tags.some((t) => ['full_body_reset', 'calf_release'].includes(t)) ? 0 : 1;
    return aWarmup - bWarmup;
  });

  const selectedIds = selected.map((t) => t.id);
  const reasons = selected.map((t) =>
    `focus_tag_match:${t.focus_tags[0] ?? 'fallback'}`
  );
  const constraintsApplied = [
    ...avoidTags.map((a) => `avoid:${a}`),
    `level<=${level}`,
    ...(dayNumber === 1 ? ['first_session:no_high_difficulty'] : []),
  ];
  if (process.env.NODE_ENV !== 'production') {
    if (recentUsedIds.size > 0) constraintsApplied.push(`recentUsed:${recentUsedIds.size}`);
    if (excludedCount > 0) constraintsApplied.push(`excluded:${excludedCount}`);
    if (usePenalty) constraintsApplied.push('recentPenalty');
    if (fallbackUsed) constraintsApplied.push('fallbackUsed');
    if (levelRelaxUsed) constraintsApplied.push('level1Relax');
    if (firstSessionGuardrailUsed) constraintsApplied.push('firstSessionGuardrail');
  }

  const planHash = computePlanHash(selectedIds);

  const planRow: DayPlanRow = {
    routine_id: routineId,
    day_number: dayNumber,
    selected_template_ids: selectedIds,
    reasons,
    constraints_applied: constraintsApplied,
    generator_version: GENERATOR_VERSION,
    scoring_version: 'deep_v2',
    daily_condition_snapshot: dailyCondition ?? null,
    plan_hash: planHash,
  };

  const oldHash = existing.data?.plan_hash ?? null;
  const auditReason = regenReason ?? 'daily_condition_change';
  const prevRevisionNo = (existing.data as { revision_no?: number })?.revision_no ?? 0;
  const nextRevisionNo = prevRevisionNo + 1;

  const isSafetyTrigger =
    regenReason === 'pain_high' ||
    regenReason === 'pain_delta' ||
    regenReason === 'time_available_drop';
  const safetyMode = !!isSafetyTrigger;
  const safetyReason = isSafetyTrigger ? auditReason : null;

  const tDbWrite0 = performance.now();

  const hasChange = !existing.data || oldHash !== planHash;

  const upsertOp = supabase.from('routine_day_plans').upsert(
    {
      routine_id: routineId,
      day_number: dayNumber,
      selected_template_ids: selectedIds,
      reasons,
      constraints_applied: constraintsApplied,
      generator_version: GENERATOR_VERSION,
      scoring_version: 'deep_v2',
      rule_version: RULE_VERSION,
      daily_condition_snapshot: dailyCondition ?? null,
      plan_hash: planHash,
      safety_mode: safetyMode,
      safety_reason: safetyReason,
      revision_no: nextRevisionNo,
      intensity_scale: intensityScale,
    },
    { onConflict: 'routine_id,day_number' }
  );

  const revisionPayload = {
    routine_id: routineId,
    day_number: dayNumber,
    revision_no: nextRevisionNo,
    reason: auditReason,
    old_hash: oldHash,
    new_hash: planHash,
    created_by: userId,
  };
  const auditPayload = {
    routine_id: routineId,
    day_number: dayNumber,
    old_plan_hash: oldHash,
    new_plan_hash: planHash,
    reason: auditReason,
    revision_no: nextRevisionNo,
    created_by: userId,
  };

  if (existing.data) {
    const writes: Promise<unknown>[] = [upsertOp];
    if (hasChange) {
      writes.push(supabase.from('routine_day_plan_revisions').insert(revisionPayload));
    }
    if (oldHash !== planHash) {
      writes.push(supabase.from('routine_day_plan_audit').insert(auditPayload));
    }
    await Promise.all(writes);
  } else {
    await upsertOp;
    if (hasChange) {
      await supabase.from('routine_day_plan_revisions').insert(revisionPayload);
    }
  }

  if (isDebug) {
    timings.t_rules = Math.round(tDbWrite0 - tRules0);
    timings.t_db_write = Math.round(performance.now() - tDbWrite0);
    timings.t_generate_total = Math.round(performance.now() - genT0);
  }

  const result: GenerateDayPlanResult = { plan: planRow, regenerated: true, regen_reason: regenReason };
  if (isDebug && Object.keys(timings).length > 0) {
    result.generator_timings = {
      t_ctx_deep: timings.t_ctx_deep ?? 0,
      t_ctx_recent: timings.t_ctx_recent ?? 0,
      t_templates: timings.t_templates ?? 0,
      t_rules: timings.t_rules ?? 0,
      t_db_write: timings.t_db_write ?? 0,
      t_generate_total: timings.t_generate_total ?? 0,
    };
  }
  return result;
}

export async function getDayPlan(
  routineId: string,
  dayNumber: number
): Promise<DayPlanRow | null> {
  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('routine_day_plans')
    .select('*')
    .eq('routine_id', routineId)
    .eq('day_number', dayNumber)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    routine_id: data.routine_id,
    day_number: data.day_number,
    selected_template_ids: data.selected_template_ids,
    reasons: data.reasons ?? [],
    constraints_applied: data.constraints_applied ?? [],
    generator_version: data.generator_version,
    scoring_version: data.scoring_version,
    rule_version: data.rule_version ?? RULE_VERSION,
    daily_condition_snapshot: data.daily_condition_snapshot,
    plan_hash: data.plan_hash ?? '',
  } as DayPlanRow;
}
