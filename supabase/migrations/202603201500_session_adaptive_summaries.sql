-- ============================================================
-- PR-B: session_adaptive_summaries (evaluator output)
-- 202603201500_session_adaptive_summaries.sql
-- ============================================================
-- Rule-based session evaluation for future adaptive generation.
-- Populated after session complete from session_exercise_events.
-- service_role only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_adaptive_summaries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_plan_id       UUID NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  session_number        INT NOT NULL,
  exercise_count        INT NOT NULL DEFAULT 0,
  completed_exercises   INT NOT NULL DEFAULT 0,
  skipped_exercises     INT NOT NULL DEFAULT 0,
  avg_rpe                FLOAT NULL,
  avg_discomfort         FLOAT NULL,
  completion_ratio       FLOAT NOT NULL DEFAULT 0,
  effort_mismatch_score  INT NOT NULL DEFAULT 0,
  discomfort_burden_score INT NOT NULL DEFAULT 0,
  dropout_risk_score     INT NOT NULL DEFAULT 0,
  flags                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons                JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(session_plan_id)
);

COMMENT ON TABLE public.session_adaptive_summaries IS
  'PR-B: rule-based session evaluation for adaptive generation. One row per session.';

CREATE INDEX IF NOT EXISTS idx_session_adaptive_summaries_plan
  ON public.session_adaptive_summaries(session_plan_id);

CREATE INDEX IF NOT EXISTS idx_session_adaptive_summaries_user_time
  ON public.session_adaptive_summaries(user_id, created_at DESC);

ALTER TABLE public.session_adaptive_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_session_adaptive_summaries"
  ON public.session_adaptive_summaries
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_select_session_adaptive_summaries"
  ON public.session_adaptive_summaries
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_update_session_adaptive_summaries"
  ON public.session_adaptive_summaries
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
