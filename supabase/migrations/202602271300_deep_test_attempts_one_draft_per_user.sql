-- ================================================
-- deep_test_attempts: draft 1개만 허용 (user_id + scoring_version)
-- 결제 성공 후 redirect/새로고침 반복으로 draft 중복 생성 방지
-- ================================================

-- 사전 점검: draft 중복이 있으면 적용 전 정리 필요
--   SELECT user_id, scoring_version, COUNT(*) AS cnt
--   FROM public.deep_test_attempts WHERE status='draft'
--   GROUP BY user_id, scoring_version HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS deep_test_attempts_one_draft_per_user_v
  ON public.deep_test_attempts (user_id, scoring_version)
  WHERE status = 'draft';
