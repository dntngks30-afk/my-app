-- ============================================================
-- P0: session_events — 운영 디버깅/감사 로그 (증거 기반)
-- 202603041330_session_events_audit.sql
-- ============================================================
-- DAILY_LIMIT_REACHED, create/complete 레이스, CS 대응용 이벤트 기록.
-- exercise_logs 원문 저장 금지. meta는 요약/메타만.
-- 운영자(service_role)만 조회 가능.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  session_number int NULL,
  kst_day date NULL DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date),
  request_id uuid NULL,
  status text NULL,
  code text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_events_user_time
  ON public.session_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_events_type_time
  ON public.session_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_events_kst_day
  ON public.session_events(kst_day, created_at DESC);

ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_session_events"
  ON public.session_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_select_session_events"
  ON public.session_events
  FOR SELECT
  TO service_role
  USING (true);
