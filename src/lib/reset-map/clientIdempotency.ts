/**
 * PR-RESET-05: Client-side idempotency key manager.
 * Stable key per logical intent. Same key for retries/refresh/resume.
 */

const PREFIX = 'moveRe:resetMap:key:';

function getStorageKey(intent: string): string {
  return `${PREFIX}${intent}`;
}

/**
 * Get or create stable idempotency key for intent.
 * Same intent → same key across retries/refresh.
 */
export function getIdempotencyKey(intent: 'start' | 'apply'): string {
  if (typeof window === 'undefined') {
    return `server-${intent}-${Date.now()}`;
  }
  try {
    const key = getStorageKey(intent);
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = `client-${intent}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return `client-${intent}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Clear apply key after successful apply.
 */
export function clearApplyKey(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(getStorageKey('apply'));
  } catch {
    // ignore
  }
}

/**
 * Reset start key when starting a new flow (call after clearing active flow).
 */
export function resetStartKey(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(getStorageKey('start'));
  } catch {
    // ignore
  }
}
