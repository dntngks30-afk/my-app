import { getCache, invalidateCache, setCache } from '@/lib/cache/tabDataCache';
import { getSessionSafe } from '@/lib/supabase';
import type { JourneySummaryResponse } from '@/lib/journey/types';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: { code: string; message: string } };

const CACHE_KEY = 'journey.summary';

let journeySummaryInflight: Promise<ApiResult<JourneySummaryResponse>> | null = null;
let journeySummaryOwnerKey: string | null = null;

function ensureJourneyOwner(owner: string): void {
  if (journeySummaryOwnerKey !== owner) {
    journeySummaryOwnerKey = owner;
    invalidateCache(CACHE_KEY);
    journeySummaryInflight = null;
  }
}

export function getJourneySummaryCacheSnapshot(): JourneySummaryResponse | null {
  return getCache<JourneySummaryResponse>(CACHE_KEY);
}

export async function getCachedJourneySummary(): Promise<ApiResult<JourneySummaryResponse>> {
  const { session } = await getSessionSafe();
  const owner = session?.user?.id ?? 'anon';
  ensureJourneyOwner(owner);

  const token = session?.access_token;
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: { code: 'AUTH_REQUIRED', message: 'Login is required.' },
    };
  }

  const cached = getCache<JourneySummaryResponse>(CACHE_KEY);
  if (cached) return { ok: true, data: cached };

  if (journeySummaryInflight) return journeySummaryInflight;

  journeySummaryInflight = (async () => {
    try {
      const res = await fetch('/api/journey/summary', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        const rawError = body?.error as Record<string, unknown> | undefined;
        return {
          ok: false as const,
          status: res.status,
          error: {
            code: typeof rawError?.code === 'string' ? rawError.code : 'UNKNOWN',
            message:
              typeof rawError?.message === 'string'
                ? rawError.message
                : res.statusText || 'Failed to load journey summary.',
          },
        };
      }

      const data = body as JourneySummaryResponse;
      setCache(CACHE_KEY, data);
      return { ok: true as const, data };
    } catch (err) {
      return {
        ok: false as const,
        status: 0,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network error.',
        },
      };
    } finally {
      journeySummaryInflight = null;
    }
  })();

  return journeySummaryInflight;
}

export function prefetchJourneySummary(): void {
  void getCachedJourneySummary().catch(() => {});
}
