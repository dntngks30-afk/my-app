import { getCache, getCacheStale, invalidateCache, setCache } from '@/lib/cache/tabDataCache';
import type {
  ActivePlanSummary,
  ActiveSessionLiteResponse,
  HomeNodeDisplayBundle,
  SessionProgress,
} from '@/lib/session/client';
import type { NextSessionPreviewPayload } from '@/lib/session/next-session-preview';

type ApiError = {
  code: string;
  message: string;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiError };

export type AppBootstrapStatsPreview = {
  completed_sessions: number;
  weekly_streak: number;
};

export type AdaptiveExplanation = {
  title: string;
  message: string;
};

export type BootstrapResetMap = {
  active_flow: import('@/lib/reset-map/activeFlow').ResetMapFlowRow | null;
  should_start: boolean;
};

export type AppBootstrapResponse = {
  user: {
    id: string;
    plan_status: string | null;
  };
  session: {
    active_session: ActivePlanSummary | null;
    completed_sessions: number;
    total_sessions: number;
    today_completed?: boolean;
    next_unlock_at?: string | null;
  };
  next_session: NextSessionPreviewPayload | null;
  /** PR-ALG-15: Human-readable adaptive adjustment explanation */
  adaptive_explanation?: AdaptiveExplanation | null;
  stats_preview: AppBootstrapStatsPreview;
  /** PR-PERF-21: Reset Map active flow (removes latest/start waterfall) */
  reset_map?: BootstrapResetMap;
  /** PR4: compact map node display slice (canonical with /api/home/active-lite + node-display-batch family). */
  node_display_bundle?: HomeNodeDisplayBundle;
};

const TTL_MS = 5_000;
const APP_BOOTSTRAP_CACHE_VERSION = 1;

let bootstrapCache: { tokenKey: string; data: AppBootstrapResponse; expiresAt: number } | null = null;
let bootstrapInflight: Promise<ApiResult<AppBootstrapResponse>> | null = null;

type AppBootstrapCacheEnvelope = {
  version: number;
  data: AppBootstrapResponse;
};

function toTokenKey(token: string): string {
  return token && token.length >= 16 ? token.slice(-16) : token || '';
}

function isNextSessionPreviewPayload(value: unknown): value is NextSessionPreviewPayload {
  if (value == null) return true;
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.session_number === 'number' &&
    Array.isArray(candidate.focus_axes) &&
    typeof candidate.estimated_time === 'number' &&
    typeof candidate.exercise_count === 'number' &&
    (candidate.session_rationale === null || typeof candidate.session_rationale === 'string') &&
    Array.isArray(candidate.exercises_preview)
  );
}

function isAppBootstrapResponseLike(value: unknown): value is AppBootstrapResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const session = candidate.session as Record<string, unknown> | undefined;
  const user = candidate.user as Record<string, unknown> | undefined;
  const statsPreview = candidate.stats_preview as Record<string, unknown> | undefined;
  return (
    !!user &&
    typeof user.id === 'string' &&
    !!session &&
    typeof session.total_sessions === 'number' &&
    typeof session.completed_sessions === 'number' &&
    !!statsPreview &&
    typeof statsPreview.completed_sessions === 'number' &&
    typeof statsPreview.weekly_streak === 'number' &&
    isNextSessionPreviewPayload(candidate.next_session)
  );
}

function wrapAppBootstrapCache(data: AppBootstrapResponse): AppBootstrapCacheEnvelope {
  return {
    version: APP_BOOTSTRAP_CACHE_VERSION,
    data,
  };
}

function unwrapAppBootstrapCache(value: unknown): AppBootstrapResponse | null {
  if (!value) return null;
  if (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'data' in value
  ) {
    const envelope = value as { version?: unknown; data?: unknown };
    if (envelope.version !== APP_BOOTSTRAP_CACHE_VERSION) return null;
    return isAppBootstrapResponseLike(envelope.data) ? envelope.data : null;
  }
  return isAppBootstrapResponseLike(value) ? value : null;
}

