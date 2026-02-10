-- ================================================
-- Subscription & Plans 테이블 생성 및 users 테이블 확장
-- ================================================
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- ================================================
-- 1. users 테이블 확장
-- ================================================

-- 기존 users 테이블에 컬럼 추가 (이미 존재하는 경우 무시)
DO $$ 
BEGIN
  -- plan_tier 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'plan_tier'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN plan_tier VARCHAR(20) DEFAULT 'free' 
    CHECK (plan_tier IN ('free', 'basic', 'standard', 'premium', 'vip'));
  END IF;

  -- plan_status 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'plan_status'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN plan_status VARCHAR(20) DEFAULT 'active' 
    CHECK (plan_status IN ('active', 'inactive', 'cancelled', 'expired'));
  END IF;

  -- stripe_customer_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.users 
    ADD COLUMN stripe_customer_id VARCHAR(255);
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_plan_tier ON public.users(plan_tier);
CREATE INDEX IF NOT EXISTS idx_users_plan_status ON public.users(plan_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);

-- ================================================
-- 2. plans 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  tier VARCHAR(20) UNIQUE NOT NULL CHECK (tier IN ('free', 'basic', 'standard', 'premium', 'vip')),
  price INTEGER NOT NULL,
  billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('free', 'one_time', 'subscription')),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly')),
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  stripe_price_id VARCHAR(255), -- Stripe Price ID
  stripe_product_id VARCHAR(255), -- Stripe Product ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_tier ON public.plans(tier);
CREATE INDEX IF NOT EXISTS idx_plans_is_active ON public.plans(is_active);

-- 초기 플랜 데이터 삽입 (중복 방지)
INSERT INTO public.plans (name, tier, price, billing_type, billing_cycle, features, limits)
SELECT * FROM (VALUES
  ('Free', 'free', 0, 'free', NULL::VARCHAR(20), 
    '{"survey": true, "auto_pdf": true, "video_feedback": false, "zoom": false}'::JSONB,
    '{"pdf_count": 1, "video_feedback": 0, "zoom_sessions": 0}'::JSONB),
  ('Basic', 'basic', 29900, 'one_time', NULL::VARCHAR(20),
    '{"survey": true, "auto_pdf": true, "video_feedback": true, "zoom": false}'::JSONB,
    '{"pdf_count": 1, "video_feedback": 1, "zoom_sessions": 0}'::JSONB),
  ('Standard', 'standard', 49900, 'one_time', NULL::VARCHAR(20),
    '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": false}'::JSONB,
    '{"video_feedback_per_week": 1, "re_assessment_per_month": 2, "history_months": 3}'::JSONB),
  ('Premium', 'premium', 99000, 'subscription', 'monthly',
    '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": true, "schedule_management": true}'::JSONB,
    '{"video_feedback_per_week": 2, "re_assessment_per_month": 4, "zoom_sessions_per_month": 2, "zoom_duration_minutes": 30, "history_months": 12}'::JSONB),
  ('VIP', 'vip', 199000, 'subscription', 'monthly',
    '{"survey": true, "auto_pdf": true, "video_feedback": true, "re_assessment": true, "workout_log": true, "zoom": true, "schedule_management": true, "dedicated_trainer": true, "24h_qa": true, "nutrition": true}'::JSONB,
    '{"video_feedback_unlimited": true, "re_assessment_unlimited": true, "zoom_sessions_per_month": 4, "zoom_duration_minutes": 60, "history_unlimited": true}'::JSONB)
) AS v(name, tier, price, billing_type, billing_cycle, features, limits)
ON CONFLICT (tier) DO NOTHING;

-- ================================================
-- 3. subscriptions 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  billing_type VARCHAR(20) NOT NULL 
    CHECK (billing_type IN ('one_time', 'subscription')),
  
  -- 구독 기간
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  
  -- 자동 갱신
  auto_renew BOOLEAN DEFAULT TRUE,
  
  -- Stripe 관련 필드
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_price_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  
  -- 사용량 추적
  usage_stats JSONB DEFAULT '{}',
  
  -- 취소 정보
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);

-- RLS 활성화
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 구독만 조회 가능
CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 정책: 사용자는 자신의 구독만 업데이트 가능
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS 정책: 관리자는 모든 구독 조회 가능
CREATE POLICY "Admins can read all subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 4. payments 테이블 확장
-- ================================================

-- 기존 payments 테이블에 Stripe 관련 컬럼 추가
DO $$ 
BEGIN
  -- stripe_payment_intent_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE public.payments 
    ADD COLUMN stripe_payment_intent_id VARCHAR(255);
  END IF;

  -- stripe_subscription_id 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.payments 
    ADD COLUMN stripe_subscription_id VARCHAR(255);
  END IF;

  -- payment_provider 컬럼 추가 또는 수정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'payment_provider'
  ) THEN
    ALTER TABLE public.payments 
    ADD COLUMN payment_provider VARCHAR(50) DEFAULT 'toss' 
    CHECK (payment_provider IN ('toss', 'stripe'));
  ELSE
    -- 기존 컬럼이 있으면 CHECK 제약 조건 추가 (제약 조건이 없는 경우)
    BEGIN
      ALTER TABLE public.payments 
      DROP CONSTRAINT IF EXISTS payments_payment_provider_check;
      ALTER TABLE public.payments 
      ADD CONSTRAINT payments_payment_provider_check 
      CHECK (payment_provider IN ('toss', 'stripe'));
    EXCEPTION WHEN OTHERS THEN
      -- 제약 조건이 이미 있거나 다른 이유로 실패하면 무시
      NULL;
    END;
  END IF;

  -- subscription_id 컬럼 추가 (subscriptions 테이블 참조)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE public.payments 
    ADD COLUMN subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_subscription_id ON public.payments(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_provider ON public.payments(payment_provider);

-- ================================================
-- 5. updated_at 자동 업데이트 트리거 함수
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- plans 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- subscriptions 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 완료 확인
-- ================================================

SELECT 
  'Subscription tables created successfully!' as message,
  (SELECT COUNT(*) FROM public.plans) as plans_count,
  (SELECT COUNT(*) FROM public.subscriptions) as subscriptions_count;
