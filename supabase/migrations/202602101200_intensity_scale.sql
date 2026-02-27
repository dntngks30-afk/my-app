-- P1-2: 난이도 자동조절 intensity_scale
-- routine_day_plans: intensity_scale 추가 (0.5 ~ 1.5, 기본 1.0)
-- daily_conditions: intensity_feedback 추가 (선택, 0–10)

ALTER TABLE public.routine_day_plans
  ADD COLUMN IF NOT EXISTS intensity_scale NUMERIC(3,2) NOT NULL DEFAULT 1.0
  CONSTRAINT chk_routine_day_plans_intensity_scale
  CHECK (intensity_scale >= 0.5 AND intensity_scale <= 1.5);

ALTER TABLE public.daily_conditions
  ADD COLUMN IF NOT EXISTS intensity_feedback SMALLINT
  CONSTRAINT chk_daily_conditions_intensity_feedback
  CHECK (intensity_feedback IS NULL OR (intensity_feedback >= 0 AND intensity_feedback <= 10));
