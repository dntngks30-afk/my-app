import { redirect } from 'next/navigation';
import { getPublicFunnelLegacyRoutePolicy } from '@/lib/public/public-funnel-legacy-routes';

/**
 * Legacy public entry.
 * Compat handoff only: canonical owner stays on /movement-test rail.
 */
export default function SurveyCompatEntryPage() {
  const policy = getPublicFunnelLegacyRoutePolicy('/survey');
  redirect(policy.handoffTo);
}
