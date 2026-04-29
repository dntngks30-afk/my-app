/**
 * PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — pilot-signup 요청 검증 (서버·테스트 공용)
 */

export const PILOT_SIGNUP_GENDERS = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
] as const;

export type PilotSignupGender = (typeof PILOT_SIGNUP_GENDERS)[number];

export type PilotSignupPayload = {
  email: string;
  password: string;
  nickname: string;
  gender: PilotSignupGender;
  age: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CTRL_RE = /[\x00-\x1F\x7F]/;

export function validatePilotSignupBody(raw: unknown):
  | { ok: true; value: PilotSignupPayload }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string } {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '요청 형식이 올바르지 않습니다.' };
  }
  const b = raw as Record<string, unknown>;

  const emailRaw = b.email;
  const passwordRaw = b.password;
  const nicknameRaw = b.nickname;
  const genderRaw = b.gender;
  const ageRaw = b.age;

  if (
    typeof emailRaw !== 'string' ||
    typeof passwordRaw !== 'string' ||
    typeof nicknameRaw !== 'string' ||
    typeof genderRaw !== 'string' ||
    (typeof ageRaw !== 'number' && typeof ageRaw !== 'string')
  ) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '필수 항목을 모두 입력해 주세요.' };
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '올바른 이메일 주소를 입력해 주세요.' };
  }

  if (passwordRaw.length < 8) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '비밀번호는 최소 8자 이상이어야 합니다.',
    };
  }

  const nickname = nicknameRaw.trim();
  if (nickname.length < 1 || nickname.length > 20) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '닉네임은 1~20자로 입력해 주세요.',
    };
  }
  if (CTRL_RE.test(nicknameRaw) || CTRL_RE.test(nickname)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '닉네임에 사용할 수 없는 문자가 포함되어 있습니다.' };
  }

  const gender = genderRaw.trim() as PilotSignupGender;
  if (!PILOT_SIGNUP_GENDERS.includes(gender as PilotSignupGender)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '성별을 선택해 주세요.' };
  }

  const ageNum = typeof ageRaw === 'number' ? ageRaw : Number.parseInt(String(ageRaw), 10);
  if (!Number.isInteger(ageNum) || ageNum < 14 || ageNum > 100) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '나이는 14~100 사이의 숫자로 입력해 주세요.',
    };
  }

  return {
    ok: true,
    value: {
      email,
      password: passwordRaw,
      nickname,
      gender,
      age: ageNum,
    },
  };
}

/** user_metadata에 허용되는 형태만 반환 (비밀번호 제외) */
export function pilotSignupUserMetadata(input: PilotSignupPayload): Record<string, unknown> {
  return {
    nickname: input.nickname,
    gender: input.gender,
    age: input.age,
    signup_source: 'pilot_password_signup_v1',
  };
}
