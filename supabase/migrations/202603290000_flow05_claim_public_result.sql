-- ================================================
-- FLOW-05: Claim Public Result
--
-- public_results 테이블에 FLOW-05 claim 관련 RLS 정책 추가.
-- claim은 service_role API를 통해 처리되므로
-- 이 마이그레이션은 RLS 정책을 명시적으로 기록/문서화하는 목적.
--
-- 현재 claim 경로:
--   POST /api/public-results/[id]/claim
--   → claimPublicResult.ts (getServerSupabaseAdmin 사용 = service_role)
--   → RLS 우회 → user_id / claimed_at 업데이트
--
-- 추가 변경 없음: user_id / claimed_at 컬럼은 FLOW-01에서 이미 정의됨.
--   user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL  (nullable)
--   claimed_at  TIMESTAMPTZ                                         (nullable)
--
-- FLOW-06/07 대비:
-- - user_id IS NOT NULL 인덱스는 FLOW-01에서 이미 생성됨
-- - claimed_at로 "이 결과가 특정 user에 귀속됨" 확인 가능
-- - session generate 시 WHERE user_id = $1 AND claimed_at IS NOT NULL 조건 사용 예정
-- ================================================

-- RLS 정책 주석 업데이트 (FLOW-05 완료 반영)
COMMENT ON COLUMN public.public_results.user_id IS
  'FLOW-05 claim 완료 후 채워짐. null = 미인증/미claim 상태.';

COMMENT ON COLUMN public.public_results.claimed_at IS
  'FLOW-05에서 user_id와 함께 채워짐. null = 미claim. service_role API를 통해서만 업데이트.';

-- claimed row 빠른 조회용 인덱스 (FLOW-06 session generate 대비)
CREATE INDEX IF NOT EXISTS idx_public_results_user_claimed
  ON public.public_results(user_id, claimed_at)
  WHERE user_id IS NOT NULL AND claimed_at IS NOT NULL;
