/**
 * PR-PILOT-ENTITLEMENT-03 — Shared pilot redeem error copy for UI
 */

const DEFAULT_FALLBACK =
  '파일럿 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function mapPilotRedeemErrorToMessage(
  code: string | undefined,
  fallback?: string
): string {
  const fb = fallback ?? DEFAULT_FALLBACK;

  switch (code) {
    case 'EXPIRED_CODE':
    case 'INACTIVE_CODE':
      return '파일럿 코드가 만료되었습니다. 안내받은 링크를 다시 확인해주세요.';
    case 'REDEMPTION_LIMIT_REACHED':
      return '이 파일럿 링크의 사용 가능 인원이 모두 찼습니다.';
    case 'INVALID_CODE':
    case 'CODE_NOT_FOUND':
    case 'MISSING_CODE':
      return '유효하지 않은 파일럿 링크입니다.';
    case 'NETWORK_ERROR':
    case 'REDEEM_FAILED':
      return DEFAULT_FALLBACK;
    case 'USER_NOT_FOUND':
      return typeof fallback === 'string' && fallback.trim() ? fallback : fb;
    default:
      return typeof fallback === 'string' && fallback.trim() ? fallback : DEFAULT_FALLBACK;
  }
}
