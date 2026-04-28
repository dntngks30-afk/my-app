/**
 * Reset API 클라이언트(browser) — ResetApiResult 타입 통일.
 *
 * PR-RESET-BE-02 `/api/reset/recommendations`:
 *
 * getCurrentUserId는 Bearer 토큰으로만 userId를 식별한다.
 * Authorization 헤더를 생략하면 서버에서는 userId를 알 수 없어, 로컬 세션이 있어도 200 폴백 추천이 될 수 있다.
 * (미인증·토큰 없음은 오류가 아님; 개인화된 readiness 기반 추천은 토큰을 붙일 때만 보장된다.)
 *
 * session/client.ts 의존 없음 — ResetApiResult는 types.ts와 본 파일에서만 사용.
 */
import { supabaseBrowser } from '@/lib/supabase';
import type {
  ResetApiResult,
  ResetMediaRequest,
  ResetMediaResponse,
  ResetRecommendationResponse,
} from '@/lib/reset/types';

const RECOMMENDATIONS_PATH = '/api/reset/recommendations';
const MEDIA_PATH = '/api/reset/media';

export async function fetchResetRecommendations(): Promise<
  ResetApiResult<ResetRecommendationResponse>
> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      /* best-effort: 토큰 없이 진행 */
    }

    const res = await fetch(RECOMMENDATIONS_PATH, { headers, cache: 'no-store' });

    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      const rawErr = body?.error as Record<string, unknown> | undefined;
      const code = (rawErr?.code as string) ?? 'UNKNOWN';
      const message = (rawErr?.message as string) ?? res.statusText;
      return { ok: false, status: res.status, error: { code, message } };
    }

    /** 단일 계약 레이어: { ok: true, data } — 중첩 data 없음 */
    const data =
      body?.ok === true && body?.data != null
        ? (body.data as ResetRecommendationResponse)
        : null;

    if (!data || body?.ok !== true) {
      return {
        ok: false,
        status: res.status,
        error: { code: 'INVALID_RESPONSE', message: '응답 형식이 올바르지 않습니다.' },
      };
    }

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

function legacyErrorCodeFromStatus(status: number): string {
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  return 'UNKNOWN';
}

/**
 * POST /api/reset/media — **requireActivePlan(유료 활성 플랜)**.
 *
 * Bearer가 없거나 플랜이 비활성이면 401/403 등으로 실패할 수 있다.
 * `fetchResetRecommendations`와 달리 미인증 **폴백 200을 제공하지 않는다**(재생·스트림 레이어).
 */
export async function fetchResetMedia(
  input: ResetMediaRequest
): Promise<ResetApiResult<ResetMediaResponse>> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    } catch {
      /* best-effort */
    }

    const res = await fetch(MEDIA_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
      cache: 'no-store',
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const errPayload = body?.error;
      if (typeof errPayload === 'string') {
        return {
          ok: false,
          status: res.status,
          error: {
            code: legacyErrorCodeFromStatus(res.status),
            message: errPayload,
          },
        };
      }
      const rawErr =
        typeof errPayload === 'object' && errPayload !== null
          ? (errPayload as Record<string, unknown>)
          : null;
      const code = (rawErr?.code as string) ?? 'UNKNOWN';
      const message = (rawErr?.message as string) ?? res.statusText;
      return { ok: false, status: res.status, error: { code, message } };
    }

    const data =
      body?.ok === true && body?.data != null
        ? (body.data as ResetMediaResponse)
        : null;

    if (!data || body?.ok !== true) {
      return {
        ok: false,
        status: res.status,
        error: { code: 'INVALID_RESPONSE', message: '응답 형식이 올바르지 않습니다.' },
      };
    }

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
