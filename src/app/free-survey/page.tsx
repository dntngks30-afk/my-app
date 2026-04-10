import { redirect } from 'next/navigation';
import { getPublicFunnelLegacyRoutePolicy } from '@/lib/public/public-funnel-legacy-routes';

/**
 * Legacy public entry.
 * Compat handoff only: canonical public analysis owner is
 * movement-test baseline/refine -> public_results.
 * No legacy localStorage restore/import into canonical funnel.
 */
export default function FreeSurveyCompatEntryPage() {
  const policy = getPublicFunnelLegacyRoutePolicy('/free-survey');
  redirect(policy.handoffTo);
}
