-- ============================================================
-- PR-P1-3: Session snapshot/versioning foundation
-- 202603171200_session_plans_snapshot_versioning.sql
-- ============================================================
-- Additive only. Nullable. Backward compatible.
-- Rollback: DROP COLUMN each (order reversed).

ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS source_deep_attempt_id UUID NULL REFERENCES public.deep_test_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_version TEXT NULL,
  ADD COLUMN IF NOT EXISTS deep_summary_snapshot_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS profile_snapshot_json JSONB NULL,
  ADD COLUMN IF NOT EXISTS generation_trace_json JSONB NULL;

COMMENT ON COLUMN public.session_plans.source_deep_attempt_id IS 'deep_test_attempts row id that was the basis for this session';
COMMENT ON COLUMN public.session_plans.plan_version IS 'session plan generation logic version (e.g. session_plan_v1)';
COMMENT ON COLUMN public.session_plans.deep_summary_snapshot_json IS 'snapshot of deep summary at creation time';
COMMENT ON COLUMN public.session_plans.profile_snapshot_json IS 'snapshot of profile at creation time';
COMMENT ON COLUMN public.session_plans.generation_trace_json IS 'trace of generation inputs and decisions';
