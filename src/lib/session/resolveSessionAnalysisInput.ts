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
  };
}

/**
 * Canonical session analysis-input resolver.
 *
 * Ownership:
 * 1. latest claimed public result
 * 2. legacy paid deep fallback
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
    },
  };
}
