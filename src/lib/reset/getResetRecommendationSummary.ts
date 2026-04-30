import { getLatestClaimedPublicResultForUser } from '@/lib/public-results/getLatestClaimedPublicResultForUser';
import { extractSessionReadinessResultSummary } from '@/lib/readiness/result-summary';
import type { SessionReadinessResultSummary } from '@/lib/readiness/types';

/**
 * Narrow Reset recommendation source.
 *
 * Reset recommendations only need the public result summary fields used by the
 * catalog recommender. Keep this path independent from full session readiness
 * so it does not pay for plan, onboarding, progress, or legacy deep lookups.
 */
export async function getResetRecommendationSummary(
  userId: string
): Promise<SessionReadinessResultSummary | null> {
  const claimedPublic = await getLatestClaimedPublicResultForUser(userId);
  if (!claimedPublic) return null;

  return extractSessionReadinessResultSummary(
    claimedPublic.stage,
    claimedPublic.result
  );
}
