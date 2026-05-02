/**
 * PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — validation + metadata smoke (no network)
 * Run: npx tsx scripts/auth-pilot-password-signup-smoke.ts
 */
import { strict as assert } from 'node:assert';
import { validatePilotSignupBody, pilotSignupUserMetadata } from '../src/lib/auth/pilotSignupValidation';

function run() {
  assert.deepStrictEqual(
    validatePilotSignupBody(null),
    expectFail('요청 형식이 올바르지 않습니다.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({}),
    expectFail('필수 항목을 모두 입력해 주세요.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: 'bad',
      password: '12345678',
      nickname: '닉',
    }),
    expectFail('올바른 이메일 주소를 입력해 주세요.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: '  a@b.co  ',
      password: 'short',
      nickname: '닉',
    }),
    expectFail('비밀번호는 최소 8자 이상이어야 합니다.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: 'a@b.co',
      password: '12345678',
      nickname: '',
    }),
    expectFail('닉네임은 1~20자로 입력해 주세요.'),
  );

  const ok = validatePilotSignupBody({
    email: '  User@Example.com  ',
    password: '12345678',
    nickname: '테스트닉',
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error('expected ok');
  assert.equal(ok.value.email, 'user@example.com');

  const meta = pilotSignupUserMetadata(ok.value);
  assert.equal(meta.nickname, '테스트닉');
  assert.equal(meta.signup_source, 'pilot_password_signup_v1');
  assert.equal(Object.keys(meta).length, 2);

  console.log('auth-pilot-password-signup-smoke: PASS');
}

function expectFail(message: string) {
  return { ok: false as const, code: 'VALIDATION_ERROR' as const, message };
}

run();
