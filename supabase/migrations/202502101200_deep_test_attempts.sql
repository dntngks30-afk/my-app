-- ================================================
-- Deep Test Attempts (유료 심화 테스트 전용)
-- Free와 완전 분리, FK/조인 없음
-- ================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.deep_test_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'final')),

  scoring_version TEXT NOT NULL DEFAULT 'deep_v1',

  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB,
  result_type TEXT,
  confidence NUMERIC,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ
);

-- 2. UNIQUE: 사용자당 버전별 1개 (draft 유지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_deep_test_attempts_user_version
  ON public.deep_test_attempts(user_id, scoring_version);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_deep_test_attempts_user_id
  ON public.deep_test_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_deep_test_attempts_finalized_at
  ON public.deep_test_attempts(finalized_at DESC)
  WHERE finalized_at IS NOT NULL;

-- 4. updated_at 트리거
CREATE OR REPLACE FUNCTION public.update_deep_test_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_deep_test_attempts_updated_at ON public.deep_test_attempts;
CREATE TRIGGER update_deep_test_attempts_updated_at
  BEFORE UPDATE ON public.deep_test_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deep_test_attempts_updated_at();

-- 5. RLS
ALTER TABLE public.deep_test_attempts ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인만
DROP POLICY IF EXISTS "Read own deep attempts" ON public.deep_test_attempts;
CREATE POLICY "Read own deep attempts"
  ON public.deep_test_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인만 (user_id 일치)
DROP POLICY IF EXISTS "Insert own deep attempts" ON public.deep_test_attempts;
CREATE POLICY "Insert own deep attempts"
  ON public.deep_test_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: 본인 + draft일 때만 (final 잠금)
DROP POLICY IF EXISTS "Update own draft deep attempts" ON public.deep_test_attempts;
CREATE POLICY "Update own draft deep attempts"
  ON public.deep_test_attempts FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (auth.uid() = user_id);

-- 6. 코멘트
COMMENT ON TABLE public.deep_test_attempts IS '유료 심화 테스트 전용, free와 완전 분리';
COMMENT ON COLUMN public.deep_test_attempts.scoring_version IS '스코어링 버전 (deep_v1)';
