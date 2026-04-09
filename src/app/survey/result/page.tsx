import { redirect } from 'next/navigation';
import { getPublicFunnelLegacyRoutePolicy } from '@/lib/public/public-funnel-legacy-routes';

/**
 * Legacy result rail is sunset.
 * This route no longer owns survey result truth or legacy localStorage replay.
 */
export default function SurveyLegacyResultSunsetPage() {
  const policy = getPublicFunnelLegacyRoutePolicy('/survey/result');
  redirect(policy.handoffTo);
}
