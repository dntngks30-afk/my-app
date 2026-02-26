-- ================================================
-- user_routines: 7일 루틴 24h/48h 듀얼 타이머 상태 관리
-- ================================================
-- Supabase Dashboard → SQL Editor에서 실행하세요.

-- ================================================
-- 1. user_routines 테이블 생성
-- ================================================

CREATE TABLE IF NOT EXISTS public.user_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_day INTEGER NOT NULL DEFAULT 1 CHECK (current_day >= 1 AND current_day <= 7),
  status VARCHAR(20) NOT NULL DEFAULT 'READY'
    CHECK (status IN ('LOCKED', 'READY', 'ACTIVE', 'COMPLETED')),
  last_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_routines_user_id ON public.user_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_user_routines_status ON public.user_routines(status);
CREATE INDEX IF NOT EXISTS idx_user_routines_last_activated_at ON public.user_routines(last_activated_at);

-- RLS 활성화
ALTER TABLE public.user_routines ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인만 조회/삽입/수정
CREATE POLICY "Users can read own user_routines"
  ON public.user_routines
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_routines"
  ON public.user_routines
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_routines"
  ON public.user_routines
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ================================================
-- 2. updated_at 트리거
-- ================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_routines_updated_at ON public.user_routines;
CREATE TRIGGER update_user_routines_updated_at
  BEFORE UPDATE ON public.user_routines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 완료 확인
-- ================================================

SELECT
  'user_routines table created successfully!' AS message,
  (SELECT COUNT(*) FROM public.user_routines) AS user_routines_count;
