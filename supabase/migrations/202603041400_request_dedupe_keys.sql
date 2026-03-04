-- ============================================================
-- P0: request_dedupe_keys — create/complete 폭주 방어
-- 202603041400_request_dedupe_keys.sql
-- ============================================================
-- 짧은 윈도우(10초)에서 동일 요청 de-dupe.
-- service_role만 접근.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.request_dedupe_keys (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  route text NOT NULL,
  dedupe_key text NOT NULL,
  kst_day date NULL,
  session_number int NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'inflight'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_request_dedupe_unique
  ON public.request_dedupe_keys(route, user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_request_dedupe_expires
  ON public.request_dedupe_keys(expires_at);

CREATE INDEX IF NOT EXISTS idx_request_dedupe_user_time
  ON public.request_dedupe_keys(user_id, created_at DESC);

ALTER TABLE public.request_dedupe_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_request_dedupe_keys"
  ON public.request_dedupe_keys
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_select_request_dedupe_keys"
  ON public.request_dedupe_keys
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_delete_request_dedupe_keys"
  ON public.request_dedupe_keys
  FOR DELETE
  TO service_role
  USING (true);

CREATE POLICY "service_role_update_request_dedupe_keys"
  ON public.request_dedupe_keys
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
