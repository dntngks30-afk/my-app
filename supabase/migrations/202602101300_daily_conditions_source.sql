-- P1-1: 체감 설문 source 컨텍스트
-- daily_conditions: source — 'post_workout' | 'checkin' | 'pre_start'

ALTER TABLE public.daily_conditions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'checkin'
  CONSTRAINT chk_daily_conditions_source
  CHECK (source IN ('post_workout', 'checkin', 'pre_start'));
