-- ================================================
-- Movement Type Test Results 테이블 생성
-- ================================================

-- 테이블 생성
CREATE TABLE IF NOT EXISTS public.movement_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id VARCHAR(12) UNIQUE NOT NULL, -- 공유용 짧은 ID
  
  -- 결과 데이터
  main_type VARCHAR(10) NOT NULL, -- 담직, 날림, 버팀, 흘림
  sub_type VARCHAR(50) NOT NULL, -- 서브타입 한글명
  confidence INTEGER NOT NULL, -- 0-100
  
  -- 점수 데이터 (JSON)
  type_scores JSONB NOT NULL, -- {D: 10, N: 5, B: 3, H: 2}
  
  -- 불균형 데이터
  imbalance_yes_count INTEGER DEFAULT 0,
  imbalance_severity VARCHAR(10), -- none, mild, strong
  bias_main_type VARCHAR(1), -- D, N, B, H
  
  -- 메타데이터
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER, -- 테스트 소요 시간
  
  -- 통계
  view_count INTEGER DEFAULT 0, -- 조회수
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_movement_test_results_share_id 
  ON public.movement_test_results(share_id);

CREATE INDEX IF NOT EXISTS idx_movement_test_results_created_at 
  ON public.movement_test_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movement_test_results_main_type 
  ON public.movement_test_results(main_type);

-- RLS 정책 설정 (읽기는 누구나, 쓰기는 제한)
ALTER TABLE public.movement_test_results ENABLE ROW LEVEL SECURITY;

-- 모든 사람이 결과를 조회 가능
CREATE POLICY "Anyone can view shared results"
  ON public.movement_test_results
  FOR SELECT
  USING (true);

-- 익명 사용자도 결과 저장 가능 (공유 기능용)
CREATE POLICY "Anyone can insert results"
  ON public.movement_test_results
  FOR INSERT
  WITH CHECK (true);

-- 조회수 업데이트 허용
CREATE POLICY "Anyone can update view count"
  ON public.movement_test_results
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_movement_test_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_movement_test_results_updated_at
  BEFORE UPDATE ON public.movement_test_results
  FOR EACH ROW
  EXECUTE FUNCTION update_movement_test_results_updated_at();

-- 공유 ID 생성 함수 (짧고 읽기 쉬운 ID)
CREATE OR REPLACE FUNCTION generate_share_id()
RETURNS TEXT AS $$
DECLARE
  characters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 혼동되는 문자 제외
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(characters, floor(random() * length(characters) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 기본 share_id 설정
ALTER TABLE public.movement_test_results 
  ALTER COLUMN share_id SET DEFAULT generate_share_id();

COMMENT ON TABLE public.movement_test_results IS '움직임 타입 테스트 결과 저장 및 공유';
COMMENT ON COLUMN public.movement_test_results.share_id IS '공유용 짧은 ID (8자리)';
COMMENT ON COLUMN public.movement_test_results.view_count IS '결과 조회 횟수';
