/**
 * PR-LEGACY-DISPLAY-BACKFILL-03 — Idempotent meta patches for session_plans.plan_json.meta display fields.
 * Uses resolveSessionDisplayContract (same derivation family as read paths). Runtime app routes do not import this.
 */

import { resolveSessionDisplayContract, type SessionDisplayContract } from './session-display-contract';

const DISPLAY_KEYS: (keyof SessionDisplayContract)[] = [
  'session_role_code',
  'session_role_label',
  'session_goal_code',
  'session_goal_label',
  'session_goal_hint',
];

export function hasExplicitDisplayString(meta: Record<string, unknown>, key: string): boolean {
  const v = meta[key];
  return typeof v === 'string' && v.trim().length > 0;
}

/** True if plan_json.meta is an object and at least one of the five display fields is missing. */
export function needsSessionDisplayBackfill(meta: unknown): boolean {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const m = meta as Record<string, unknown>;
  return DISPLAY_KEYS.some((k) => !hasExplicitDisplayString(m, k));
}

/**
 * Only fills keys that are not explicitly set (non-empty trimmed string) on meta.
 * Resolution input matches batch/plan-summary: meta + session_number row.
 */
export function computeSessionDisplayMetaPatches(
  meta: Record<string, unknown> | null | undefined,
  sessionNumber: number
): Partial<SessionDisplayContract> {
  const base =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {};
  const metaForResolve: Record<string, unknown> = { ...base, session_number: sessionNumber };
  const resolved = resolveSessionDisplayContract(metaForResolve);
  const patches: Partial<SessionDisplayContract> = {};

  for (const key of DISPLAY_KEYS) {
    if (hasExplicitDisplayString(base, key)) continue;
    const val = resolved[key];
    if (typeof val === 'string' && val.trim()) {
      patches[key] = val.trim();
    }
  }
  return patches;
}

/** Shallow-merge patches into plan_json.meta only; segments and other meta keys preserved. */
export function applyDisplayPatchesToPlanJson(
  planJson: unknown,
  patches: Partial<SessionDisplayContract>
): unknown {
  if (Object.keys(patches).length === 0) return planJson;
  if (!planJson || typeof planJson !== 'object' || Array.isArray(planJson)) {
    return planJson;
  }
  const pj = planJson as Record<string, unknown>;
  const meta =
    pj.meta && typeof pj.meta === 'object' && !Array.isArray(pj.meta)
      ? { ...(pj.meta as Record<string, unknown>) }
      : {};
  return {
    ...pj,
    meta: { ...meta, ...patches },
  };
}
