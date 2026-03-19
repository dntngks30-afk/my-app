/**
 * FLOW-02 — Public Result Read Utility (server-side)
 *
 * public_results 테이블에서 결과를 id로 읽는다.
 * service_role(getServerSupabaseAdmin)을 통해 실행되므로 RLS 우회.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 파일은 READ만 담당한다.
 * - WRITE는 createPublicResult.ts (FLOW-01) 범위.
 * - claim은 FLOW-05 범위.
 *
 * ─── 소유권 검증 전략 (FLOW-02) ──────────────────────────────────────────────
 * - UUID id는 추측 불가 수준의 무작위값이므로 id 자체가 접근 키 역할.
 * - anonId는 선택적 advisory hint (로그/향후 claim 연계용).
 * - 현재 단계에서는 id만으로 읽기 허용 (public-first 설계).
 * - FLOW-05 claim 시 anon_id ↔ user_id 검증이 추가됨.
 *
 * ─── FLOW-03/05 준비 ────────────────────────────────────────────────────────
 * - isClaimed: claim 여부를 읽어 bridge/pay 단계에서 활용 가능
 * - anonId: handoff 및 claim 매칭용 반환
 *
 * @see supabase/migrations/202603270000_flow01_public_results.sql
 * @see src/lib/public-results/createPublicResult.ts
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import {
  validateUnifiedDeepResultV2,
  type UnifiedDeepResultV2,
} from '@/lib/result/deep-result-v2-contract';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface GetPublicResultInput {
  id: string;
  /**
   * 선택적 anon ID advisory hint.
   * 현재 단계에서는 접근 제한에 사용하지 않음.
   * FLOW-05 claim 준비 및 로깅 목적.
   */
  anonId?: string | null;
}

export interface GetPublicResultOutput {
  id: string;
  anonId: string;
  /** 저장된 단계 ('baseline' | 'refined') */
  stage: 'baseline' | 'refined';
  /** 검증 통과한 Deep Result V2 */
  result: UnifiedDeepResultV2;
  createdAt: string;
  /** FLOW-05 claim 완료 여부 */
  isClaimed: boolean;
}

export class PublicResultNotFoundError extends Error {
  constructor(id: string) {
    super(`public result를 찾을 수 없습니다: ${id}`);
    this.name = 'PublicResultNotFoundError';
  }
}

export class PublicResultInvalidPayloadError extends Error {
  constructor(id: string, errors: string[]) {
    super(`public result payload 검증 실패 (${id}):\n${errors.join('\n')}`);
    this.name = 'PublicResultInvalidPayloadError';
  }
}

// ─── Read 함수 ────────────────────────────────────────────────────────────────

/**
 * getPublicResult — public result 읽기 (server-side only)
 *
 * @throws {PublicResultNotFoundError} id에 해당하는 결과가 없을 때
 * @throws {PublicResultInvalidPayloadError} 저장된 payload가 V2 계약을 위반할 때
 * @throws {Error} DB 조회 실패 시
 */
export async function getPublicResult(
  input: GetPublicResultInput
): Promise<GetPublicResultOutput> {
  const { id, anonId } = input;

  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new Error('id는 필수입니다.');
  }

  const trimmedId = id.trim();

  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('public_results')
    .select('id, anon_id, result_stage, result_v2_json, created_at, claimed_at')
    .eq('id', trimmedId)
    .single();

  if (error) {
    // PostgREST PGRST116 = 행 없음 (single() 시 0개 결과)
    if (error.code === 'PGRST116') {
      throw new PublicResultNotFoundError(trimmedId);
    }
    throw new Error(`public_results 조회 실패: ${error.message}`);
  }

  if (!data) {
    throw new PublicResultNotFoundError(trimmedId);
  }

  // result_stage 검증
  if (data.result_stage !== 'baseline' && data.result_stage !== 'refined') {
    throw new Error(
      `알 수 없는 result_stage: ${data.result_stage} (id: ${trimmedId})`
    );
  }

  // Deep Result V2 계약 검증
  const validation = validateUnifiedDeepResultV2(
    data.result_v2_json as UnifiedDeepResultV2
  );
  if (!validation.valid) {
    throw new PublicResultInvalidPayloadError(trimmedId, validation.errors);
  }

  // anonId advisory 로그 (mismatch 시 warn만; 접근 제한 아님)
  if (
    anonId &&
    typeof anonId === 'string' &&
    data.anon_id !== anonId.trim()
  ) {
    console.warn(
      `[getPublicResult] anon_id mismatch (id=${trimmedId}). ` +
      `stored=${data.anon_id}, requested=${anonId.trim()}. ` +
      'FLOW-05 claim 시 재검증됩니다.'
    );
  }

  return {
    id:        data.id as string,
    anonId:    data.anon_id as string,
    stage:     data.result_stage as 'baseline' | 'refined',
    result:    data.result_v2_json as UnifiedDeepResultV2,
    createdAt: data.created_at as string,
    isClaimed: data.claimed_at !== null,
  };
}
