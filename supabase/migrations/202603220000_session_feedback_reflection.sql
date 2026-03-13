-- PR-UX-03: Session reflection fields (additive only)
-- body_state_change, discomfort_area for adaptive signal input

ALTER TABLE public.session_feedback
  ADD COLUMN IF NOT EXISTS body_state_change TEXT NULL
    CHECK (body_state_change IS NULL OR body_state_change IN ('better', 'same', 'worse'));

ALTER TABLE public.session_feedback
  ADD COLUMN IF NOT EXISTS discomfort_area TEXT NULL;

COMMENT ON COLUMN public.session_feedback.body_state_change IS 'PR-UX-03: 운동 후 몸 상태 변화 better|same|worse';
COMMENT ON COLUMN public.session_feedback.discomfort_area IS 'PR-UX-03: 불편 부위 (neck, lower_back, knee, wrist, shoulder)';
