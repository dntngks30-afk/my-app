/**
 * PR-RESET-05: Reset Map API client wrapper.
 * Client-only. Normalized { ok, data/error }.
 */

export type ResetMapFlowRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  state: string;
  result: string | null;
  flow_version: string;
  variant_tag: string | null;
  started_at: string;
  applied_at: string | null;
  aborted_at: string | null;
  created_at: string;
  updated_at: string;
  preview_snapshot?: Record<string, unknown> | null;
};

export type ResetMapApiError = { code: string; message: string };

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ResetMapApiError };

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

async function resetMapFetch<T>(
  path: string,
  token: string,
  options?: RequestInit & { idempotencyKey?: string }
): Promise<ApiResult<T>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...((options?.headers as Record<string, string>) ?? {}),
    };
    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    const { idempotencyKey: _, ...restOptions } = options ?? {};
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...restOptions,
      headers,
      cache: 'no-store',
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const rawErr = body?.error as Record<string, unknown> | undefined;
      const code = (rawErr?.code as string) ?? 'UNKNOWN';
      const message = (rawErr?.message as string) ?? res.statusText;
      return { ok: false, status: res.status, error: { code, message } };
    }

    const data = body?.ok === true && body?.data != null ? (body.data as T) : (body as T);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: {
        code: 'NETWORK_ERROR',
        message: e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.',
      },
    };
  }
}

/** PR-RESET-06: Normalized start response. */
export type StartResult = {
  flow_id: string;
  state: string;
  reused: boolean;
  started_at: string;
};
export type LatestResult = { flow: ResetMapFlowRow | null };
export type PreviewResult = {
  flow_id: string;
  proceed: boolean;
  state: string;
  reasons: string[];
};
export type ApplyResult = ResetMapFlowRow;

/**
 * Start a new reset-map flow. Requires Idempotency-Key.
 */
export async function startResetMapFlow(
  token: string,
  idempotencyKey: string,
  options?: { session_id?: string | null; variant_tag?: string | null }
): Promise<ApiResult<StartResult>> {
  return resetMapFetch<StartResult>('/api/reset-map/start', token, {
    method: 'POST',
    body: JSON.stringify({
      session_id: options?.session_id ?? null,
      variant_tag: options?.variant_tag ?? null,
    }),
    idempotencyKey,
  });
}

/**
 * Get latest non-terminal flow. For resume.
 */
export async function getLatestResetMapFlow(
  token: string
): Promise<ApiResult<LatestResult>> {
  return resetMapFetch<LatestResult>('/api/reset-map/latest', token, {
    method: 'GET',
  });
}

/**
 * Submit preview result. Updates flow to preview_ready or keeps started.
 */
export async function submitResetMapPreview(
  token: string,
  flowId: string,
  payload: {
    tracking_conf?: number;
    landmark_coverage?: number;
    permission_state?: 'granted' | 'denied' | 'limited' | 'unknown';
  }
): Promise<ApiResult<PreviewResult>> {
  return resetMapFetch<PreviewResult>(`/api/reset-map/${flowId}/preview-result`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Apply flow. Requires Idempotency-Key.
 */
export async function applyResetMapFlow(
  token: string,
  flowId: string,
  idempotencyKey: string
): Promise<ApiResult<ApplyResult>> {
  return resetMapFetch<ApplyResult>(`/api/reset-map/${flowId}/apply`, token, {
    method: 'POST',
    idempotencyKey,
  });
}
