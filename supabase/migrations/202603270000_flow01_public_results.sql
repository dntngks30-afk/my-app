-- ================================================
-- FLOW-01: Public Result Persistence Layer
--
-- public_results — public-first 전환의 핵심 저장소
-- baseline / refined Deep Result V2를 anon-first로 저장
-- 이후 FLOW-05에서 authenticated user로 claim 가능
--
-- 의미적 분리:
--   deep_test_attempts  → 유료 딥테스트 전용 (user_id NOT NULL, 인증 필수)
--   public_results      → public-first 결과 (anon_id, user_id nullable, 인증 선택)
--
-- 스키마 버전 전제:
--   result_v2_json: UnifiedDeepResultV2 JSON 그대로 저장
--   source_inputs:  ['free_survey'] | ['free_survey', 'camera'] 등
--   result_stage:   'baseline' | 'refined'
--   claimed_at:     FLOW-05 claim 시 채워짐 (현재 null)
-- ================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.public_results (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- anon identity (client에서 생성한 UUID, localStorage에서 전송)
  -- FLOW-05 claim 전까지 ownership을 나타냄
  anon_id               TEXT NOT NULL,

  -- 인증 사용자 첨부 (nullable — FLOW-05 claim 후 채워짐)
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Deep Result V2 전체 JSON (UnifiedDeepResultV2 계약)
  result_v2_json        JSONB NOT NULL,

  -- 요약 메타 (FLOW-02 read/handoff 시 빠른 조회용)
  source_inputs         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_mode           TEXT,
  result_stage          TEXT NOT NULL
                          CHECK (result_stage IN ('baseline', 'refined')),
  confidence_normalized NUMERIC,
  evidence_level        TEXT
                          CHECK (evidence_level IN ('lite', 'partial', 'full')),

  -- 스키마 버전 추적 (result_v2_json 구조 변경 시 마이그레이션 판단용)
  schema_version        TEXT NOT NULL DEFAULT 'v2',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- FLOW-05: claim 완료 시각 (null = 미claim)
  claimed_at            TIMESTAMPTZ
);

-- 2. 인덱스
-- id는 PK라 자동 인덱스 존재. FLOW-02 token-based lookup 대비.
CREATE INDEX IF NOT EXISTS idx_public_results_anon_id
  ON public.public_results(anon_id);

CREATE INDEX IF NOT EXISTS idx_public_results_user_id
  ON public.public_results(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_public_results_created_at
  ON public.public_results(created_at DESC);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_public_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_public_results_updated_at ON public.public_results;
CREATE TRIGGER update_public_results_updated_at
  BEFORE UPDATE ON public.public_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_public_results_updated_at();

-- 4. RLS
-- 이 PR에서 모든 API 접근은 service_role(getServerSupabaseAdmin)을 통해 이루어짐.
-- service_role은 RLS를 우회하므로 현재 PR에서는 서버 라우트가 유일한 진입점.
-- 클라이언트 직접 접근 정책은 FLOW-02/05에서 추가 예정.
ALTER TABLE public.public_results ENABLE ROW LEVEL SECURITY;

-- 현재: 클라이언트 직접 접근 없음 (service_role API만 사용)
-- FLOW-02: anon_id 또는 id로 SELECT 접근 정책 추가 예정
-- FLOW-05: user_id claim UPDATE 정책 추가 예정
-- 임시로 빈 정책만 설정 (모든 직접 클라이언트 접근 차단, service_role만 허용)
DROP POLICY IF EXISTS "No direct client access to public_results" ON public.public_results;
CREATE POLICY "No direct client access to public_results"
  ON public.public_results FOR ALL
  USING (false);

-- 5. 코멘트
COMMENT ON TABLE public.public_results IS
  'FLOW-01: public-first 결과 저장소. deep_test_attempts와 분리. anon-first, FLOW-05에서 user claim.';
COMMENT ON COLUMN public.public_results.anon_id IS
  'Client-generated UUID (localStorage moveReAnonId:v1). FLOW-05 claim 전 ownership 식별자.';
COMMENT ON COLUMN public.public_results.user_id IS
  'FLOW-05 claim 후 채워짐. null = 미인증/미claim 상태.';
COMMENT ON COLUMN public.public_results.result_v2_json IS
  'UnifiedDeepResultV2 전체 JSON. schema_version=v2.';
COMMENT ON COLUMN public.public_results.claimed_at IS
  'FLOW-05에서 user_id와 함께 채워짐. null = 미claim.';
