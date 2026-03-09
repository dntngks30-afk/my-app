-- PR-ALG-06: session_plans에 execution_summary_json 추가
-- additive only, nullable, backward compatible

ALTER TABLE public.session_plans
  ADD COLUMN IF NOT EXISTS execution_summary_json JSONB NULL;

COMMENT ON COLUMN public.session_plans.execution_summary_json IS
  'execution summary snapshot at complete time (feedback-derived, deterministic)';
