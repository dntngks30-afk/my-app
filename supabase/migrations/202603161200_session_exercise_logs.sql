-- ============================================================
-- PR BE REC01: Session exercise logs (세트/횟수/난이도)
-- 202603161200_session_exercise_logs.sql
-- ============================================================
-- session_plans에 exercise_logs JSONB 추가.
-- complete 시 저장, history에서 노출.

ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS exercise_logs JSONB NULL;

COMMENT ON COLUMN public.session_plans.exercise_logs IS
  '운동별 기록 (세트/횟수/난이도). v1: [{ templateId, name, sets, reps, difficulty }]';
