/**
 * HOTFIX: Exercise log identity — plan_item_key SSOT
 *
 * templateId-only matching is legacy fallback.
 * New paths must provide plan_item_key for accurate 1:1 matching.
 */

/** Stable plan item identity. Same format as session-exercise-events. */
export function buildPlanItemKey(
  segmentIndex: number,
  itemIndex: number,
  templateId: string
): string {
  return `${segmentIndex}:${itemIndex}:${templateId}`;
}

export type PlanSegmentItem = {
  templateId?: string;
  name?: string;
  order?: number;
  sets?: number;
  reps?: number;
  hold_seconds?: number;
};

export type PlanSegment = {
  title?: string;
  items?: PlanSegmentItem[];
};

/**
 * Build exercise_logs with plan_item_key from plan segments.
 * Use for complete payload — ensures identity for evidence gate.
 */
export function buildCompletionExerciseLogsWithIdentity(
  segments: PlanSegment[] | undefined,
  getLogForItem: (segIdx: number, itemIdx: number, item: PlanSegmentItem) => {
    templateId: string;
    name: string;
    sets: number | null;
    reps: number | null;
    difficulty?: number | null;
    rpe?: number | null;
    discomfort?: number | null;
  } | null
): Array<{
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
  rpe?: number | null;
  discomfort?: number | null;
  plan_item_key: string;
  segment_index: number;
  item_index: number;
}> {
  const result: Array<{
    templateId: string;
    name: string;
    sets: number | null;
    reps: number | null;
    difficulty: number | null;
    rpe?: number | null;
    discomfort?: number | null;
    plan_item_key: string;
    segment_index: number;
    item_index: number;
  }> = [];
  if (!segments?.length) return result;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]!;
    for (let itemIdx = 0; itemIdx < (seg.items ?? []).length; itemIdx++) {
      const item = seg.items![itemIdx]!;
      const tid = item.templateId ?? '';
      const log = getLogForItem(segIdx, itemIdx, item);
      if (!log) continue;
      result.push({
        ...log,
        plan_item_key: buildPlanItemKey(segIdx, itemIdx, tid),
        segment_index: segIdx,
        item_index: itemIdx,
      });
    }
  }
  return result;
}
