'use client';

/**
 * 세션이 브라우저에 확립된 직후 — readiness next_action으로 replace.
 * `next` 쿼리 폴백은 fetch 실패·일시 오류 시에만 사용.
 */

import { fetchReadinessClient } from './fetchReadinessClient';
import { clearReadinessCheck } from './readinessSessionFlag';
import { resolvePathFromReadinessOrFallback } from './postAuthRouting';

export async function replaceRouteAfterAuthSession(
  router: { replace: (href: string) => void },
  fallbackPath: string,
): Promise<void> {
  clearReadinessCheck();
  const readiness = await fetchReadinessClient();
  const dest = resolvePathFromReadinessOrFallback(readiness, fallbackPath);
  router.replace(dest);
}