function toActiveLite(data: AppBootstrapResponse): ActiveSessionLiteResponse {
  const progress: SessionProgress = {
    user_id: data.user.id,
    total_sessions: data.session.total_sessions,
    completed_sessions: data.session.completed_sessions,
    active_session_number: data.session.active_session?.session_number ?? null,
    last_completed_at: null,
    updated_at: '',
  };

  return {
    progress,
    active: data.session.active_session,
    today_completed: data.session.today_completed === true,
    ...(data.session.next_unlock_at ? { next_unlock_at: data.session.next_unlock_at } : {}),
    plan_status: data.user.plan_status,
  };
}

function storeBootstrapData(tokenKey: string, data: AppBootstrapResponse): void {
  bootstrapCache = { tokenKey, data, expiresAt: Date.now() + TTL_MS };
  setCache('app.bootstrap', wrapAppBootstrapCache(data));
  setCache('home.activeLite', toActiveLite(data));
}

export function getAppBootstrapCacheSnapshot(): AppBootstrapResponse | null {
  return unwrapAppBootstrapCache(getCache<unknown>('app.bootstrap'));
}

function getStaleAppBootstrapCacheSnapshot(): AppBootstrapResponse | null {
  return unwrapAppBootstrapCache(getCacheStale<unknown>('app.bootstrap'));
}

async function fetchAppBootstrap(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<AppBootstrapResponse>> {
  try {
    const path = opts?.debug ? '/api/app/bootstrap?debug=1' : '/api/app/bootstrap';
    const res = await fetch(path, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const rawError = body?.error as Record<string, unknown> | undefined;
      return {
        ok: false,
        status: res.status,
        error: {
          code: typeof rawError?.code === 'string' ? rawError.code : 'UNKNOWN',
          message:
            typeof rawError?.message === 'string'
              ? rawError.message
              : res.statusText || '요청에 실패했습니다.',
        },
      };
    }

    const data = (body?.ok === true && body?.data != null)
      ? (body.data as AppBootstrapResponse)
      : (body as AppBootstrapResponse);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : '네트워크 오류가 발생했습니다.',
      },
    };
  }
}

export async function getCachedAppBootstrap(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<AppBootstrapResponse>> {
  const key = toTokenKey(token);
  const now = Date.now();

  if (!opts?.debug && bootstrapCache && bootstrapCache.tokenKey === key && bootstrapCache.expiresAt > now) {
    return { ok: true, data: bootstrapCache.data };
  }
  if (!opts?.debug && bootstrapInflight) {
    return bootstrapInflight;
  }

  const stale = !opts?.debug ? getStaleAppBootstrapCacheSnapshot() : null;
  if (stale) {
    const revalidate = fetchAppBootstrap(token).then((result) => {
      bootstrapInflight = null;
      if (result.ok) {
        storeBootstrapData(key, result.data);
      }
      return result;
    });
    bootstrapInflight = revalidate;
    void revalidate;
    return { ok: true, data: stale };
  }

  const promise = fetchAppBootstrap(token, opts).then((result) => {
    bootstrapInflight = null;
    if (result.ok) {
      storeBootstrapData(key, result.data);
    } else {
      bootstrapCache = null;
    }
    return result;
  });
  bootstrapInflight = promise;
  return promise;
}

export async function revalidateAppBootstrap(
  token: string,
  opts?: { debug?: boolean }
): Promise<ApiResult<AppBootstrapResponse>> {
  const key = toTokenKey(token);
  if (!opts?.debug && bootstrapInflight) {
    return bootstrapInflight;
  }
  const promise = fetchAppBootstrap(token, opts).then((result) => {
    bootstrapInflight = null;
    if (result.ok) {
      storeBootstrapData(key, result.data);
    }
    return result;
  });
  if (!opts?.debug) {
    bootstrapInflight = promise;
  }
  return promise;
}

export function invalidateAppBootstrapCache(): void {
  bootstrapCache = null;
  bootstrapInflight = null;
  invalidateCache('app.bootstrap');
}
