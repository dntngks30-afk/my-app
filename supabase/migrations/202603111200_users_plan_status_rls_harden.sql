-- ================================================
-- users: plan_status/plan_tier 클라이언트 업데이트 차단 강화
-- SSOT: plan_status는 verify-session/webhook(service_role)만 변경
-- ================================================

-- 기존 UPDATE 정책 제거 (이름 상이할 수 있음)
DROP POLICY IF EXISTS "users cannot self update plan" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own_data" ON public.users;

-- 클라이언트(anon/authenticated)는 users 테이블 UPDATE 불가
-- service_role은 RLS bypass로 verify-session/webhook에서 plan_status 업데이트 가능
CREATE POLICY "users_no_client_update"
  ON public.users
  FOR UPDATE
  USING (false);

COMMENT ON POLICY "users_no_client_update" ON public.users IS
  'Blocks all client updates. plan_status/plan_tier only via service_role (verify-session, webhook).';
