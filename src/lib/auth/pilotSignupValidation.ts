/**
 * PR-AUTH-PILOT-PASSWORD-SIGNUP-02 — pilot-signup 요청 검증 (서버·테스트 공용)
 * 회원가입 생년월일 → KPI 연령대(signup_profiles), 유입경로는 회원가입에서만 수집.
 */

import {
  signupBirthDateToAgeBand,
  isAcquisitionSource,
  type AcquisitionSource,
} from '@/lib/analytics/kpi-demographics-types';

export type PilotSignupPayload = {
  email: string;
  password: string;
  nickname: string;
  birthDate: string;
  acquisitionSource: AcquisitionSource;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CTRL_RE = /[\x00-\x1F\x7F]/;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  const birthRaw = b.birthDate;
  const acquisitionRaw = b.acquisitionSource;

  if (
    typeof emailRaw !== 'string' ||
    typeof passwordRaw !== 'string' ||
    typeof nicknameRaw !== 'string' ||
    typeof birthRaw !== 'string'
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

  const birthDate = birthRaw.trim();
  if (!birthDate) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '생년월일을 입력해 주세요.' };
  }
  if (!ISO_DATE_RE.test(birthDate)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: '생년월일 형식이 올바르지 않습니다.' };
  }

  const band = signupBirthDateToAgeBand(birthDate);
  if (band === 'unknown') {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: '생년월일을 확인해 주세요. (만 10~100세, 미래 날짜 불가)',
    };
  }

  let acquisitionSource: AcquisitionSource = 'unknown';
  if (acquisitionRaw !== undefined && acquisitionRaw !== null && acquisitionRaw !== '') {
    if (!isAcquisitionSource(acquisitionRaw)) {
      return { ok: false, code: 'VALIDATION_ERROR', message: '유입 경로 값이 올바르지 않습니다.' };
    }
    acquisitionSource = acquisitionRaw;
  }

  return {
    ok: true,
    value: {
      email,
      password: passwordRaw,
      nickname,
      birthDate,
      acquisitionSource,
    },
  };
}

/** user_metadata에 허용되는 형태만 반환 (비밀번호·생년월일 원문 제외) */
export function pilotSignupUserMetadata(input: PilotSignupPayload): Record<string, unknown> {
  const signupAgeBand = signupBirthDateToAgeBand(input.birthDate);
  return {
    nickname: input.nickname,
    signup_source: 'pilot_password_signup_v1',
    signup_age_band: signupAgeBand === 'unknown' ? undefined : signupAgeBand,
    acquisition_source: input.acquisitionSource,
  };
}
