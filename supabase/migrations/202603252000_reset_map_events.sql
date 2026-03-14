-- PR-RESET-03: Reset Map events / telemetry baseline
-- 202603252000_reset_map_events.sql
-- Minimal event store for flow lifecycle observability. service_role only.

CREATE TABLE IF NOT EXISTS public.reset_map_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_map_events_flow_id
  ON public.reset_map_events(flow_id);
CREATE INDEX IF NOT EXISTS idx_reset_map_events_user_ts
  ON public.reset_map_events(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_reset_map_events_name_ts
  ON public.reset_map_events(name, ts DESC);

ALTER TABLE public.reset_map_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_reset_map_events"
  ON public.reset_map_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.reset_map_events IS 'PR-RESET-03: Reset Map flow lifecycle events. service_role only.';
