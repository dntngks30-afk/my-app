import { redirect } from 'next/navigation';
import { getPublicFunnelLegacyRoutePolicy } from '@/lib/public/public-funnel-legacy-routes';

/**
 * Legacy result rail is sunset.
 * Direct exposure ends here; no legacy result truth survives as canonical owner.
 */
export default function FreeSurveyLegacyResultSunsetPage() {
  const policy = getPublicFunnelLegacyRoutePolicy('/free-survey/result');
  redirect(policy.handoffTo);
}
