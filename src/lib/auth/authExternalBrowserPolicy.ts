/**
 * PR-AUTH-IOS-INAPP-KAKAO-DIRECT-01 — 인앱 감지와 외부 브라우저(시트·Chrome intent) 적용 정책 분리.
 * 로그인/가입 초기에는 마찰을 줄이기 위해 iOS 인앱에서 Safari 시트를 쓰지 않음.
 * Android 인앱 Chrome intent는 유지. PWA 설치 안내는 별도 컴포넌트에서 처리.
 */

export type AuthBrowserEnv = {
  inApp: boolean;
  isIos: boolean;
  isAndroid: boolean;
};

/** Auth 단계에서 iOS Safari handoff 시트를 사용하지 않음(PWA 안내와 무관). */
export function shouldUseIosSafariAuthHandoffSheet(env: AuthBrowserEnv): boolean {
  void env;
  return false;
}

/** 이메일 로그인/가입 인앱 핸드오프: Android만 Chrome intent 경로 유지. */
export function shouldUseInAppEmailAuthHandoff(env: AuthBrowserEnv): boolean {
  return Boolean(env.inApp && env.isAndroid);
}

/**
 * OAuth 시 절대 URL 핸드오프(+ Android Chrome intent / 기타 외부 오픈) 사용 여부.
 * iOS 인앱 + 카카오는 Supabase OAuth 직행.
 */
export function shouldUseOAuthHandoffForProvider(
  env: AuthBrowserEnv,
  provider: 'google' | 'kakao'
): boolean {
  if (env.inApp && env.isAndroid) return true;
  if (env.inApp && env.isIos && provider === 'kakao') return false;
  if (env.inApp && env.isIos && provider === 'google') return false;
  return Boolean(env.inApp);
}
