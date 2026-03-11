/**
 * Session plan generation cache — deterministic inputs only.
 * Reduces regeneration cost on retry (e.g. network failure).
 * Cache key includes userId, sessionNumber, and all generation inputs.
 * TTL 10min, max 50 entries. Serverless-safe (memory resets on cold start).
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;

type PlanJson = Record<string, unknown>;

interface CacheEntry {
  plan: PlanJson;
  createdAt: number;
}

const store = new Map<string, CacheEntry>();

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return String(h >>> 0);
}

export type GenCacheInput = {
  userId: string;
  sessionNumber: number;
  totalSessions: number;
  phase: number;
  theme: string;
  timeBudget: string;
  conditionMood: string;
  focus: string[];
  avoid: string[];
  painFlags: string[];
  usedTemplateIds: string[];
  adaptiveOverlay?: Record<string, unknown>;
  /** PR-C: volume modifier from session_adaptive_summaries */
  volumeModifier?: number;
  /** PR-ALG-03: deep_v3 priority/pain (cache key에 포함) */
  priority_vector?: Record<string, number> | null;
  pain_mode?: string | null;
};

function buildKey(input: GenCacheInput): string {
  const canonical = JSON.stringify({
    u: input.userId,
    sn: input.sessionNumber,
    ts: input.totalSessions,
    p: input.phase,
    th: input.theme,
    tb: input.timeBudget,
    cm: input.conditionMood,
    f: [...input.focus].sort(),
    a: [...input.avoid].sort(),
    pf: [...input.painFlags].sort(),
    ut: [...input.usedTemplateIds].sort(),
    ao: input.adaptiveOverlay ? JSON.stringify(input.adaptiveOverlay) : '',
    vm: input.volumeModifier ?? '',
    pv: input.priority_vector ? JSON.stringify(input.priority_vector) : '',
    pm: input.pain_mode ?? '',
  });
  return simpleHash(canonical);
}

function evictIfNeeded(): void {
  if (store.size < MAX_ENTRIES) return;
  const now = Date.now();
  const expired = [...store.entries()].filter(([, e]) => e.createdAt + TTL_MS < now);
  for (const [k] of expired) store.delete(k);
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
}

/** Get cached plan if key exists and not expired. */
export function getCachedPlan(input: GenCacheInput): PlanJson | null {
  const key = buildKey(input);
  const entry = store.get(key);
  if (!entry || entry.createdAt + TTL_MS < Date.now()) return null;
  return entry.plan;
}

/** Store plan after successful generation. */
export function setCachedPlan(input: GenCacheInput, plan: PlanJson): void {
  evictIfNeeded();
  const key = buildKey(input);
  store.set(key, { plan, createdAt: Date.now() });
}
