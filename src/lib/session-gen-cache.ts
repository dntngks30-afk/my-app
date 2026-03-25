/**
 * Session plan generation cache — deterministic inputs only.
 * Reduces regeneration cost on retry (e.g. network failure).
 * Cache key includes userId, sessionNumber, and all generation inputs.
 * TTL 10min, max 50 entries. Serverless-safe (memory resets on cold start).
 * PR-04: Uses canonical serialization for object-like fields (adaptiveOverlay, priority_vector).
 */

import { canonicalizeObject } from '@/lib/session/cache-key-canonical';

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
  /** PR-FIRST-SESSION-QUALITY-02A: session 1 onboarding experience — cache 분리 */
  exercise_experience_level?: string | null;
  /** PR-SURVEY-05: 설문 힌트(세션 1 bias) — 없으면 null/undefined */
  survey_session_hints?: Record<string, unknown> | null;
  /** PR-SURVEY-07: 카메라 병합 메타(관찰성·힌트와 함께 캐시 키) */
  session_camera_translation?: Record<string, unknown> | null;
};

/**
 * Build deterministic cache key. PR-04: canonical serialization for object-like fields.
 * - focus: order preserved (primary/secondary semantics)
 * - avoid, painFlags, usedTemplateIds: set-like, deduped + sorted
 * - adaptiveOverlay, priority_vector: key-sorted recursively (canonical)
 * - volumeModifier: undefined => ''; 0 and other numbers preserved (generator: undefined/0 both mean no reduction)
 */
function buildKey(input: GenCacheInput): string {
  const setLike = (arr: string[]) => JSON.stringify([...new Set(arr)].sort());
  const canonical = JSON.stringify({
    u: input.userId,
    sn: input.sessionNumber,
    ts: input.totalSessions,
    p: input.phase,
    th: input.theme,
    tb: input.timeBudget,
    cm: input.conditionMood,
    f: input.focus,
    a: setLike(input.avoid),
    pf: setLike(input.painFlags),
    ut: setLike(input.usedTemplateIds),
    ao: canonicalizeObject(input.adaptiveOverlay ?? undefined),
    vm: input.volumeModifier ?? '',
    pv: canonicalizeObject(input.priority_vector ?? undefined),
    pm: input.pain_mode ?? '',
    eel: input.exercise_experience_level ?? '',
    ssh:
      input.survey_session_hints != null
        ? canonicalizeObject(input.survey_session_hints as Record<string, unknown>)
        : '',
    sct:
      input.session_camera_translation != null
        ? canonicalizeObject(input.session_camera_translation as Record<string, unknown>)
        : '',
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
