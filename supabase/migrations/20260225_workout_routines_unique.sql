-- workout_routines: (user_id, movement_test_result_id) 유니크 제약
-- 동일 검사 결과로 루틴 1개만 허용 (멱등 생성)
-- movement_test_result_id IS NULL 인 기존 row는 영향 없음 (partial index 미사용)

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_routines_user_test_result
  ON public.workout_routines (user_id, movement_test_result_id)
  WHERE movement_test_result_id IS NOT NULL;
