/**
 * MOVE RE - Day Plan Generator (Rule-based v1)
 *
 * SSOT: 룰/태그/제약. LLM 없음.
 * 입력: deep result, daily condition, routine_id, day_number
 * 출력: selected_template_ids (2~3개), reasons, constraints_applied
 *
 * @module routine-plan/day-plan-generator
 */

import { calculateDeepV2 } from '@/lib/deep-test/scoring/deep_v2';
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
  daily_condition_snapshot: DailyCondition | null;
  plan_hash: string;
}

/** Theme tags per day (align with deep-v2-generator DAY_THEMES) */
const DAY_THEMES: ReadonlyArray<{
  primaryTags: readonly string[];
  secondaryTags?: readonly string[];
  levelFilter?: number;
}> = [
  { primaryTags: ['core_control', 'full_body_reset'], secondaryTags: ['core_stability'], levelFilter: 1 },
  { primaryTags: [] },
  { primaryTags: ['core_stability', 'core_control', 'global_core'], secondaryTags: ['lower_chain_stability', 'glute_medius'] },
  { primaryTags: [] },
  { primaryTags: [] },
  { primaryTags: ['full_body_reset', 'core_stability'], secondaryTags: ['lower_chain_stability'] },
  { primaryTags: ['full_body_reset', 'basic_balance'], levelFilter: 1 },
];

const FALLBACK_IDS = ['M01', 'M28'];

/** 재생성 트리거 사유 */
export type RegenReason =
  | 'user_request'
  | 'pain_delta'
  | 'condition_new'
  | 'condition_null_to_value';

const PAIN_DELTA_THRESHOLD = 3;
const PAIN_SAFE_THRESHOLD = 5;
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


export async function loadDeepResultForUser(
  userId: string
): Promise<DeepResultInput | null> {
  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error } = await supabase
    .from('deep_test_attempts')
    .select('answers, scoring_version')
    .eq('user_id', userId)
    .eq('status', 'final')
    .order('finalized_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !attempt?.answers) return null;

  const answers = attempt.answers as Record<string, DeepAnswerValue>;
  if (attempt.scoring_version === 'deep_v1') {
    return null;
  }

  const v2 = calculateDeepV2(answers);
  return {
    level: v2.level,
    focus_tags: v2.focus_tags,
    avoid_tags: v2.avoid_tags,
    primaryFocus: v2.primaryFocus,
    secondaryFocus: v2.secondaryFocus,
    finalScores: v2.finalScores,
  };
}

export type GenerateDayPlanResult = {
  plan: DayPlanRow;
  regenerated: boolean;
  regen_reason?: RegenReason;
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

  if (prev === null && dailyCondition !== null) return 'condition_null_to_value';
  if (prevPain != null && currPain != null && Math.abs(currPain - prevPain) >= PAIN_DELTA_THRESHOLD) {
    return 'pain_delta';
  }
  return undefined;
}

export async function generateDayPlan(
  routineId: string,
  dayNumber: number,
  dailyCondition: DailyCondition | null,
  opts?: { forceRegenerate?: boolean }
): Promise<GenerateDayPlanResult> {
  const supabase = getServerSupabaseAdmin();

  const routine = await supabase
    .from('workout_routines')
    .select('id, user_id')
    .eq('id', routineId)
    .single();

  if (routine.error || !routine.data) {
    throw new Error('Routine not found');
  }

  const userId = routine.data.user_id;

  const existing = await supabase
    .from('routine_day_plans')
    .select('*')
    .eq('routine_id', routineId)
    .eq('day_number', dayNumber)
    .maybeSingle();

  const shouldRegenerate = (): boolean => {
    if (opts?.forceRegenerate) return true;
    if (!existing.data) return true;

    const prev = existing.data.daily_condition_snapshot as DailyCondition | null;
    const prevPain = prev?.pain_today ?? null;
    const currPain = dailyCondition?.pain_today ?? null;
    if (prev === null && dailyCondition !== null) return true;
    if (prevPain != null && currPain != null && Math.abs(currPain - prevPain) >= PAIN_DELTA_THRESHOLD) return true;

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

  const deepResult = await loadDeepResultForUser(userId);

  const baseLevel = deepResult?.level ?? 1;
  const level = getEffectiveLevel(baseLevel, dailyCondition);
  const focusTags = deepResult?.focus_tags ?? [];
  const avoidTags = [...(deepResult?.avoid_tags ?? []), ...getExtraConstraints(dailyCondition ?? undefined)];

  let pool = await getAllExerciseTemplates({ scoringVersion: 'deep_v2' });

  pool = applySafetyFilter(pool, avoidTags);
  pool = applyLevelFilter(pool, level);

  const theme = DAY_THEMES[dayNumber - 1];
  const themeTags = theme.primaryTags.length > 0
    ? [...theme.primaryTags, ...(theme.secondaryTags ?? [])]
    : [...focusTags];

  const levelFilter = theme.levelFilter ?? level;
  pool = pool.filter((t) => t.level <= levelFilter);

  let scored = scoreByFocusTags(pool, themeTags);

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

  if (selected.length < 2) {
    const fallbacks = await getFallbackTemplates();
    for (const fb of fallbacks) {
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
  ];

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

  await supabase.from('routine_day_plans').upsert(
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
    },
    { onConflict: 'routine_id,day_number' }
  );

  if (existing.data && (oldHash !== planHash)) {
    await supabase.from('routine_day_plan_audit').insert({
      routine_id: routineId,
      day_number: dayNumber,
      old_plan_hash: oldHash,
      new_plan_hash: planHash,
      reason: auditReason,
    });
  }

  return { plan: planRow, regenerated: true, regen_reason: regenReason };
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

  if (error || !data) return null;

  return {
    routine_id: data.routine_id,
    day_number: data.day_number,
    selected_template_ids: data.selected_template_ids,
    reasons: data.reasons ?? [],
    constraints_applied: data.constraints_applied ?? [],
    generator_version: data.generator_version,
    scoring_version: data.scoring_version,
    daily_condition_snapshot: data.daily_condition_snapshot,
    plan_hash: data.plan_hash ?? '',
  } as DayPlanRow;
}
