/**
 * PR-FLOW-06 — 온보딩 최소 완료 여부 (세션 생성에 필요한 필드만)
 *
 * session_user_profile 행 스냅샷을 받아 execution-critical 필드만 검사한다.
 */

export type SessionUserProfileRow = {
  target_frequency?: number | null;
  exercise_experience_level?: string | null;
  pain_or_discomfort_present?: boolean | null;
};

/** 최소 필수 필드 식별자 (API/클라이언트 공통 어휘) */
export const ONBOARDING_MINIMUM_FIELD_IDS = [
  'frequency_level',
  'experience_level',
  'pain_confirmed',
] as const;

export type OnboardingMinimumFieldId = (typeof ONBOARDING_MINIMUM_FIELD_IDS)[number];

export interface OnboardingMinimumResult {
  is_complete: boolean;
  required_fields: OnboardingMinimumFieldId[];
  missing_fields: OnboardingMinimumFieldId[];
}

/**
 * 주 2·3·4·5회 중 하나가 선택되어야 frequency 완료로 본다 (기존 FLOW-04 정렬).
 */
export function evaluateOnboardingMinimum(
  profile: SessionUserProfileRow | null | undefined
): OnboardingMinimumResult {
  const required_fields = [...ONBOARDING_MINIMUM_FIELD_IDS];
  const missing: OnboardingMinimumFieldId[] = [];

  const hasFrequency =
    typeof profile?.target_frequency === 'number' &&
    [2, 3, 4, 5].includes(profile.target_frequency);
  if (!hasFrequency) missing.push('frequency_level');

  const hasExperience =
    typeof profile?.exercise_experience_level === 'string' &&
    profile.exercise_experience_level.trim().length > 0;
  if (!hasExperience) missing.push('experience_level');

  const hasPain = typeof profile?.pain_or_discomfort_present === 'boolean';
  if (!hasPain) missing.push('pain_confirmed');

  return {
    is_complete: missing.length === 0,
    required_fields,
    missing_fields: missing,
  };
}
