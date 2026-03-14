/**
 * PR-RESET-02: Deterministic request fingerprint for idempotency.
 * method + route_key + normalized payload + user_id → sha256 hash.
 */

import { createHash } from 'crypto';

function normalizeValue(v: unknown): unknown {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object' || Array.isArray(v) || v instanceof Date) return v;
  return normalizeObj(v as Record<string, unknown>);
}

function normalizeObj(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = normalizeValue(obj[k]);
    if (v === undefined) continue;
    sorted[k] = v;
  }
  return sorted;
}

/**
 * Normalize payload for deterministic fingerprint.
 * Sorts keys, strips undefined, recursively normalizes nested objects.
 */
export function normalizeBody(body: Record<string, unknown>): string {
  return JSON.stringify(normalizeObj(body));
}

/**
 * Build fingerprint hash from method, route_key, payload, user_id.
 * payload: for start = body; for apply = { flow_id }.
 */
export function buildFingerprintHash(params: {
  method: string;
  routeKey: string;
  payload: Record<string, unknown>;
  userId: string;
}): string {
  const { method, routeKey, payload, userId } = params;
  const normalized = normalizeBody(payload);
  const raw = `${method}:${routeKey}:${userId}:${normalized}`;
  return createHash('sha256').update(raw).digest('hex');
}
