-- PR-RESET-06: At most one active flow per user
-- 202603254000_reset_map_active_flow_uniqueness.sql
-- Partial unique index: user_id unique where state in (started, preview_ready)

CREATE UNIQUE INDEX IF NOT EXISTS idx_reset_map_flow_user_active_unique
  ON public.reset_map_flow(user_id)
  WHERE state IN ('started', 'preview_ready');

COMMENT ON INDEX public.idx_reset_map_flow_user_active_unique IS
  'PR-RESET-06: One active flow per user. Insert fails with 23505 if duplicate.';
