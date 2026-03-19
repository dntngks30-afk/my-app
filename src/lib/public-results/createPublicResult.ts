/**
 * FLOW-01 — Public Result Write Utility (server-side)
 *
 * UnifiedDeepResultV2 결과를 public_results 테이블에 저장.
 * 항상 service_role(getServerSupabaseAdmin)을 통해 실행.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────
 * - 이 파일은 CREATE(write)만 담당한다.
 * - READ / handoff / claim은 FLOW-02/05 범위.
 * - deep_test_attempts와 완전히 분리된 독립 테이블에 저장.
 *
 * ─── 입력 계약 ──────────────────────────────────────────────────────────────
 * - result: UnifiedDeepResultV2 (Deep Result V2 contract 통과 검증된 객체)
 * - anonId: client에서 전송한 anon identity
 * - stage: 'baseline' | 'refined'
 * - userId: optional (인증된 사용자가 있으면 첨부, 없으면 null)
 * - sourceInputs: ['free_survey'] | ['free_survey', 'camera'] 등
 *
 * ─── FLOW-02/05 준비 ────────────────────────────────────────────────────────
 * - 반환되는 id로 FLOW-02에서 token-based read 가능
 * - user_id nullable → FLOW-05 claim 시 채워질 자리
 * - claimed_at nullable → FLOW-05 claim 완료 시 채워질 자리
 *
 * @see supabase/migrations/202603270000_flow01_public_results.sql
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import { validateUnifiedDeepResultV2, type UnifiedDeepResultV2 } from '@/lib/result/deep-result-v2-contract';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface CreatePublicResultInput {
  result: UnifiedDeepResultV2;
  anonId: string;
  stage: 'baseline' | 'refined';
  /** 인증 사용자가 있으면 첨부. 없으면 null. */
  userId?: string | null;
  /** 기여한 입력 채널 목록 (e.g. ['free_survey'] or ['free_survey','camera']) */
  sourceInputs?: string[];
}

export interface CreatePublicResultOutput {
  id: string;
  anonId: string;
  stage: string;
  createdAt: string;
}

export class PublicResultValidationError extends Error {
  constructor(errors: string[]) {
    super(`Deep Result V2 validation failed:\n${errors.join('\n')}`);
    this.name = 'PublicResultValidationError';
  }
}

// ─── Write 함수 ───────────────────────────────────────────────────────────────

/**
 * createPublicResult — public result 저장 (server-side only)
 *
 * @throws {PublicResultValidationError} result가 Deep Result V2 계약을 위반한 경우
 * @throws {Error} DB insert 실패 시
 */
export async function createPublicResult(
  input: CreatePublicResultInput
): Promise<CreatePublicResultOutput> {
  const { result, anonId, stage, userId = null, sourceInputs } = input;

  // 필수 인수 검증
  if (!anonId || anonId.trim() === '') {
    throw new Error('anonId는 필수입니다.');
  }

  // Deep Result V2 contract 검증 (저장 전 필수)
  const validation = validateUnifiedDeepResultV2(result);
  if (!validation.valid) {
    throw new PublicResultValidationError(validation.errors);
  }

  // source_inputs 결정: 명시 전달 → result.source_mode 기반 fallback
  const resolvedSourceInputs: string[] =
    sourceInputs && sourceInputs.length > 0
      ? sourceInputs
      : result.source_mode === 'camera'
        ? ['free_survey', 'camera']
        : ['free_survey'];

  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('public_results')
    .insert({
      anon_id:              anonId.trim(),
      user_id:              userId ?? null,
      result_v2_json:       result as unknown as Record<string, unknown>,
      source_inputs:        resolvedSourceInputs,
      source_mode:          result.source_mode ?? null,
      result_stage:         stage,
      confidence_normalized: typeof result.confidence === 'number' ? result.confidence : null,
      evidence_level:       result.evidence_level ?? null,
      schema_version:       'v2',
    })
    .select('id, anon_id, result_stage, created_at')
    .single();

  if (error) {
    throw new Error(`public_results insert 실패: ${error.message}`);
  }

  return {
    id:        data.id,
    anonId:    data.anon_id,
    stage:     data.result_stage,
    createdAt: data.created_at,
  };
}
