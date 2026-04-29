/**
 * PR-AUTH-HANDOFF-01 — Android Chrome intent (OAuth handoff 전용).
 * iOS 에서는 사용하지 않는다.
 */

/**
 * 같은 origin 의 https handoff URL 만 허용.
 */
export function buildAndroidChromeIntentUrl(handoffHttpsUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(handoffHttpsUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const canonical = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? origin;
  try {
    if (canonical && u.origin !== new URL(canonical).origin) return null;
  } catch {
    if (origin && u.origin !== origin) return null;
  }

  const intentPath = `${u.host}${u.pathname}${u.search}`;
  const fallback = encodeURIComponent(handoffHttpsUrl);
  return `intent://${intentPath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
