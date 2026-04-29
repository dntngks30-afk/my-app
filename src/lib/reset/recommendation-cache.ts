import { getCache, invalidateCache, setCache } from '@/lib/cache/tabDataCache';
import { fetchResetRecommendations } from '@/lib/reset/client';
import type {
  ResetApiResult,
  ResetRecommendationResponse,
} from '@/lib/reset/types';
import { supabaseBrowser } from '@/lib/supabase';

const CACHE_KEY = 'reset.recommendations';

let resetRecommendationsInflight: Promise<ResetApiResult<ResetRecommendationResponse>> | null = null;
let resetRecommendationsOwnerKey: string | null = null;

async function getResetOwnerKey(): Promise<string> {
  try {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    return session?.user?.id ?? 'anon';
  } catch {
    return 'anon';
  }
}

async function ensureResetOwner(): Promise<void> {
  const owner = await getResetOwnerKey();
  if (resetRecommendationsOwnerKey !== owner) {
    resetRecommendationsOwnerKey = owner;
    invalidateCache(CACHE_KEY);
    resetRecommendationsInflight = null;
  }
}

export function getResetRecommendationsCacheSnapshot(): ResetRecommendationResponse | null {
  return getCache<ResetRecommendationResponse>(CACHE_KEY);
}

export async function getCachedResetRecommendations(): Promise<
  ResetApiResult<ResetRecommendationResponse>
> {
  await ensureResetOwner();

  const cached = getCache<ResetRecommendationResponse>(CACHE_KEY);
  if (cached) return { ok: true, data: cached };

  if (resetRecommendationsInflight) return resetRecommendationsInflight;

  resetRecommendationsInflight = fetchResetRecommendations().then((result) => {
    resetRecommendationsInflight = null;
    if (result.ok) {
      setCache(CACHE_KEY, result.data);
    }
    return result;
  });

  return resetRecommendationsInflight;
}

export function prefetchResetRecommendations(): void {
  void getCachedResetRecommendations().catch(() => {});
}
