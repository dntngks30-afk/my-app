-- ============================================================
-- P0: Session history contract — 기본값/제약/인덱스
-- 202603041300_session_history_contract.sql
-- ============================================================

-- 1) exercise_logs: null → [] 기본값
ALTER TABLE public.session_plans
  ALTER COLUMN exercise_logs SET DEFAULT '[]'::jsonb;

-- 2) duration_seconds: 기본값 0
ALTER TABLE public.session_plans
  ALTER COLUMN duration_seconds SET DEFAULT 0;

-- 3) status='completed'인데 completed_at NULL인 row 보정
UPDATE public.session_plans
SET completed_at = COALESCE(completed_at, NOW())
WHERE status = 'completed' AND completed_at IS NULL;

-- 4) completed 시 completed_at 필수 (논리 제약)
ALTER TABLE public.session_plans
  DROP CONSTRAINT IF EXISTS session_plans_status_completed_at_check;

ALTER TABLE public.session_plans
  ADD CONSTRAINT session_plans_status_completed_at_check
  CHECK (status != 'completed' OR completed_at IS NOT NULL);

-- 5) history 조회: session_number DESC 정렬용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_session_plans_user_completed_session
  ON public.session_plans(user_id, session_number DESC)
  WHERE status = 'completed';
