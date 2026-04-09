import { redirect } from 'next/navigation';
import { getPublicFunnelLegacyRoutePolicy } from '@/lib/public/public-funnel-legacy-routes';

/**
 * Legacy public entry.
 * Compat handoff only: no legacy localStorage restore/import into canonical funnel.
 */
export default function FreeSurveyCompatEntryPage() {
  const policy = getPublicFunnelLegacyRoutePolicy('/free-survey');
  redirect(policy.handoffTo);
}
