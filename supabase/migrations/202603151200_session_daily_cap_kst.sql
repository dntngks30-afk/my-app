-- ============================================================
-- BE: Max 1 completed session per KST day
-- 202603151200_session_daily_cap_kst.sql
-- ============================================================
-- session_program_progress에 KST 기준 일별 완료 추적 컬럼 추가.
-- create 시 last_completed_day_key == todayKstDayKey 이면 409 반환.

ALTER TABLE public.session_program_progress
  ADD COLUMN IF NOT EXISTS last_completed_day_key DATE NULL;

COMMENT ON COLUMN public.session_program_progress.last_completed_day_key IS
  'KST day (YYYY-MM-DD) when last session was completed. Used for daily cap enforcement.';
