/**
 * HOTFIX: Exercise log identity — plan_item_key SSOT
 *
 * plan_item_key is the SSOT for session item identity.
 * templateId-only / legacy keys are read-only fallback.
 * New code must use plan_item_key; do not create segTitle/order/templateId keys.
 *
 * PR-RISK-07: legacy draft key support is temporary read-only fallback.
 * New writes must use plan_item_key. Remove bridge after legacy hit rate approaches zero.
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

/** Canonical plan_item_key format: segmentIndex:itemIndex:templateId */
export const PLAN_ITEM_KEY_FORMAT_REGEX = /^\d+:\d+:.+$/;

/**
 * PR-RISK-07: Assert key is valid for new write. New writes must use plan_item_key only.
 * @returns true if key is canonical format (safe to write)
 */
export function isPlanItemKeyFormat(key: string): boolean {
  return !!key && PLAN_ITEM_KEY_FORMAT_REGEX.test(key);
}

/**
 * PR-RISK-07: Assert key before write. Rejects legacy keys.
 * Use for draft/checked save paths. Returns false for legacy; do not write.
 */
export function assertPlanItemKeyForWrite(key: string): boolean {
  return isPlanItemKeyFormat(key);
}

/**
 * PR-RISK-07: Filter checked for save. Only canonical keys are persisted.
 * Legacy keys are migrated when segments provided; unresolved are dropped (logged in dev).
 */
export function filterCheckedForSave(
  checked: Record<string, boolean>,
  segments: PlanSegment[] | undefined
): { filtered: Record<string, boolean>; meta: ReturnType<typeof buildLegacyDraftMigrationMeta> } {
  const keys = Object.keys(checked);
  const meta = buildLegacyDraftMigrationMeta(keys, segments);
  const filtered: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(checked)) {
    const canonical = isPlanItemKeyFormat(key)
      ? key
      : normalizeLegacyItemKey(key, segments);
    if (canonical) filtered[canonical] = val;
  }
  return { filtered, meta };
}

/**
 * PR-RISK-07: Build observability meta for legacy draft migration.
 * legacy_checked_key_hits: keys that were legacy format
 * legacy_checked_key_migrated: legacy keys successfully normalized
 * legacy_checked_key_unresolved: legacy keys that could not be resolved
 */
export function buildLegacyDraftMigrationMeta(
  keys: string[],
  segments: PlanSegment[] | undefined
): {
  legacy_checked_key_hits: number;
  legacy_checked_key_migrated: number;
  legacy_checked_key_unresolved: number;
  unresolved_legacy_keys: string[];
} {
  let hits = 0;
  let migrated = 0;
  let unresolved = 0;
  const unresolvedKeys: string[] = [];
  for (const key of keys) {
    if (isPlanItemKeyFormat(key)) continue;
    if (!isLegacyItemKey(key)) {
      unresolved++;
      unresolvedKeys.push(key);
      continue;
    }
    hits++;
    const canonical = normalizeLegacyItemKey(key, segments);
    if (canonical) migrated++;
    else {
      unresolved++;
      unresolvedKeys.push(key);
    }
  }
  return {
    legacy_checked_key_hits: hits,
    legacy_checked_key_migrated: migrated,
    legacy_checked_key_unresolved: unresolved,
    unresolved_legacy_keys: unresolvedKeys,
  };
}

/**
 * PR-RISK-06: Legacy event identity formats (seg{N}-item{M}, log{N}).
 * Used only for read/normalize fallback. New writes use plan_item_key.
 */
export function isLegacyEventItemKey(key: string): boolean {
  if (!key) return false;
  if (PLAN_ITEM_KEY_FORMAT_REGEX.test(key)) return false;
  return /^seg\d+-item\d+$/.test(key) || /^log\d+$/.test(key);
}

/**
 * PR-RISK-06: Normalize legacy event plan_item_key to canonical format.
 * seg{N}-item{M} + templateId → segmentIndex:itemIndex:templateId.
 * log{N} cannot be resolved; returns null.
 */
export function normalizeLegacyEventItemIdentity(
  key: string,
  templateId: string
): string | null {
  if (!key) return null;
  if (PLAN_ITEM_KEY_FORMAT_REGEX.test(key)) return key;
  const segMatch = /^seg(\d+)-item(\d+)$/.exec(key);
  if (segMatch) {
    return buildPlanItemKey(parseInt(segMatch[1]!, 10), parseInt(segMatch[2]!, 10), templateId);
  }
  return null;
}

/**
 * PR-RISK-06: Resolve event plan_item_key to canonical form for analysis/replay.
 * Use plan_item_key when canonical; normalize legacy (seg{N}-item{M}) when templateId available.
 */
export function resolveEventPlanItemKey(
  planItemKey: string,
  templateId: string
): string {
  const normalized = normalizeLegacyEventItemIdentity(planItemKey, templateId);
  return normalized ?? planItemKey;
}

/**
 * PR-RISK-06: Debug meta for event identity observability.
 */
export function buildEventIdentityDebugMeta(rows: Array<{ plan_item_key: string; template_id?: string }>): {
  written_with_plan_item_key_count: number;
  legacy_event_identity_fallback_count: number;
  unresolved_event_identity_count: number;
} {
  let canonical = 0;
  let legacy = 0;
  for (const r of rows) {
    const key = r.plan_item_key;
    if (PLAN_ITEM_KEY_FORMAT_REGEX.test(key)) canonical++;
    else if (/^log\d+$/.test(key)) legacy++;
  }
  return {
    written_with_plan_item_key_count: canonical,
    legacy_event_identity_fallback_count: legacy,
    unresolved_event_identity_count: rows.length - canonical - legacy,
  };
}

/**
 * Try to derive plan_item_key from legacy key. Requires plan segments to resolve.
 * Returns key as-is if already plan_item_key format (contains :), or null if cannot resolve.
 *
 * @deprecated PR-RISK-07: Temporary read-only fallback. Do not use for new writes.
 * Remove bridge after legacy hit rate approaches zero.
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
