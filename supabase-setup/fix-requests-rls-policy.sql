-- requests 테이블 RLS 정책 (authenticated, 본인 데이터만)
-- Supabase Dashboard → SQL Editor에서 실행하세요

-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can insert requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can read requests" ON public.requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can read own requests" ON public.requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update own requests" ON public.requests;

-- RLS 활성화
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- INSERT: 인증된 사용자만, 본인 user_id로만 삽입
CREATE POLICY "Users can insert own requests"
  ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: 인증된 사용자만, 본인 행만 조회
CREATE POLICY "Users can read own requests"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- UPDATE: 인증된 사용자만, 본인 행만 수정
CREATE POLICY "Users can update own requests"
  ON public.requests
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
