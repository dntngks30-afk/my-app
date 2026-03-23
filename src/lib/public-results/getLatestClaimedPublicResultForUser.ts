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
 * ─── PR-RESULT-SELECTION-01 선택 기준 ─────────────────────────────────────────
 * - 동일 user의 claimed 행 후보를 가져온 뒤 메모리에서 순위 결정:
 *   1) result_stage: refined 가 baseline 보다 우선
 *   2) 같은 stage 내에서는 claimed_at 이 더 최근인 행 우선
 * - 순위대로 stage / UnifiedDeepResultV2 검증 → 첫 통과 행 반환
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

/** DB 행 (검증 전) */
interface PublicResultClaimedRow {
  id: string;
  user_id: string;
  result_stage: string;
  result_v2_json: unknown;
  claimed_at: string;
  created_at: string;
}

/** PR-RESULT-SELECTION-01: refined 우선, 동일 stage 내 claimed_at 최신 우선 */
const MAX_CLAIMED_CANDIDATES = 80;

function rankClaimedRowsForExecution(rows: PublicResultClaimedRow[]): PublicResultClaimedRow[] {
  return [...rows].sort((a, b) => {
    const rank = (stage: string) => (stage === 'refined' ? 0 : stage === 'baseline' ? 1 : 2);
    const dr = rank(a.result_stage) - rank(b.result_stage);
    if (dr !== 0) return dr;
    const ta = new Date(a.claimed_at).getTime();
    const tb = new Date(b.claimed_at).getTime();
    return tb - ta;
  });
}

// ─── 로더 함수 ────────────────────────────────────────────────────────────────

/**
 * getLatestClaimedPublicResultForUser — 사용자의 실행 truth용 claimed public result 로드
 *
 * - claimed_at IS NOT NULL 인 행만 후보
 * - 후보를 refined-first · claimed_at 내림차순으로 순위 매긴 뒤 검증 통과 첫 행 반환
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

  const ranked = rankClaimedRowsForExecution(rows as PublicResultClaimedRow[]);

  for (const data of ranked) {
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

    return {
      id: data.id as string,
      userId: data.user_id as string,
      stage: data.result_stage as 'baseline' | 'refined',
      result: data.result_v2_json as UnifiedDeepResultV2,
      claimedAt: data.claimed_at as string,
      createdAt: data.created_at as string,
    };
  }

  return null;
}
