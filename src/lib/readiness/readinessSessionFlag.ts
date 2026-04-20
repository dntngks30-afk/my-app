/**
 * ReadinessEntryGate와 동일한 sessionStorage 플래그.
 * /app/home 최초 진입 시 readiness fetch 1회 가드.
 */

const READINESS_CHECKED_KEY = 'move-re-readiness-checked:v1';

export function isReadinessAlreadyChecked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(READINESS_CHECKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markReadinessChecked(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(READINESS_CHECKED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * 다음 /app/home 진입 시 readiness를 다시 체크하게 만든다.
 * onboarding 완료·claim 완료·로그아웃·재로그인 직후 등에서 호출.
 */
export function clearReadinessCheck(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(READINESS_CHECKED_KEY);
  } catch {
    /* ignore */
  }
}
