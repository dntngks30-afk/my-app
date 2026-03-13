/**
 * PR-TECH-23: Session domain types — SSOT for identity, completion, event flows.
 *
 * Role-based type separation:
 * - ExerciseLogItem: base (client/API contract, legacy-compatible)
 * - ExerciseLogItemWithIdentity: completion payload (plan_item_key required)
 * - SessionPlanItemIdentity: plan item identity tuple
 * - SessionCompletionStateMap: checked/draft state
 */

/** Plan item identity. Format: segmentIndex:itemIndex:templateId */
export type SessionPlanItemIdentity = {
  plan_item_key: string;
  segment_index: number;
  item_index: number;
  templateId: string;
};

/**
 * Base exercise log item. Used for client/API, draft, display.
 * plan_item_key/segment_index/item_index are optional for legacy fallback.
 */
export type ExerciseLogItem = {
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
  rpe?: number | null;
  discomfort?: number | null;
  /** SSOT: segmentIndex:itemIndex:templateId. Required for new writes; optional for legacy read. */
  plan_item_key?: string;
  segment_index?: number;
  item_index?: number;
};

/**
 * Exercise log with required identity. Use for completion payload, evidence gate.
 */
export type ExerciseLogItemWithIdentity = ExerciseLogItem & {
  plan_item_key: string;
  segment_index: number;
  item_index: number;
};

/** Checked/draft state map. Key: plan_item_key (canonical). */
export type SessionCompletionStateMap = Record<string, boolean | undefined>;

/** Legacy draft key migration observability */
export type LegacyDraftKeyMigrationMeta = {
  legacy_checked_key_hits: number;
  legacy_checked_key_migrated: number;
  legacy_checked_key_unresolved: number;
  unresolved_legacy_keys: string[];
};
