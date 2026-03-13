/**
 * PR-FIRST-SESSION: Volume Clamp
 *
 * Enforces max exercises, sets, session time.
 */

import type { PlanSegment, PlanItem } from '@/lib/session/plan-generator';
import { VOLUME_LIMITS } from './guardrailRules';

/** Segment titles */
const MAIN_TITLE = 'Main';
const PREP_TITLE = 'Prep';
const ACCESSORY_TITLE = 'Accessory';
const COOLDOWN_TITLE = 'Cooldown';

export function countTotalExercises(segments: PlanSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.items.length, 0);
}

export function countMainExercises(segments: PlanSegment[]): number {
  const main = segments.find((s) => s.title === MAIN_TITLE);
  return main?.items.length ?? 0;
}

export function countTotalSets(segments: PlanSegment[]): number {
  let total = 0;
  for (const seg of segments) {
    for (const item of seg.items) {
      total += item.sets ?? (item.hold_seconds ? 1 : 2);
    }
  }
  return total;
}

export function estimateSessionTimeMinutes(segments: PlanSegment[]): number {
  return segments.reduce((sum, seg) => sum + (seg.duration_sec ?? 0), 0) / 60;
}

/** Returns true if plan exceeds volume limits */
export function exceedsVolumeLimits(segments: PlanSegment[]): boolean {
  const total = countTotalExercises(segments);
  const mainCount = countMainExercises(segments);
  const totalSets = countTotalSets(segments);
  const timeMin = estimateSessionTimeMinutes(segments);

  return (
    total > VOLUME_LIMITS.max_exercises ||
    mainCount > VOLUME_LIMITS.max_main_exercises ||
    totalSets > VOLUME_LIMITS.max_total_sets ||
    timeMin > VOLUME_LIMITS.max_session_time_minutes
  );
}

/**
 * Reduce exercises to meet limits. Removes lowest priority (Cooldown last items, then Accessory, then Main overflow).
 */
export function clampVolume(segments: PlanSegment[]): PlanSegment[] {
  const maxTotal = VOLUME_LIMITS.max_exercises;
  const maxMain = VOLUME_LIMITS.max_main_exercises;
  const maxSets = VOLUME_LIMITS.max_total_sets;
  const maxTimeMin = VOLUME_LIMITS.max_session_time_minutes;

  let result = segments.map((seg) => ({ ...seg, items: [...seg.items] }));

  // 1. Cap main exercises
  const mainIdx = result.findIndex((s) => s.title === MAIN_TITLE);
  if (mainIdx >= 0 && result[mainIdx].items.length > maxMain) {
    result[mainIdx].items = result[mainIdx].items.slice(0, maxMain);
  }

  // 2. Cap total exercises (remove from end: Cooldown → Accessory → Main → Prep)
  const orderToTrim = [COOLDOWN_TITLE, ACCESSORY_TITLE, MAIN_TITLE, PREP_TITLE];
  while (countTotalExercises(result) > maxTotal) {
    let trimmed = false;
    for (const title of orderToTrim) {
      const idx = result.findIndex((s) => s.title === title);
      if (idx < 0) continue;
      const minKeep = title === PREP_TITLE ? 1 : title === MAIN_TITLE ? maxMain : 0;
      if (result[idx].items.length > minKeep) {
        result[idx].items.pop();
        trimmed = true;
        break;
      }
    }
    if (!trimmed) break;
  }

  // 3. Cap total sets (reduce sets per exercise, prefer last items)
  while (countTotalSets(result) > maxSets) {
    let reduced = false;
    for (let si = result.length - 1; si >= 0 && !reduced; si--) {
      for (let ii = result[si].items.length - 1; ii >= 0 && !reduced; ii--) {
        const item = result[si].items[ii];
        const current = item.sets ?? (item.hold_seconds ? 1 : 2);
        if (current > 1) {
          (result[si].items[ii] as PlanItem).sets = Math.max(1, current - 1);
          reduced = true;
          break;
        }
      }
    }
    if (!reduced) break;
  }

  // 4. Cap session time (reduce duration_sec)
  let totalSec = result.reduce((s, seg) => s + (seg.duration_sec ?? 0), 0);
  const maxSec = maxTimeMin * 60;
  if (totalSec > maxSec) {
    const factor = maxSec / totalSec;
    result = result.map((seg) => ({
      ...seg,
      duration_sec: Math.max(60, Math.floor((seg.duration_sec ?? 120) * factor)),
    }));
  }

  return result;
}
