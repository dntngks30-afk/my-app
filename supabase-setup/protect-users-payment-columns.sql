-- ================================================
-- users 테이블: plan_status/role 등 결제·권한 컬럼 클라이언트 수정 차단
-- ================================================
-- 목적: RLS "Users can update own data" 정책이 WITH CHECK 없이
--      전체 컬럼 UPDATE를 허용하는 취약점을 트리거로 2중 방어
--
-- 동작:
-- - 서버(service_role, rolbypassrls=true): plan_status 등 수정 허용
-- - 클라이언트(authenticated): plan_status, plan_tier, role, stripe_customer_id 수정 시 EXCEPTION
--
-- 실행: Supabase Dashboard → SQL Editor에서 실행
-- 롤백: 파일 하단 주석 참고
-- ================================================

-- 1. 트리거 함수
CREATE OR REPLACE FUNCTION public.prevent_payment_column_update()
RETURNS TRIGGER AS $$
DECLARE
  is_server boolean;
BEGIN
  -- 서버 연결: postgres, supabase_admin, service_role, 또는 rolbypassrls=true
  is_server := (
    current_user IN ('postgres', 'supabase_admin', 'service_role')
    OR COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user), false)
  );

  IF is_server THEN
    RETURN NEW;
  END IF;

  -- 클라이언트: 결제/권한 컬럼 변경 차단
  IF (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'plan_status'
  )) AND (NEW.plan_status IS DISTINCT FROM OLD.plan_status) THEN
    RAISE EXCEPTION 'Unauthorized: plan_status cannot be modified by client';
  END IF;

  IF (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'plan_tier'
  )) AND (NEW.plan_tier IS DISTINCT FROM OLD.plan_tier) THEN
    RAISE EXCEPTION 'Unauthorized: plan_tier cannot be modified by client';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Unauthorized: role cannot be modified by client';
  END IF;

  IF (SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'stripe_customer_id'
  )) AND (NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id) THEN
    RAISE EXCEPTION 'Unauthorized: stripe_customer_id cannot be modified by client';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 트리거 생성
DROP TRIGGER IF EXISTS protect_users_payment_columns ON public.users;
CREATE TRIGGER protect_users_payment_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payment_column_update();

-- 3. 검증 (선택)
-- SELECT 'protect_users_payment_columns trigger created' AS message;

-- ================================================
-- 롤백 (필요 시 실행):
-- DROP TRIGGER IF EXISTS protect_users_payment_columns ON public.users;
-- DROP FUNCTION IF EXISTS public.prevent_payment_column_update();
-- ================================================
