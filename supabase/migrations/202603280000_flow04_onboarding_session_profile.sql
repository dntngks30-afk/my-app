-- ================================================
-- FLOW-04: Post-Pay Onboarding — session_user_profile 확장
--
-- 실행 준비 입력(onboarding inputs)을 session_user_profile에 추가.
-- 기존 target_frequency, lifestyle_tag와 함께 사용.
--
-- 추가 필드:
--   exercise_experience_level  — 운동 경험 수준 (beginner|intermediate|advanced)
--   pain_or_discomfort_present — 통증/불편감 유무 (boolean)
--
-- FLOW-06 session create에서 이 값들을 참조할 예정.
-- ================================================

-- 1. exercise_experience_level
ALTER TABLE public.session_user_profile
  ADD COLUMN IF NOT EXISTS exercise_experience_level TEXT
  CHECK (exercise_experience_level IS NULL OR exercise_experience_level IN ('beginner', 'intermediate', 'advanced'));

-- 2. pain_or_discomfort_present
ALTER TABLE public.session_user_profile
  ADD COLUMN IF NOT EXISTS pain_or_discomfort_present BOOLEAN;

COMMENT ON COLUMN public.session_user_profile.exercise_experience_level IS
  'FLOW-04: 운동 경험 수준. session 생성 시 참조.';
COMMENT ON COLUMN public.session_user_profile.pain_or_discomfort_present IS
  'FLOW-04: 통증/불편감 유무. session 생성 시 보수적 조정 참조.';
