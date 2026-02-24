-- workout_routines: draft 상태 + started_at nullable
-- 7일 루틴 "Start" 버튼 시점에만 started_at 설정, status active 전환

-- 1. started_at nullable (기존 row는 값 유지)
ALTER TABLE public.workout_routines
  ALTER COLUMN started_at DROP NOT NULL,
  ALTER COLUMN started_at DROP DEFAULT;

-- 2. status에 draft 추가
ALTER TABLE public.workout_routines
  DROP CONSTRAINT IF EXISTS workout_routines_status_check;

ALTER TABLE public.workout_routines
  ADD CONSTRAINT workout_routines_status_check
  CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled'));
