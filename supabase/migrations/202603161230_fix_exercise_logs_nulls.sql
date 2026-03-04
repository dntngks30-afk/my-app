-- ============================================================
-- PR4A-Delta: exercise_logs NULL 보정 + DEFAULT 보장
-- 202603161230_fix_exercise_logs_nulls.sql
-- ============================================================
-- 전제: exercise_logs 컬럼은 202603161200에서 추가됨.
-- 이 migration은 그 다음 시점에 실행. 기존 202603041300 수정 없이 보강만.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'session_plans' AND column_name = 'exercise_logs'
  ) THEN
    -- 1) 기존 NULL row 보정
    UPDATE public.session_plans
    SET exercise_logs = '[]'::jsonb
    WHERE exercise_logs IS NULL;

    -- 2) 기본값 보장 (신규 row)
    ALTER TABLE public.session_plans
      ALTER COLUMN exercise_logs SET DEFAULT '[]'::jsonb;
  END IF;
END $$;
