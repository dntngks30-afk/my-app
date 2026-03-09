/**
 * MOVE RE - Exercise Templates DB Client
 *
 * SSOT: exercise_templates table (Supabase)
 * Replaces static EXERCISE_TEMPLATES for 28→300 scaling.
 * 공용 템플릿만 캐시(개인 데이터 없음). TTL 120초.
 *
 * @module workout-routine/exercise-templates-db
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import type { ExerciseTemplate } from './exercise-templates';

/** DB row shape (최소 컬럼 + PR-ALG-04 메타) */
interface DbExerciseTemplate {
  id: string;
  name: string;
  level: number;
  focus_tags: string[];
  contraindications: string[];
  media_ref: string | null;
  phase?: string | null;
  target_vector?: string[] | null;
  difficulty?: string | null;
  avoid_if_pain_mode?: string[] | null;
  progression_level?: number | null;
}

const TEMPLATE_CACHE_TTL_MS = 120_000; // 120초
const FALLBACK_CACHE_TTL_MS = 120_000;

let templateCache: { data: ExerciseTemplate[]; key: string; expiresAt: number } | null = null;
let fallbackCache: { data: ExerciseTemplate[]; expiresAt: number } | null = null;

function toExerciseTemplate(row: DbExerciseTemplate): ExerciseTemplate {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    focus_tags: row.focus_tags,
    avoid_tags: row.contraindications,
    videoUrl: row.media_ref,
    ...(row.phase && { phase: row.phase as ExerciseTemplate['phase'] }),
    ...(row.target_vector && row.target_vector.length > 0 && { target_vector: row.target_vector }),
    ...(row.difficulty && { difficulty: row.difficulty as ExerciseTemplate['difficulty'] }),
    ...(row.avoid_if_pain_mode && row.avoid_if_pain_mode.length > 0 && {
      avoid_if_pain_mode: row.avoid_if_pain_mode as ExerciseTemplate['avoid_if_pain_mode'],
    }),
    ...(row.progression_level != null && { progression_level: row.progression_level }),
  };
}

export interface ExerciseTemplatesFilter {
  scoringVersion?: string;
  maxLevel?: number;
  focusTags?: string[];
  avoidTags?: string[];
}

/**
 * Fetch all active exercise templates from DB.
 * 최소 컬럼 select + module-level 캐시(TTL 120초, 공용 데이터만).
 */
export async function getAllExerciseTemplates(
  opts?: { scoringVersion?: string }
): Promise<ExerciseTemplate[]> {
  const key = opts?.scoringVersion ?? 'default';
  const now = Date.now();
  if (templateCache && templateCache.key === key && templateCache.expiresAt > now) {
    return templateCache.data;
  }

  const supabase = getServerSupabaseAdmin();
  let q = supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,media_ref,phase,target_vector,difficulty,avoid_if_pain_mode,progression_level')
    .eq('is_active', true)
    .order('id');

  if (opts?.scoringVersion) {
    q = q.eq('scoring_version', opts.scoringVersion);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`exercise_templates fetch failed: ${error.message}`);
  }

  const result = (data ?? []).map((row) => toExerciseTemplate(row as DbExerciseTemplate));
  templateCache = { data: result, key, expiresAt: now + TEMPLATE_CACHE_TTL_MS };
  return result;
}

/** Minimal template row for media payload (id, name, media_ref, duration_sec) */
export interface TemplateForMedia {
  id: string;
  name: string;
  media_ref: unknown;
  duration_sec?: number;
}

/**
 * Fetch templates by ids for media payload (batch, minimal columns).
 */
export async function getTemplatesForMediaByIds(
  ids: string[]
): Promise<TemplateForMedia[]> {
  if (ids.length === 0) return [];
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from('exercise_templates')
    .select('id, name, media_ref, duration_sec')
    .in('id', ids)
    .eq('is_active', true);

  if (error) {
    throw new Error(`exercise_templates batch fetch failed: ${error.message}`);
  }
  return (data ?? []) as TemplateForMedia[];
}

/**
 * Fetch a single template by id.
 */
