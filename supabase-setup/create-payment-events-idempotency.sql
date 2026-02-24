-- ================================================
-- payment_events 테이블 (Webhook 멱등성)
-- ================================================
-- 같은 Stripe/결제 provider 이벤트가 2번 와도 1번만 처리되도록 event_id UNIQUE 제약 사용
-- Supabase Dashboard → SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event_id
  ON public.payment_events(provider, event_id);
