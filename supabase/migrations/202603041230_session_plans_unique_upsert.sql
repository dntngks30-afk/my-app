-- ============================================================
-- P0: Ensure session_plans UNIQUE(user_id, session_number)
-- 202603041230_session_plans_unique_upsert.sql
-- ============================================================
-- Original schema (20260303_session_pathB) already has UNIQUE inline.
-- This migration ensures the constraint exists (idempotent for fresh deploys).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.session_plans'::regclass
      AND contype = 'u'
  ) THEN
    ALTER TABLE public.session_plans
      ADD CONSTRAINT session_plans_user_id_session_number_key
      UNIQUE (user_id, session_number);
  END IF;
END $$;
