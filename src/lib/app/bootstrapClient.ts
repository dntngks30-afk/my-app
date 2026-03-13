import { getCacheStale, invalidateCache, setCache } from '@/lib/cache/tabDataCache';
import type { ActivePlanSummary, ActiveSessionLiteResponse, SessionProgress } from '@/lib/session/client';

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
  next_session: {
    session_number: number;
    focus_axes: string[];
    estimated_time: number;
  } | null;
  /** PR-ALG-15: Human-readable adaptive adjustment explanation */
  adaptive_explanation?: AdaptiveExplanation | null;
  stats_preview: AppBootstrapStatsPreview;
};

const TTL_MS = 5_000;

let bootstrapCache: { tokenKey: string; data: AppBootstrapResponse; expiresAt: number } | null = null;
let bootstrapInflight: Promise<ApiResult<AppBootstrapResponse>> | null = null;

function toTokenKey(token: string): string {
  return token && token.length >= 16 ? token.slice(-16) : token || '';
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

  const stale = !opts?.debug ? getCacheStale<AppBootstrapResponse>('app.bootstrap') : null;
  if (stale) {
    const revalidate = fetchAppBootstrap(token).then((result) => {
      bootstrapInflight = null;
      if (result.ok) {
        bootstrapCache = { tokenKey: key, data: result.data, expiresAt: Date.now() + TTL_MS };
        setCache('app.bootstrap', result.data);
        setCache('home.activeLite', toActiveLite(result.data));
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
      bootstrapCache = { tokenKey: key, data: result.data, expiresAt: Date.now() + TTL_MS };
      setCache('app.bootstrap', result.data);
      setCache('home.activeLite', toActiveLite(result.data));
    } else {
      bootstrapCache = null;
    }
    return result;
  });
  bootstrapInflight = promise;
  return promise;
}

/**
 * App bootstrap 클라이언트 메모리 캐시 무효화.
 * 세션 생성·완료 시 invalidateActiveCache()와 함께 호출.
 * @see docs/ssot/PWA_SERVICE_WORKER.md
 */
export function invalidateAppBootstrapCache(): void {
  bootstrapCache = null;
  bootstrapInflight = null;
  invalidateCache('app.bootstrap');
}
