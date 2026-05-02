/**
 * PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — validation + metadata smoke (no network)
 * Run: npx tsx scripts/auth-pilot-password-signup-smoke.ts
 */
import { strict as assert } from 'node:assert';
import { validatePilotSignupBody, pilotSignupUserMetadata } from '../src/lib/auth/pilotSignupValidation';

const birthOk = '2000-06-01';

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
      birthDate: birthOk,
    }),
    expectFail('올바른 이메일 주소를 입력해 주세요.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: '  a@b.co  ',
      password: 'short',
      nickname: '닉',
      birthDate: birthOk,
    }),
    expectFail('비밀번호는 최소 8자 이상이어야 합니다.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: 'a@b.co',
      password: '12345678',
      nickname: '',
      birthDate: birthOk,
    }),
    expectFail('닉네임은 1~20자로 입력해 주세요.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: 'a@b.co',
      password: '12345678',
      nickname: '닉',
      birthDate: '',
    }),
    expectFail('생년월일을 입력해 주세요.'),
  );

  assert.deepStrictEqual(
    validatePilotSignupBody({
      email: 'a@b.co',
      password: '12345678',
      nickname: '닉',
      birthDate: '2099-01-01',
    }),
    expectFail('생년월일을 확인해 주세요. (만 10~100세, 미래 날짜 불가)'),
  );

  const ok = validatePilotSignupBody({
    email: '  User@Example.com  ',
    password: '12345678',
    nickname: '테스트닉',
    birthDate: birthOk,
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) throw new Error('expected ok');
  assert.equal(ok.value.email, 'user@example.com');
  assert.equal(ok.value.acquisitionSource, 'unknown');

  const meta = pilotSignupUserMetadata(ok.value);
  assert.equal(meta.nickname, '테스트닉');
  assert.equal(meta.signup_source, 'pilot_password_signup_v1');
  assert.equal(meta.acquisition_source, 'unknown');
  assert.equal(typeof meta.signup_age_band, 'string');
  assert.ok(meta.signup_age_band && meta.signup_age_band !== 'unknown');

  console.log('auth-pilot-password-signup-smoke: PASS');
}

function expectFail(message: string) {
  return { ok: false as const, code: 'VALIDATION_ERROR' as const, message };
}

run();
