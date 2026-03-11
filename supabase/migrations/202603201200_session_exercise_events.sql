-- ============================================================
-- PR-A: per-set session exercise events (drift/dropout/adaptive)
-- 202603201200_session_exercise_events.sql
-- ============================================================
-- Minimal event logging for future drift/dropout/adaptive logic.
-- Populated on session complete from exercise_logs + plan_json.
-- Additive only. service_role write only.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_exercise_events (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_plan_id  UUID NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  session_number   INT NOT NULL,
  template_id      TEXT NOT NULL,
  segment_title    TEXT NOT NULL DEFAULT '',
  set_index        INT NOT NULL,
  prescribed_sets  INT NOT NULL DEFAULT 1,
  prescribed_reps  INT NULL,
  prescribed_hold_seconds INT NULL,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  skipped          BOOLEAN NOT NULL DEFAULT FALSE,
  actual_reps      INT NULL,
  actual_hold_seconds INT NULL,
  rpe              INT NULL,
  discomfort       INT NULL,
  difficulty_variant INT NULL,
  started_at       TIMESTAMPTZ NULL,
  completed_at     TIMESTAMPTZ NULL,
  idle_seconds     INT NULL,
  event_source     TEXT NOT NULL DEFAULT 'complete'
    CHECK (event_source IN ('player', 'complete')),
  routine_id       UUID NULL
);

COMMENT ON TABLE public.session_exercise_events IS
  'PR-A: per-set execution events for drift/dropout/adaptive. Populated on session complete.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_exercise_events_dedup
  ON public.session_exercise_events(session_plan_id, template_id, set_index, event_source);

CREATE INDEX IF NOT EXISTS idx_session_exercise_events_user_time
  ON public.session_exercise_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_exercise_events_plan
  ON public.session_exercise_events(session_plan_id);

ALTER TABLE public.session_exercise_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_session_exercise_events"
  ON public.session_exercise_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_select_session_exercise_events"
  ON public.session_exercise_events
  FOR SELECT
  TO service_role
  USING (true);
