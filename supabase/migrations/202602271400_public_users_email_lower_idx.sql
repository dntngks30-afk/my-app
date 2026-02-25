-- 이메일 조회 안정화: lower(email) 인덱스 (대소문자 무시 조회)
-- UNIQUE 금지 (중복 리스크), 비고유 인덱스만
CREATE INDEX IF NOT EXISTS public_users_email_lower_idx
  ON public.users (lower(email))
  WHERE email IS NOT NULL;
