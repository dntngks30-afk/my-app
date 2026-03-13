/**
 * HOTFIX: Exercise log identity — plan_item_key SSOT
 *
 * plan_item_key is the SSOT for session item identity.
 * templateId-only / legacy keys are read-only fallback.
 * New code must use plan_item_key; do not create segTitle/order/templateId keys.
 */

/** Stable plan item identity. Format: segmentIndex:itemIndex:templateId */
export function buildPlanItemKey(
  segmentIndex: number,
  itemIndex: number,
  templateId: string
): string {
  return `${segmentIndex}:${itemIndex}:${templateId}`;
}

/**
 * Get checked/draft key for a plan item. SSOT — use this instead of segTitle/order/templateId.
 */
export function getCheckedItemKey(
  segmentIndex: number,
  itemIndex: number,
  templateId: string
): string {
  return buildPlanItemKey(segmentIndex, itemIndex, templateId);
}

/**
 * Legacy key format: segTitle_order_templateId. Used only for read fallback.
 * @returns true if key looks like legacy format (contains underscore, no colon)
 */
export function isLegacyItemKey(key: string): boolean {
  return key.includes('_') && !key.includes(':');
}

/**
 * Try to derive plan_item_key from legacy key. Requires plan segments to resolve.
 * Returns key as-is if already plan_item_key format (contains :), or null if cannot resolve.
 */
export function normalizeLegacyItemKey(
  key: string,
  segments: PlanSegment[] | undefined
): string | null {
  if (!key) return null;
  if (key.includes(':') && key.split(':').length >= 3) return key;
  if (!segments?.length) return null;
  const parts = key.split('_');
  if (parts.length < 3) return null;
  const [segTitle, orderStr, templateId] = parts;
  const order = parseInt(orderStr ?? '', 10);
  if (isNaN(order) || !templateId) return null;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx]!;
    const title = (seg.title === 'Accessory' ? 'Main' : seg.title) ?? '';
    if (title !== segTitle) continue;
    const items = seg.items ?? [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      const it = items[itemIdx]!;
      if ((it.order ?? itemIdx) === order && (it.templateId ?? '') === templateId) {
        return buildPlanItemKey(segIdx, itemIdx, templateId);
      }
    }
  }
  return null;
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
