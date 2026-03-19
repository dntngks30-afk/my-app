/**
 * FLOW-02 — Public Result Client Fetch Helper
 *
 * 브라우저에서 GET /api/public-results/[id]로 저장된 결과를 가져온다.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - READ 전용 클라이언트 헬퍼
 * - WRITE는 persistPublicResult.ts (FLOW-01)
 * - 절대 throw하지 않음 — null 반환으로 안전 처리
 * - 호출자는 결과 없음을 graceful fallback으로 처리해야 한다
 *
 * ─── 사용 시나리오 ────────────────────────────────────────────────────────────
 * - baseline/refined 페이지 refresh 시 DB 복구 시도
 * - publicResultId가 localStorage에 있을 때만 호출
 *
 * @see src/lib/public-results/public-result-handoff.ts (id 관리)
 * @see src/app/api/public-results/[id]/route.ts (서버 엔드포인트)
 */

import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/public-results/[id] 성공 응답 형태
 */
export interface LoadedPublicResult {
  id: string;
  anonId: string;
  stage: 'baseline' | 'refined';
  result: UnifiedDeepResultV2;
  createdAt: string;
  isClaimed: boolean;
}

// ─── Client Fetch ─────────────────────────────────────────────────────────────

/**
 * loadPublicResult — API를 통해 저장된 public result를 읽는다.
 *
 * best-effort: 실패 시 null 반환. 절대 throw하지 않음.
 * 호출자는 null을 받으면 기존 local 계산 경로로 fallback해야 한다.
 *
 * @param id  public_results.id (UUID)
 * @param anonId  선택적 anon hint (advisory)
 */
export async function loadPublicResult(
  id: string,
  anonId?: string | null
): Promise<LoadedPublicResult | null> {
  if (!id || typeof id !== 'string') return null;

  try {
    const params = new URLSearchParams();
    if (anonId && typeof anonId === 'string') {
      params.set('anonId', anonId);
    }

    const qs = params.toString();
    const url = `/api/public-results/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[loadPublicResult] HTTP ${response.status} for id=${id}`);
      }
      return null;
    }

    const data = await response.json() as {
      success?: boolean;
      id?: string;
      anonId?: string;
      stage?: string;
      result?: UnifiedDeepResultV2;
      createdAt?: string;
      isClaimed?: boolean;
    };

    if (
      !data.success ||
      !data.id ||
      !data.result ||
      (data.stage !== 'baseline' && data.stage !== 'refined')
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[loadPublicResult] unexpected response shape:', data);
      }
      return null;
    }

    return {
      id:        data.id,
      anonId:    data.anonId ?? '',
      stage:     data.stage as 'baseline' | 'refined',
      result:    data.result,
      createdAt: data.createdAt ?? '',
      isClaimed: data.isClaimed ?? false,
    };
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[loadPublicResult] fetch failed:', e);
    }
    return null;
  }
}
