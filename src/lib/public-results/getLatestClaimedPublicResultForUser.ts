/**
 * FLOW-06 — Latest Claimed Public Result Loader (server-side)
 *
 * 현재 인증 사용자의 claimed public result 중 **실행 truth**에 적합한 한 건을 로드한다.
 * session create 입력 소스 해결에 사용.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - READ + 검증만 담당
 * - claim 자체는 FLOW-05 (claimPublicResult.ts) 범위
 * - session create 어댑터는 buildSessionDeepSummaryFromPublicResult.ts 범위
 *
 * ─── PR1-A/PR1-B 선택 기준 (stage/currentness + deterministic timing law) ───
 * - 동일 user의 claimed 행 후보를 가져온 뒤 메모리에서 순위 결정:
 *   1) PR1-A: stage/currentness window로 baseline/refined 우선순위 결정
 *   2) PR1-B: 같은 bucket 내 timing law를 deterministic하게 고정
 *      - claimed_at: authenticated execution path 편입 시점(1순위)
 *      - created_at: 분석 결과 생성 시점(2순위)
 *      - id: 최종 안정 정렬키(3순위)
 * - stage/V2 검증으로 execution-owner 가능 후보를 먼저 좁힌 뒤,
 *   그 valid 후보 집합에만 currentness-window 정책 적용
 * - 후보는 DB에서 상한 개수만큼만 가져옴(드문 다건 claim). refined가 그 밖에 있으면
 *   이론상 누락 가능 — docs/pr/PR-RESULT-SELECTION-01.md 참고.
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
  rankClaimedRowsForExecution,
  type PublicResultClaimedRowForSelection,
} from '@/lib/public-results/claimed-result-selection-policy';
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

const MAX_CLAIMED_CANDIDATES = 80;

// ─── 로더 함수 ────────────────────────────────────────────────────────────────

/**
 * getLatestClaimedPublicResultForUser — 사용자의 실행 truth용 claimed public result 로드
 *
 * - claimed_at IS NOT NULL 인 행만 후보
 * - 후보를 currentness-window-aware(stage/freshness) 정책으로 순위 매긴 뒤
 *   검증 통과 첫 행 반환
 * - result_v2_json을 UnifiedDeepResultV2로 검증하지 못하면 다음 순위 후보 시도
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

  const { data: rows, error } = await supabase
    .from('public_results')
    .select('id, user_id, result_stage, result_v2_json, claimed_at, created_at')
    .eq('user_id', userId)
    .not('claimed_at', 'is', null)
    .order('claimed_at', { ascending: false })
    .limit(MAX_CLAIMED_CANDIDATES);

  if (error) {
    console.warn(
      `[getLatestClaimedPublicResultForUser] DB 오류 (userId=${userId}):`,
      error.message
    );
    return null;
  }

  if (!rows || rows.length === 0) return null;

  const validCandidates: PublicResultClaimedRowForSelection[] = [];

  for (const data of rows as PublicResultClaimedRowForSelection[]) {
    if (data.result_stage !== 'baseline' && data.result_stage !== 'refined') {
      console.warn(
        `[getLatestClaimedPublicResultForUser] 알 수 없는 stage: ${data.result_stage} (id=${data.id})`
      );
      continue;
    }

    const validation = validateUnifiedDeepResultV2(data.result_v2_json);
    if (!validation.valid) {
      console.warn(
        `[getLatestClaimedPublicResultForUser] V2 검증 실패 (id=${data.id}):`,
        validation.errors.join(', ')
      );
      continue;
    }
    validCandidates.push(data);
  }

  if (validCandidates.length === 0) return null;

  const { ranked } = rankClaimedRowsForExecution(validCandidates);
  const winner = ranked[0];
  if (!winner) return null;

  return {
    id: winner.id as string,
    userId: winner.user_id as string,
    stage: winner.result_stage as 'baseline' | 'refined',
    result: winner.result_v2_json as UnifiedDeepResultV2,
    claimedAt: winner.claimed_at as string,
    createdAt: winner.created_at as string,
  };
}