export async function getExerciseTemplateById(
  id: string
): Promise<ExerciseTemplate | null> {
  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,template_version,scoring_version,is_fallback,is_active,phase,target_vector,difficulty,avoid_if_pain_mode,progression_level')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`exercise_templates getById failed: ${error.message}`);
  }

  if (!data) return null;
  return toExerciseTemplate(data as DbExerciseTemplate);
}

/**
 * Fetch templates filtered for routine engine.
 * Applies safety + level filter in DB when possible.
 */
export async function getFilteredExerciseTemplates(
  filter: ExerciseTemplatesFilter
): Promise<ExerciseTemplate[]> {
  const all = await getAllExerciseTemplates({
    scoringVersion: filter.scoringVersion ?? 'deep_v2',
  });

  let pool = all;

  if (filter.maxLevel != null) {
    const level = Math.max(1, Math.min(3, Math.floor(filter.maxLevel)));
    pool = pool.filter((t) => t.level <= level);
  }

  if (filter.avoidTags && filter.avoidTags.length > 0) {
    const setAvoid = new Set(filter.avoidTags);
    pool = pool.filter(
      (t) => !t.avoid_tags.some((tag) => setAvoid.has(tag))
    );
  }

  return pool;
}

/** Session plan용 템플릿 row (duration_sec, is_fallback 포함 + PR-ALG-04 메타) */
export interface SessionTemplateRow {
  id: string;
  name: string;
  level: number;
  focus_tags: string[];
  contraindications: string[];
  duration_sec: number;
  media_ref: unknown;
  is_fallback: boolean;
  /** PR-ALG-04 */
  phase?: string | null;
  target_vector?: string[] | null;
  difficulty?: string | null;
  avoid_if_pain_mode?: string[] | null;
  progression_level?: number | null;
}

/**
 * Fetch templates for session plan generation.
 * limit 60, scoring_version='deep_v2'. 28→300 확장 대비.
 */
export async function getTemplatesForSessionPlan(opts?: {
  scoringVersion?: string;
}): Promise<SessionTemplateRow[]> {
  const supabase = getServerSupabaseAdmin();
  let q = supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,duration_sec,media_ref,is_fallback,phase,target_vector,difficulty,avoid_if_pain_mode,progression_level')
    .eq('is_active', true)
    .order('id')
    .limit(60);

  // deep_v3 uses same template pool as deep_v2 (templates have scoring_version='deep_v2')
  const templateScoringVersion =
    opts?.scoringVersion === 'deep_v3' ? 'deep_v2' : (opts?.scoringVersion ?? 'deep_v2');
  q = q.eq('scoring_version', templateScoringVersion);

  const { data, error } = await q;

  if (error) {
    throw new Error(`exercise_templates session plan fetch failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level ?? 1,
    focus_tags: row.focus_tags ?? [],
    contraindications: row.contraindications ?? [],
    duration_sec: row.duration_sec ?? 300,
    media_ref: row.media_ref ?? null,
    is_fallback: row.is_fallback ?? false,
    phase: row.phase ?? null,
    target_vector: row.target_vector ?? null,
    difficulty: row.difficulty ?? null,
    avoid_if_pain_mode: row.avoid_if_pain_mode ?? null,
    progression_level: row.progression_level ?? null,
  })) as SessionTemplateRow[];
}

/**
 * Get fallback templates (M01, M28) for empty days.
 * 캐시(TTL 120초) + 최소 컬럼.
 */
export async function getFallbackTemplates(): Promise<ExerciseTemplate[]> {
  const now = Date.now();
  if (fallbackCache && fallbackCache.expiresAt > now) {
    return fallbackCache.data;
  }

  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,media_ref,phase,target_vector,difficulty,avoid_if_pain_mode,progression_level')
    .eq('is_active', true)
    .eq('is_fallback', true)
    .order('id');

  if (error) {
    throw new Error(`exercise_templates fallbacks failed: ${error.message}`);
  }

  const result = (data ?? []).map((row) => toExerciseTemplate(row as DbExerciseTemplate));
  fallbackCache = { data: result, expiresAt: now + FALLBACK_CACHE_TTL_MS };
  return result;
}
