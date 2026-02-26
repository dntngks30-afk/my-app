/**
 * MOVE RE - 7-Day Dynamic Routine Generator (Deep V2)
 *
 * Selects safe exercises from exercise_templates (DB) based on DeepV2ExtendedResult.
 * Rule 2: No empty days — fallback to M01/M28.
 *
 * @module workout-routine/deep-v2-generator
 */

import type { DeepV2ExtendedResult } from '@/lib/deep-test/scoring/deep_v2';
import { getAllExerciseTemplates } from './exercise-templates-db';
import type { ExerciseTemplate } from './exercise-templates';
import {
  applySafetyFilter,
  applyLevelFilter,
  scoreByFocusTags,
} from './strategies/filter-strategy';

const FALLBACK_IDS = ['M01', 'M28'] as const;

/**
 * One day of the 7-day routine.
 */
export interface WorkoutDay {
  dayNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  exercises: ExerciseTemplate[];
  totalDuration: number;
  focus: string[];
  notes?: string;
}

/** Theme tags for each day to guide selection */
const DAY_THEMES: ReadonlyArray<{
  primaryTags: readonly string[];
  secondaryTags?: readonly string[];
  levelFilter?: number;
}> = [
  // Day 1: Baseline Reset
  {
    primaryTags: ['core_control', 'full_body_reset'],
    secondaryTags: ['core_stability'],
    levelFilter: 1,
  },
  // Day 2: Primary Mobility
  { primaryTags: [] },
  // Day 3: Core & Stability
  {
    primaryTags: ['core_stability', 'core_control', 'global_core'],
    secondaryTags: ['lower_chain_stability', 'glute_medius'],
  },
  // Day 4: Primary Activation
  { primaryTags: [] },
  // Day 5: Integration
  { primaryTags: [] },
  // Day 6: Full Body Flow
  {
    primaryTags: ['full_body_reset', 'core_stability'],
    secondaryTags: ['lower_chain_stability'],
  },
  // Day 7: Active Recovery
  {
    primaryTags: ['full_body_reset', 'basic_balance'],
    levelFilter: 1,
  },
];

/**
 * Select 2–3 exercises for a day from the safe pool.
 * Prefer templates matching theme tags; use fallbacks if empty.
 */
function selectForDay(
  safePool: ExerciseTemplate[],
  fallbacks: ExerciseTemplate[],
  theme: (typeof DAY_THEMES)[number],
  userFocusTags: readonly string[],
  userLevel: number,
  usedIds: Set<string>
): ExerciseTemplate[] {
  const levelFilter = theme.levelFilter ?? userLevel;
  let pool = safePool.filter((t) => t.level <= levelFilter);
  pool = pool.filter((t) => !usedIds.has(t.id));

  // For Day 2 & 4: use user's focus_tags as theme
  const themeTags =
    theme.primaryTags.length > 0
      ? theme.primaryTags
      : [...userFocusTags];

  // Score by theme/focus match
  const setTheme = new Set([
    ...themeTags,
    ...(theme.secondaryTags ?? []),
  ]);
  const scored = scoreByFocusTags(pool, [...setTheme]);

  // Take top 2–3, avoid duplicates
  const selected: ExerciseTemplate[] = [];
  const targetCount = 3;
  for (const t of scored) {
    if (selected.length >= targetCount) break;
    if (usedIds.has(t.id)) continue;
    selected.push(t);
    usedIds.add(t.id);
  }

  // Rule 2: If empty, inject fallbacks
  if (selected.length === 0) {
    for (const fb of fallbacks) {
      if (selected.length >= 2) break;
      selected.push(fb);
      usedIds.add(fb.id);
    }
  }

  return selected;
}

/**
 * Calculate total duration (estimated 5 min per exercise).
 */
function computeDuration(exercises: ExerciseTemplate[]): number {
  return exercises.length * 5;
}

/**
 * Generate a 7-day routine from DeepV2ExtendedResult.
 *
 * 1. Fetch templates from DB (exercise_templates).
 * 2. Apply safety filter (no avoid_tags intersection).
 * 3. Apply level filter (template.level <= user.level).
 * 4. For each day, select 2–3 exercises by theme.
 * 5. Fallback: inject M01 and M28 if a day is empty.
 *
 * @param userResult - DeepV2ExtendedResult from calculateDeepV2
 * @returns Exactly 7 WorkoutDay objects
 */
export async function generate7DayRoutine(
  userResult: DeepV2ExtendedResult
): Promise<WorkoutDay[]> {
  const { level, focus_tags, avoid_tags } = userResult;
  const userLevel = Math.max(1, Math.min(3, level));

  const templates = await getAllExerciseTemplates({ scoringVersion: 'deep_v2' });
  const fallbacks = templates.filter((t) =>
    (FALLBACK_IDS as readonly string[]).includes(t.id)
  );

  // Step 1: Safety filter (Rule 1)
  let safePool = applySafetyFilter(templates, avoid_tags);

  // Step 2: Level filter
  safePool = applyLevelFilter(safePool, userLevel);

  // If pool empty after safety (edge case), include fallbacks only
  if (safePool.length === 0) {
    safePool = [...fallbacks];
  }

  const usedIds = new Set<string>();
  const routine: WorkoutDay[] = [];

  for (let day = 0; day < 7; day++) {
    const theme = DAY_THEMES[day];
    const exercises = selectForDay(
      safePool,
      fallbacks,
      theme,
      focus_tags,
      userLevel,
      usedIds
    );

    routine.push({
      dayNumber: (day + 1) as WorkoutDay['dayNumber'],
      exercises,
      totalDuration: computeDuration(exercises),
      focus: theme.primaryTags.length > 0 ? [...theme.primaryTags] : [...focus_tags],
      notes: getDayNotes(day + 1),
    });
  }

  return routine;
}

/**
 * Optional day-specific notes.
 */
function getDayNotes(day: number): string {
  const notes: Record<number, string> = {
    1: '천천히 시작하세요. 호흡에 집중하세요.',
    7: '활동 회복. 가벼운 동작으로 마무리하세요.',
  };
  return notes[day] ?? '';
}
