-- perf: bootstrap API (home/dashboard, routine/list) 쿼리 최적화용 인덱스
-- 멱등: IF NOT EXISTS로 중복 생성 방지

-- 1) workout_routines: user별 최신 루틴/목록 (created_at desc)
-- idx_workout_routines_user_created_desc 가 이미 있으면 skip
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_created_desc
  ON public.workout_routines (user_id, created_at DESC NULLS LAST);

-- 2) user_routines: user_id 단건 조회 (maybeSingle)
CREATE INDEX IF NOT EXISTS idx_user_routines_user_id
  ON public.user_routines (user_id);

-- 3) routine_completions: (user_id, day_number) 완료 여부 조회
-- idx_routine_completions_user_day 가 이미 있으면 skip
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_day
  ON public.routine_completions (user_id, day_number);

-- 4) workout_routine_days: routine_id in(...) 진행도 조회
CREATE INDEX IF NOT EXISTS idx_workout_routine_days_routine_id
  ON public.workout_routine_days (routine_id);
