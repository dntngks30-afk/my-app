-- P0-09: 프로그램 종료 정책 — session_program_progress 정합성 제약
-- target_frequency 2/3/4/5 → total_sessions 8/12/16/20 SSOT 강제
-- 주의: 운영에 total_sessions NOT IN (8,12,16,20) 데이터가 있으면 마이그레이션 실패.
--       선행: SELECT user_id, total_sessions FROM session_program_progress WHERE total_sessions NOT IN (8,12,16,20);

DO $$
BEGIN
  IF to_regclass('public.session_program_progress') IS NOT NULL THEN
    -- 1) 비정규 total_sessions 보정 (기본 16)
    UPDATE public.session_program_progress
    SET total_sessions = 16
    WHERE total_sessions IS NULL OR total_sessions NOT IN (8, 12, 16, 20);

    -- 2) total_sessions 유효값 제약 (pathB의 total_sessions>0 대체)
    ALTER TABLE public.session_program_progress
      DROP CONSTRAINT IF EXISTS session_program_progress_total_sessions_check;
    ALTER TABLE public.session_program_progress
      DROP CONSTRAINT IF EXISTS spp_total_sessions_valid;
    ALTER TABLE public.session_program_progress
      ADD CONSTRAINT spp_total_sessions_valid CHECK (total_sessions IN (8, 12, 16, 20));
  END IF;
END $$;
