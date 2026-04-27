/**
 * PR-PILOT-POST-REDEEM-01 — 단일 post-redeem 라우트 매핑 (라우팅만, 새 플로우 시스템 아님)
 */

import type { SessionReadinessV1 } from '@/lib/readiness/types';

export function resolvePilotPostRedeemRoute(input: {
  hasBridgeContext: boolean;
  readiness?: SessionReadinessV1 | null;
}): string {
  if (input.hasBridgeContext) return '/onboarding';

  const code = input.readiness?.next_action?.code ?? null;

  switch (code) {
    case 'GO_ONBOARDING':
      return '/onboarding';
    case 'GO_SESSION_CREATE':
      return '/session-preparing';
    case 'GO_APP_HOME':
      return '/app/home';
    case 'GO_AUTH':
      return '/app/auth';
    case 'GO_RESULT':
    case 'GO_PAYMENT':
      return '/movement-test/baseline';
    default:
      return '/onboarding';
  }
}
