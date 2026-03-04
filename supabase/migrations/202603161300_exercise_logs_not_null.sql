-- ============================================================
-- DB 계약 잠금: session_plans.exercise_logs NOT NULL 보장
-- 202603161300_exercise_logs_not_null.sql
--
-- 전제(이미 적용됨):
--   202603161200: exercise_logs JSONB NULL 컬럼 추가
--   202603161230: 기존 NULL → [] 백필 + DEFAULT '[]'::jsonb 설정
--
-- 이번 migration:
--   NULL 잠금만 수행. API/UI 변경 없음.
-- ============================================================

-- ensure existing NULLs are impossible (should be none due to prior migration)
ALTER TABLE public.session_plans
  ALTER COLUMN exercise_logs SET NOT NULL;
