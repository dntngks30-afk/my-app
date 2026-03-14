-- PR-RESET-04: Preview gate snapshot storage
-- 202603253000_reset_map_preview_snapshot.sql

ALTER TABLE public.reset_map_flow
  ADD COLUMN IF NOT EXISTS preview_snapshot jsonb NULL;

COMMENT ON COLUMN public.reset_map_flow.preview_snapshot IS 'PR-RESET-04: Preview quality signals snapshot.';
