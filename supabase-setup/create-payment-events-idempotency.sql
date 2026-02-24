-- ================================================
-- payment_events 테이블 (결제 멱등성)
-- ================================================
-- Stripe: event_id = Stripe event id (evt_xxx)
-- Toss:   event_id = orderId
-- 같은 provider+event_id가 2번 와도 1번만 처리되도록 UNIQUE 제약 사용
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
