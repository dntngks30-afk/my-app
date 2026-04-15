import { buildSessionDeepSummaryFromPublicResult } from '@/lib/deep-result/buildSessionDeepSummaryFromPublicResult';
import { loadSessionDeepSummary, type SessionDeepSummary } from '@/lib/deep-result/session-deep-summary';
import { getLatestClaimedPublicResultForUser } from '@/lib/public-results/getLatestClaimedPublicResultForUser';

export type SessionAnalysisSourceMode = 'public_result' | 'legacy_paid_deep';

export interface ResolvedSessionAnalysisInput {
  summary: SessionDeepSummary;
  source: {
    mode: SessionAnalysisSourceMode;
    public_result_id: string | null;
    deep_attempt_id: string | null;
    /** PR-PILOT-BASELINE-SESSION-ALIGN-01: public baseline이 truth owner인지 명시 */
    is_baseline_truth_owner: boolean;
    /** fallback 사용 시 이유 기록 */
    fallback_reason: string | null;
  };
}

/**
 * Canonical session analysis-input resolver.
 *
 * PR-PILOT-BASELINE-SESSION-ALIGN-01: source ownership 강화
 * - fresh claimed public result가 있으면 무조건 그것이 truth owner
 * - legacy paid deep은 public result가 없을 때만 fallback으로 사용
 * - fallback 사용 시 명시적으로 reason 기록 (silent fallback 방지)
 *
 * Ownership:
 * 1. latest claimed public result (baseline truth owner)
 * 2. legacy paid deep fallback (observability 필수)
 * 3. none
 */
export async function resolveSessionAnalysisInput(
  userId: string
): Promise<ResolvedSessionAnalysisInput | null> {
  if (!userId || userId.trim() === '') {
    return null;
  }

  const claimedPublicResult = await getLatestClaimedPublicResultForUser(userId);
  if (claimedPublicResult) {
    const summary = buildSessionDeepSummaryFromPublicResult(claimedPublicResult);
    return {
      summary,
      source: {
        mode: 'public_result',
        public_result_id: claimedPublicResult.id,
        deep_attempt_id: null,
        is_baseline_truth_owner: true,
        fallback_reason: null,
      },
    };
  }

  const legacyDeepSummary = await loadSessionDeepSummary(userId);
  if (!legacyDeepSummary) {
    return null;
  }

  return {
    summary: legacyDeepSummary,
    source: {
      mode: 'legacy_paid_deep',
      public_result_id: null,
      deep_attempt_id: legacyDeepSummary.source_deep_attempt_id ?? null,
      is_baseline_truth_owner: false,
      fallback_reason: 'no_claimed_public_result',
    },
  };
}
