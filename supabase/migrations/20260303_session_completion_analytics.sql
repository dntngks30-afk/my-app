-- ============================================================
-- BE-05: Session completion analytics
-- duration_seconds, completion_mode on session_plans
-- 20260303_session_completion_analytics.sql
-- ============================================================
-- 기존 migration 파일 수정 없음. session_plans에 컬럼만 추가.

ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS duration_seconds INT NULL,
  ADD COLUMN IF NOT EXISTS completion_mode TEXT NULL
    CHECK (completion_mode IS NULL OR completion_mode IN ('all_done', 'partial_done', 'stop_early'));

-- (completed_at desc) 정렬용 인덱스 — history 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_session_plans_user_completed
  ON public.session_plans(user_id, completed_at DESC NULLS LAST);
