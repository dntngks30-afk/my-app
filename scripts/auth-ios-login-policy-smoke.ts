/**
 * PR-AUTH-IOS-LOGIN-POLICY-01 / PR-AUTH-IOS-INAPP-KAKAO-DIRECT-01 — 네트워크 없음
 */
import assert from 'node:assert/strict';
import { isKakaoInAppBrowser } from '../src/lib/browser/detectInAppBrowser';
import {
  shouldUseInAppEmailAuthHandoff,
  shouldUseIosSafariAuthHandoffSheet,
  shouldUseOAuthHandoffForProvider,
  type AuthBrowserEnv,
} from '../src/lib/auth/authExternalBrowserPolicy';
import { normalizeCollectEmail } from '../src/lib/auth/collectEmailValidation';
import { coalesceStripeUserEmail } from '../src/lib/auth/stripeCheckoutEmail';

function showGoogleAfterHydrate(uaHydrated: boolean, isIos: boolean): boolean {
  return uaHydrated ? !isIos : false;
}

function main() {
  assert.equal(showGoogleAfterHydrate(true, false), true);
  assert.equal(showGoogleAfterHydrate(true, true), false);
  assert.equal(showGoogleAfterHydrate(false, true), false);
  assert.equal(showGoogleAfterHydrate(false, false), false);

  assert.equal(isKakaoInAppBrowser('mozilla/5.0 kakaotalk'), true);
  assert.equal(isKakaoInAppBrowser('mozilla/5.0 instagram'), false);
  assert.equal(normalizeCollectEmail('  User@EXAMPLE.com '), 'user@example.com');
  assert.equal(normalizeCollectEmail('bad'), null);
  assert.equal(normalizeCollectEmail(null), null);

  assert.equal(coalesceStripeUserEmail('a@b.com', null), 'a@b.com');
  assert.equal(coalesceStripeUserEmail('', 'c@d.com'), 'c@d.com');
  assert.equal(coalesceStripeUserEmail(null, '  e@f.co  '), 'e@f.co');
  assert.equal(coalesceStripeUserEmail(undefined, undefined), '');

  const iosInApp: AuthBrowserEnv = { inApp: true, isIos: true, isAndroid: false };
  const androidInApp: AuthBrowserEnv = { inApp: true, isIos: false, isAndroid: true };
  const safariMobile: AuthBrowserEnv = { inApp: false, isIos: true, isAndroid: false };

  assert.equal(shouldUseIosSafariAuthHandoffSheet(iosInApp), false);
  assert.equal(shouldUseInAppEmailAuthHandoff(iosInApp), false);
  assert.equal(shouldUseInAppEmailAuthHandoff(androidInApp), true);
  assert.equal(shouldUseOAuthHandoffForProvider(iosInApp, 'kakao'), false);
  assert.equal(shouldUseOAuthHandoffForProvider(androidInApp, 'kakao'), true);
  assert.equal(shouldUseOAuthHandoffForProvider(androidInApp, 'google'), true);
  assert.equal(shouldUseOAuthHandoffForProvider(safariMobile, 'kakao'), false);

  console.log('auth-ios-login-policy-smoke: PASS');
}

main();
