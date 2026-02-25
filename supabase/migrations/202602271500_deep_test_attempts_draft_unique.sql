-- ================================================
-- deep_test_attempts: draft 중복 차단
-- 1) status에 'archived' 추가 (중복 정리용)
-- 2) 중복 draft 정리 (최신 1개 제외 archived)
-- 3) partial unique: (user_id, scoring_version) where status='draft'
-- ================================================

-- 1) status CHECK에 'archived' 추가
ALTER TABLE public.deep_test_attempts
  DROP CONSTRAINT IF EXISTS deep_test_attempts_status_check;
ALTER TABLE public.deep_test_attempts
  ADD CONSTRAINT deep_test_attempts_status_check
  CHECK (status IN ('draft', 'final', 'archived'));

-- 2) 중복 draft 정리: (user_id, scoring_version)별 최신 1개만 draft 유지, 나머지 archived
WITH ranked AS (
  SELECT id, user_id, scoring_version,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, scoring_version
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM public.deep_test_attempts
  WHERE status = 'draft'
)
UPDATE public.deep_test_attempts d
SET status = 'archived', updated_at = now()
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

-- 3) partial unique: draft는 (user_id, scoring_version)당 1개만
CREATE UNIQUE INDEX IF NOT EXISTS deep_test_attempts_one_draft_per_user
  ON public.deep_test_attempts (user_id, scoring_version)
  WHERE status = 'draft';
