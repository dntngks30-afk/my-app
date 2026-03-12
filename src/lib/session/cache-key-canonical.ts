/**
 * PR-04: Canonical serialization for session generation cache keys.
 * Ensures same semantic inputs produce identical keys regardless of object key order.
 * Use for: adaptiveOverlay, priority_vector, and other object-like cache inputs.
 */

/**
 * Canonicalize a value for cache key hashing.
 * - Objects: keys sorted recursively
 * - Arrays of strings: deduped + sorted (set-like)
 * - Arrays of numbers: deduped + sorted
 * - Other arrays: order preserved, elements canonicalized
 * - Primitives: stable JSON representation
 */
export function canonicalizeForCacheKey(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const first = value[0];
    if (typeof first === 'string') {
      return JSON.stringify([...new Set(value as string[])].sort());
    }
    if (typeof first === 'number') {
      return JSON.stringify([...new Set(value as number[])].sort((a, b) => a - b));
    }
    return '[' + (value as unknown[]).map(canonicalizeForCacheKey).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalizeForCacheKey(obj[k]));
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * Canonicalize object-only (for adaptiveOverlay, priority_vector).
 * Returns empty string for null/undefined.
 */
export function canonicalizeObject(obj: Record<string, unknown> | null | undefined): string {
  if (obj == null || Object.keys(obj).length === 0) return '';
  return canonicalizeForCacheKey(obj);
}
