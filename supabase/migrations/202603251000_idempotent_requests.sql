-- PR-RESET-02: Idempotency layer for reset-map start/apply
-- 202603251000_idempotent_requests.sql
-- Persistent idempotency per key. No TTL. service_role only.

CREATE TABLE IF NOT EXISTS public.idempotent_requests (
  idempotency_key text PRIMARY KEY,
  route_key text NOT NULL,
  user_id uuid NOT NULL,
  fingerprint_hash text NOT NULL,
  status_code int NOT NULL,
  response_body jsonb NOT NULL,
  flow_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotent_requests_route_user
  ON public.idempotent_requests(route_key, user_id);

ALTER TABLE public.idempotent_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_idempotent_requests"
  ON public.idempotent_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.idempotent_requests IS 'PR-RESET-02: Reset-map idempotency. service_role only.';
