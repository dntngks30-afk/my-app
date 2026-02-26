/**
 * MOVE RE - Exercise Templates DB Client
 *
 * SSOT: exercise_templates table (Supabase)
 * Replaces static EXERCISE_TEMPLATES for 28→300 scaling.
 *
 * @module workout-routine/exercise-templates-db
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import type { ExerciseTemplate } from './exercise-templates';

/** DB row shape */
interface DbExerciseTemplate {
  id: string;
  name: string;
  level: number;
  focus_tags: string[];
  contraindications: string[];
  equipment?: string[];
  duration_sec?: number;
  media_ref: string | null;
  template_version: number;
  scoring_version: string;
  is_fallback: boolean;
  is_active: boolean;
}

function toExerciseTemplate(row: DbExerciseTemplate): ExerciseTemplate {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    focus_tags: row.focus_tags,
    avoid_tags: row.contraindications,
    videoUrl: row.media_ref,
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
 * Used by routine engine and APIs.
 */
export async function getAllExerciseTemplates(
  opts?: { scoringVersion?: string }
): Promise<ExerciseTemplate[]> {
  const supabase = getServerSupabaseAdmin();

  let q = supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,template_version,scoring_version,is_fallback,is_active')
    .eq('is_active', true)
    .order('id');

  if (opts?.scoringVersion) {
    q = q.eq('scoring_version', opts.scoringVersion);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`exercise_templates fetch failed: ${error.message}`);
  }

  return (data ?? []).map((row) => toExerciseTemplate(row as DbExerciseTemplate));
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
    .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,template_version,scoring_version,is_fallback,is_active')
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

/**
 * Get fallback templates (M01, M28) for empty days.
 */
export async function getFallbackTemplates(): Promise<ExerciseTemplate[]> {
  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,template_version,scoring_version,is_fallback,is_active')
    .eq('is_active', true)
    .eq('is_fallback', true)
    .order('id');

  if (error) {
    throw new Error(`exercise_templates fallbacks failed: ${error.message}`);
  }

  return (data ?? []).map((row) => toExerciseTemplate(row as DbExerciseTemplate));
}
