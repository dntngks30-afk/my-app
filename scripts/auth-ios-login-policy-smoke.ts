/**
 * PR-AUTH-IOS-LOGIN-POLICY-01 — 순수 검증 스모크 (네트워크/서버 없음)
 */
import assert from 'node:assert/strict';
import { isKakaoInAppBrowser } from '../src/lib/browser/detectInAppBrowser';
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

  console.log('auth-ios-login-policy-smoke: PASS');
}

main();
