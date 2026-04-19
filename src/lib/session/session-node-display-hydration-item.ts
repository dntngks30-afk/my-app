/**
 * Shared compact node display item builder (same derivation family as read paths).
 * Used by /api/session/node-display-batch, home bundle, and /api/home/active-lite.
 */

import {
  extractCanonicalDisplayFamilyPassThrough,
  resolveSessionDisplayContract,
} from '@/lib/session/session-display-contract';
import type { SessionNodeDisplayHydrationItem } from '@/lib/session/client';

export function buildSessionNodeDisplayHydrationItem(
  sessionNumber: number,
  meta: Record<string, unknown> | null | undefined
): SessionNodeDisplayHydrationItem {
  if (!meta || typeof meta !== 'object') {
    return { session_number: sessionNumber };
  }
  const metaForResolve: Record<string, unknown> = { ...meta, session_number: sessionNumber };
  const c = resolveSessionDisplayContract(metaForResolve);
  const canonicalPass = extractCanonicalDisplayFamilyPassThrough(meta);
  const priority_vector =
    meta.priority_vector &&
    typeof meta.priority_vector === 'object' &&
    meta.priority_vector !== null &&
    !Array.isArray(meta.priority_vector)
      ? (meta.priority_vector as Record<string, number>)
      : undefined;

  const cf =
    meta.constraint_flags &&
    typeof meta.constraint_flags === 'object' &&
    meta.constraint_flags !== null &&
    !Array.isArray(meta.constraint_flags)
      ? (meta.constraint_flags as Record<string, unknown>)
      : undefined;

  return {
    session_number: sessionNumber,
    ...(c.session_role_code && { session_role_code: c.session_role_code }),
    ...(c.session_role_label && { session_role_label: c.session_role_label }),
    ...(c.session_goal_code && { session_goal_code: c.session_goal_code }),
    ...(c.session_goal_label && { session_goal_label: c.session_goal_label }),
    ...(c.session_goal_hint && { session_goal_hint: c.session_goal_hint }),
    ...('session_rationale' in canonicalPass
      ? { session_rationale: canonicalPass.session_rationale ?? null }
      : {}),
    ...(canonicalPass.session_focus_axes !== undefined
      ? { session_focus_axes: canonicalPass.session_focus_axes }
      : {}),
    ...(priority_vector ? { priority_vector } : {}),
    ...(meta.pain_mode === 'none' ||
    meta.pain_mode === 'caution' ||
    meta.pain_mode === 'protected'
      ? { pain_mode: meta.pain_mode }
      : {}),
    ...(Array.isArray(meta.focus) && meta.focus.length > 0 ? { focus: meta.focus as string[] } : {}),
    ...(typeof meta.primary_type === 'string' && meta.primary_type.trim()
      ? { primary_type: meta.primary_type.trim() }
      : {}),
    ...(typeof meta.result_type === 'string' && meta.result_type.trim()
      ? { result_type: meta.result_type.trim() }
      : {}),
    ...(typeof meta.phase === 'number' && Number.isFinite(meta.phase) ? { phase: Math.floor(meta.phase) } : {}),
    ...(cf ? { constraint_flags: cf } : {}),
  };
}
