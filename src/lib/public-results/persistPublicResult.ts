/**
 * FLOW-01 — Public Result 저장 클라이언트 헬퍼
 *
 * 브라우저에서 /api/public-results로 best-effort 저장 호출.
 *
 * ─── 설계 원칙 ─────────────────────────────────────────────────────────────
 * - best-effort: 저장 실패 시 UX 블로킹 없음. 결과 페이지는 계속 렌더.
 * - 중복 저장 방지: savedResultIds Set으로 in-memory 관리
 * - anon_id: getOrCreateAnonId()로 자동 관리
 * - 인증: 현재 토큰이 있으면 Bearer로 전송 (user_id 첨부), 없어도 동작
 *
 * ─── FLOW-02/05 경계 ────────────────────────────────────────────────────────
 * - 저장 후 반환되는 id/anonId를 나중에 FLOW-02 read/handoff에서 사용 가능
 * - 현재는 결과만 저장하고 id를 in-memory로 보관
 * - localStorage에 publicResultId 저장은 FLOW-02 범위에서 결정
 *
 * @see src/lib/public-results/anon-id.ts
 * @see src/app/api/public-results/route.ts
 */

import { getOrCreateAnonId } from './anon-id';
import type { UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface PersistPublicResultOptions {
  result: UnifiedDeepResultV2;
  stage: 'baseline' | 'refined';
  sourceInputs?: string[];
}

export interface PersistPublicResultSuccess {
  ok: true;
  id: string;
  anonId: string;
  createdAt: string;
}

export interface PersistPublicResultFailure {
  ok: false;
  reason: string;
}

export type PersistPublicResultResult = PersistPublicResultSuccess | PersistPublicResultFailure;

// ─── 중복 저장 방지 ───────────────────────────────────────────────────────────

// same result object 중복 저장 방지 (reference equality)
// 페이지 렌더 사이클 내에서 동일 result를 두 번 저장하지 않음
const savedResultIds = new WeakSet<object>();

// ─── 저장 함수 ────────────────────────────────────────────────────────────────

/**
 * persistPublicResult — 브라우저에서 public result를 API로 저장
 *
 * best-effort: throw하지 않음. 실패 시 {ok: false, reason}을 반환.
 * 호출자는 이 결과로 UX를 블로킹하면 안 된다.
 *
 * @param options 저장 옵션
 * @returns PersistPublicResultResult
 */
export async function persistPublicResult(
  options: PersistPublicResultOptions
): Promise<PersistPublicResultResult> {
  const { result, stage, sourceInputs } = options;

  // 중복 저장 방지
  if (savedResultIds.has(result as object)) {
    return { ok: false, reason: 'already_saved' };
  }

  try {
    const anonId = getOrCreateAnonId();
    if (!anonId) {
      return { ok: false, reason: 'anon_id_unavailable' };
    }

    // 인증 토큰 선택적 첨부 (있으면 user_id 기록 가능)
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    const response = await fetch('/api/public-results', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        anonId,
        result,
        stage,
        sourceInputs,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        ok: false,
        reason: body.error ?? `HTTP ${response.status}`,
      };
    }

    const data = await response.json() as {
      success: boolean;
      id: string;
      anonId: string;
      stage: string;
      createdAt: string;
    };

    if (!data.success || !data.id) {
      return { ok: false, reason: 'unexpected_response' };
    }

    // 저장 성공 → 중복 방지 등록
    savedResultIds.add(result as object);

    return {
      ok: true,
      id: data.id,
      anonId: data.anonId,
      createdAt: data.createdAt,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'unknown_error',
    };
  }
}
