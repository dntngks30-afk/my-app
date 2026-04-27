-- PR-ONBOARDING-EXPLICIT-COMPLETION-GUARD-01
-- Explicit marker for post-pay / post-redeem onboarding screen completion.
-- Readiness requires this in addition to target_frequency, experience, pain.

ALTER TABLE public.session_user_profile
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.session_user_profile.onboarding_completed_at IS
  'Explicit marker that the user completed the execution-readiness onboarding screen.';

-- Narrow backfill: users already in execution (active session) must not be forced back to onboarding.
UPDATE public.session_user_profile p
SET onboarding_completed_at = COALESCE(p.onboarding_completed_at, NOW())
FROM public.session_program_progress g
WHERE
  p.user_id = g.user_id
  AND p.onboarding_completed_at IS NULL
  AND p.target_frequency IN (2, 3, 4, 5)
  AND p.exercise_experience_level IN ('beginner', 'intermediate', 'advanced')
  AND p.pain_or_discomfort_present IS NOT NULL
  AND g.active_session_number IS NOT NULL;
