export type PublicFunnelRouteClass = 'owner' | 'compat' | 'sunset';

export interface PublicFunnelRoutePolicy {
  classification: PublicFunnelRouteClass;
  handoffTo: '/movement-test' | '/movement-test/survey';
}

/**
 * Canonical public funnel owner rail lives under /movement-test.
 * Legacy public routes are handoff-only and must not own funnel state.
 */
export const PUBLIC_FUNNEL_LEGACY_ROUTE_POLICIES: Record<string, PublicFunnelRoutePolicy> = {
  '/free-survey': {
    classification: 'compat',
    handoffTo: '/movement-test',
  },
  '/survey': {
    classification: 'compat',
    handoffTo: '/movement-test',
  },
  '/free-survey/result': {
    classification: 'sunset',
    handoffTo: '/movement-test',
  },
  '/survey/result': {
    classification: 'sunset',
    handoffTo: '/movement-test',
  },
};

export function getPublicFunnelLegacyRoutePolicy(pathname: string): PublicFunnelRoutePolicy {
  return (
    PUBLIC_FUNNEL_LEGACY_ROUTE_POLICIES[pathname] ?? {
      classification: 'compat',
      handoffTo: '/movement-test',
    }
  );
}
