-- PR-RESET-01: Reset Map Flow state machine persistence
-- 202603250000_reset_map_flow.sql
-- Additive migration. No destructive changes.

CREATE TABLE IF NOT EXISTS public.reset_map_flow (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   UUID REFERENCES public.session_plans(id) ON DELETE SET NULL,
  state        TEXT NOT NULL DEFAULT 'started'
    CHECK (state IN ('started', 'preview_ready', 'applied', 'aborted')),
  result       TEXT
    CHECK (result IS NULL OR result IN ('pending', 'applied', 'aborted')),
  flow_version TEXT NOT NULL DEFAULT 'v1',
  variant_tag  TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at   TIMESTAMPTZ,
  aborted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_map_flow_user_id
  ON public.reset_map_flow(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_map_flow_user_created
  ON public.reset_map_flow(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_reset_map_flow_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_reset_map_flow_updated ON public.reset_map_flow;
CREATE TRIGGER trg_reset_map_flow_updated
  BEFORE UPDATE ON public.reset_map_flow
  FOR EACH ROW EXECUTE FUNCTION public.update_reset_map_flow_updated_at();

ALTER TABLE public.reset_map_flow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reset_map_flow_select_own" ON public.reset_map_flow;
CREATE POLICY "reset_map_flow_select_own"
  ON public.reset_map_flow
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.reset_map_flow IS 'PR-RESET-01: Reset Map execution-entry flow state machine. Write via service role only.';
