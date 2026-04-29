/**
 * PR-AUTH-HANDOFF-01 — UA 기반 인앱 브라우저 감지 (OAuth/PWA 공용).
 * UA는 완벽하지 않음 — 알려진 앱 + Android WebView 보수적으로만 in-app으로 본다.
 */

export type InAppBrowserAppName =
  | 'kakao'
  | 'naver'
  | 'instagram'
  | 'facebook'
  | 'line'
  | 'youtube'
  | 'threads'
  | 'android_webview'
  | null;

export function getUaLower(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent.toLowerCase();
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* noop */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function detectIsIos(uaLower: string): boolean {
  if (/iphone|ipod/i.test(uaLower)) return true;
  if (/ipad/i.test(uaLower)) return true;
  if (typeof navigator !== 'undefined') {
    const p = navigator.platform;
    return p === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  }
  return false;
}

export function detectIsAndroid(uaLower: string): boolean {
  return /android/i.test(uaLower);
}

/**
 * Instagram / Meta IAP · Kakao 등 “앱 내 브라우저” 후보.
 * Android 에서 `; wv)` 는 전통적인 WebView 힌트 (일부 일반 브라우저는 제외됨).
 */
export function detectInAppBrowserAppName(uaLower: string): InAppBrowserAppName {
  if (!uaLower) return null;
  if (uaLower.includes('kakaotalk')) return 'kakao';
  if (uaLower.includes('naver') || uaLower.includes('naverbrowser')) return 'naver';
  if (uaLower.includes('instagram')) return 'instagram';
  if (uaLower.includes('fban') || uaLower.includes('fbav') || uaLower.includes('fb_iab'))
    return 'facebook';
  if (uaLower.includes(' line/') || uaLower.includes('line;') || uaLower.startsWith('line/'))
    return 'line';
  if (uaLower.includes('youtube')) return 'youtube';
  if (uaLower.includes('threads')) return 'threads';
  if (detectIsAndroid(uaLower) && /; wv\)/.test(uaLower)) return 'android_webview';
  return null;
}

/**
 * OAuth·이메일 handoff 가 필요한 인앱 여부.
 * 일반 모바일 Chrome / Safari 는 false.
 */
export function isAuthHandoffInAppBrowser(uaLower: string): boolean {
  return detectInAppBrowserAppName(uaLower) !== null;
}

/** KakaoTalk 앱 내장 브라우저 — PR-AUTH-IOS-LOGIN-POLICY-01 OAuth 직행 분기용 */
export function isKakaoInAppBrowser(uaLower: string): boolean {
  return detectInAppBrowserAppName(uaLower) === 'kakao';
}
