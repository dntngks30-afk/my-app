-- ================================================
-- Movement Test Attempts 테이블 (attempt 기반 저장)
-- ================================================
-- PR2: save/retest/get-latest/get-result 모두 이 테이블 사용
-- 기존 movement_test_results와 병행 가능(기존 share_id 호환은 get-result에서 fallback 처리)

-- gen_random_uuid 필요
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.movement_test_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- nullable: 익명 저장 가능성은 남겨두되, PR2 정책은 기본 auth insert만 허용(아래 RLS 참고)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  scoring_version VARCHAR(20) NOT NULL DEFAULT '1.0',

  share_id VARCHAR(12) UNIQUE NOT NULL,
  main_type VARCHAR(10) NOT NULL,
  sub_type VARCHAR(50) NOT NULL,
  confidence INTEGER NOT NULL,
  type_scores JSONB NOT NULL,

  imbalance_yes_count INTEGER DEFAULT 0,
  imbalance_severity VARCHAR(10),
  bias_main_type VARCHAR(1),

  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER,
  view_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_movement_test_attempts_user_id
  ON public.movement_test_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_movement_test_attempts_completed_at
  ON public.movement_test_attempts(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_movement_test_attempts_share_id
  ON public.movement_test_attempts(share_id);

CREATE INDEX IF NOT EXISTS idx_movement_test_attempts_user_completed
  ON public.movement_test_attempts(user_id, completed_at DESC)
  WHERE user_id IS NOT NULL;

-- 3. share_id는 API에서 생성 후 insert (중복 방지)
--   - UNIQUE 충돌 시 서버에서 재시도 필요

-- 4. updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_movement_test_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_movement_test_attempts_updated_at ON public.movement_test_attempts;
CREATE TRIGGER update_movement_test_attempts_updated_at
  BEFORE UPDATE ON public.movement_test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_movement_test_attempts_updated_at();

-- 5. RLS
ALTER TABLE public.movement_test_attempts ENABLE ROW LEVEL SECURITY;

-- 기존 위험 정책 제거(있을 경우)
DROP POLICY IF EXISTS "Anyone can read attempt by share_id" ON public.movement_test_attempts;
DROP POLICY IF EXISTS "Allow insert attempts" ON public.movement_test_attempts;
DROP POLICY IF EXISTS "Allow update view_count" ON public.movement_test_attempts;

-- 5-1) SELECT: 로그인 사용자는 본인 attempt 조회 가능
CREATE POLICY "Read own attempts"
  ON public.movement_test_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5-2) SELECT: 공유 attempt 읽기 허용 (share_id 있는 row만)
-- 주의: RLS만으로 "share_id로 필터링한 조회만 허용"을 강제하긴 어려움.
-- PR4에서 공유는 view/RPC로 최소 필드만 제공하는 방식으로 최종 강화 권장.
CREATE POLICY "Read shared attempts"
  ON public.movement_test_attempts
  FOR SELECT
  USING (share_id IS NOT NULL);

-- 5-3) INSERT: PR2에서는 기본적으로 authenticated만 허용(스팸 방지)
-- 익명 저장을 정말 허용해야 한다면 PR3/PR4에서 별도 방어(레이트리밋/캡차/서버전용 insert) 설계 권장.
CREATE POLICY "Allow insert attempts (auth only)"
  ON public.movement_test_attempts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5-4) UPDATE/DELETE: deny-by-default (정책 없음)
-- 조회수 증가는 아래 RPC 함수로만 처리

-- 5-5) view_count 증가 RPC (security definer)
CREATE OR REPLACE FUNCTION public.increment_attempt_view_count(p_share_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.movement_test_attempts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE share_id = p_share_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_attempt_view_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_attempt_view_count(text) TO anon, authenticated;

-- 6. 코멘트
COMMENT ON TABLE public.movement_test_attempts IS '움직임 타입 테스트 시도(attempt) 단위 저장, PR2';
COMMENT ON COLUMN public.movement_test_attempts.scoring_version IS '스코어링 버전 (예: 1.0)';
COMMENT ON COLUMN public.movement_test_attempts.user_id IS '로그인 시 설정, 익명이면 NULL(현재 PR2 정책은 auth insert only)';
COMMENT ON COLUMN public.movement_test_attempts.share_id IS '공유 링크 키(UNIQUE, API에서 랜덤 생성)';