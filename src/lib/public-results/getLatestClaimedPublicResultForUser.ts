/**
 * FLOW-06 — Latest Claimed Public Result Loader (server-side)
 *
 * 현재 인증 사용자의 가장 최근 claimed public result를 로드한다.
 * session create 입력 소스 해결에 사용.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - READ + 검증만 담당
 * - claim 자체는 FLOW-05 (claimPublicResult.ts) 범위
 * - session create 어댑터는 buildSessionDeepSummaryFromPublicResult.ts 범위
 *
 * ─── "최신" 선택 기준 ─────────────────────────────────────────────────────────
 * - claimed_at DESC 정렬 → 가장 최근에 claim된 결과 우선
 * - refined 스테이지가 baseline보다 신호 품질이 높으나,
 *   명시적 우선순위 부여 없이 시간순 정렬만 사용 (단순성 우선)
 * - FLOW-07에서 readiness 정책 변경 시 이 함수에서 조건 추가 가능
 *
 * ─── FLOW-07/08 준비 ────────────────────────────────────────────────────────
 * - 반환값의 stage / result_v2_json으로 FLOW-07 readiness 판단 가능
 * - null 반환 시 legacy path로 fallback
 *
 * @see src/lib/public-results/claimPublicResult.ts (FLOW-05)
 * @see src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts (FLOW-06 어댑터)
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';
import {
  validateUnifiedDeepResultV2,
  type UnifiedDeepResultV2,
} from '@/lib/result/deep-result-v2-contract';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface ClaimedPublicResultRow {
  /** public_results.id */
  id: string;
  /** claim한 사용자 id */
  userId: string;
  /** 결과 단계 */
  stage: 'baseline' | 'refined';
  /** 검증 완료된 Deep Result V2 */
  result: UnifiedDeepResultV2;
  /** claim 완료 시각 (ISO) */
  claimedAt: string;
  /** 생성 시각 (ISO) */
  createdAt: string;
}

// ─── 로더 함수 ────────────────────────────────────────────────────────────────

/**
 * getLatestClaimedPublicResultForUser — 사용자의 최신 claimed public result 로드
 *
 * - claimed_at IS NOT NULL → claim 완료된 행만 선택
 * - claimed_at DESC → 가장 최근 claim 우선
 * - result_v2_json을 UnifiedDeepResultV2로 검증 → 실패 시 null (안전 fallback)
 *
 * @returns ClaimedPublicResultRow (존재하고 유효하면) | null (없거나 유효하지 않으면)
 */
export async function getLatestClaimedPublicResultForUser(
  userId: string
): Promise<ClaimedPublicResultRow | null> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return null;
  }

  const supabase = getServerSupabaseAdmin();

  const { data, error } = await supabase
    .from('public_results')
    .select('id, user_id, result_stage, result_v2_json, claimed_at, created_at')
    .eq('user_id', userId)
    .not('claimed_at', 'is', null)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      `[getLatestClaimedPublicResultForUser] DB 오류 (userId=${userId}):`,
      error.message
    );
    return null;
  }

  if (!data) return null;

  // result_stage 검증
  if (data.result_stage !== 'baseline' && data.result_stage !== 'refined') {
    console.warn(
      `[getLatestClaimedPublicResultForUser] 알 수 없는 stage: ${data.result_stage} (id=${data.id})`
    );
    return null;
  }

  // Deep Result V2 계약 검증 (DB 손상 또는 schema drift 방어)
  const validation = validateUnifiedDeepResultV2(data.result_v2_json);
  if (!validation.valid) {
    console.warn(
      `[getLatestClaimedPublicResultForUser] V2 검증 실패 (id=${data.id}):`,
      validation.errors.join(', ')
    );
    return null;
  }

  return {
    id:        data.id as string,
    userId:    data.user_id as string,
    stage:     data.result_stage as 'baseline' | 'refined',
    result:    data.result_v2_json as UnifiedDeepResultV2,
    claimedAt: data.claimed_at as string,
    createdAt: data.created_at as string,
  };
}
