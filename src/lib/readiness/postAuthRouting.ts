/**
 * 로그인·OAuth·가입 완료 후 클라이언트 라우팅 — readiness next_action SSOT.
 * ReadinessEntryGate의 next_action → 경로 매핑과 동일해야 한다 (드리프트 방지).
 *
 * @see src/app/app/_components/ReadinessEntryGate.tsx
 */

import type { SessionReadinessNextAction, SessionReadinessV1 } from './types';

export const SAFE_DEFAULT_POST_AUTH_PATH = '/app/home';

/** 상대 경로만 허용 (auth/callback·signup/complete 계약과 동일) */
export function sanitizeAppInternalPath(
  path: string | null | undefined,
  defaultPath: string = SAFE_DEFAULT_POST_AUTH_PATH,
): string {
  if (!path || typeof path !== 'string') return defaultPath;
  const t = path.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return defaultPath;
  return t;
}

export function pathForReadinessNextAction(code: SessionReadinessNextAction): string {
  switch (code) {
    case 'GO_RESULT':
      return '/movement-test/baseline';
    case 'GO_ONBOARDING':
      return '/onboarding';
    case 'GO_AUTH':
      return '/app/auth';
    case 'GO_PAYMENT':
    case 'GO_SESSION_CREATE':
    case 'GO_APP_HOME':
      return '/app/home';
    default:
      return SAFE_DEFAULT_POST_AUTH_PATH;
  }
}

export function resolvePathFromReadinessOrFallback(
  readiness: SessionReadinessV1 | null,
  fallbackPath: string,
): string {
  const fallback = sanitizeAppInternalPath(fallbackPath);
  if (!readiness) return fallback;
  return pathForReadinessNextAction(readiness.next_action.code);
}
