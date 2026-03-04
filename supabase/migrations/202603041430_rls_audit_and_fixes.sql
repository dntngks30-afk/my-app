-- ============================================================
-- P0: RLS audit & minimal policy fixes — session rail
-- 202603041430_rls_audit_and_fixes.sql
-- ============================================================
-- 증거 기반 감사: 테이블 존재 시에만 적용.
-- 민감 테이블(session_events, request_dedupe_keys): authenticated 접근 0.
-- 비민감 테이블: SELECT만 authenticated, write는 service_role.
-- ============================================================

-- 1) session_program_progress — SELECT 정책 보강 (idempotent)
DO $$
BEGIN
  IF to_regclass('public.session_program_progress') IS NOT NULL THEN
    ALTER TABLE public.session_program_progress ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "session_program_progress_select_own" ON public.session_program_progress;
    CREATE POLICY "session_program_progress_select_own"
      ON public.session_program_progress
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
    COMMENT ON TABLE public.session_program_progress IS
      'RLS: SELECT authenticated(own), INSERT/UPDATE/DELETE service_role only.';
  END IF;
END $$;

-- 2) session_plans — SELECT 정책 & 제약 점검
DO $$
BEGIN
  IF to_regclass('public.session_plans') IS NOT NULL THEN
    ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "session_plans_select_own" ON public.session_plans;
    CREATE POLICY "session_plans_select_own"
      ON public.session_plans
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
    COMMENT ON TABLE public.session_plans IS
      'RLS: SELECT authenticated(own), INSERT/UPDATE/DELETE service_role only. UNIQUE(user_id,session_number).';
  END IF;
END $$;

-- 3) session_events (민감) — authenticated 정책 제거(있다면). service_role 정책은 202603041330에서 생성됨.
DO $$
BEGIN
  IF to_regclass('public.session_events') IS NOT NULL THEN
    ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "session_events_select_authenticated" ON public.session_events;
    DROP POLICY IF EXISTS "session_events_insert_authenticated" ON public.session_events;
    DROP POLICY IF EXISTS "session_events_insert_own" ON public.session_events;
    DROP POLICY IF EXISTS "session_events_select_own" ON public.session_events;
    COMMENT ON TABLE public.session_events IS
      'RLS: service_role only. authenticated/anon 접근 불가.';
  END IF;
END $$;

-- 4) request_dedupe_keys (민감) — authenticated 정책 제거(있다면). service_role 정책은 202603041400에서 생성됨.
DO $$
BEGIN
  IF to_regclass('public.request_dedupe_keys') IS NOT NULL THEN
    ALTER TABLE public.request_dedupe_keys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "request_dedupe_keys_select_authenticated" ON public.request_dedupe_keys;
    DROP POLICY IF EXISTS "request_dedupe_keys_insert_authenticated" ON public.request_dedupe_keys;
    DROP POLICY IF EXISTS "request_dedupe_keys_insert_own" ON public.request_dedupe_keys;
    DROP POLICY IF EXISTS "request_dedupe_keys_select_own" ON public.request_dedupe_keys;
    COMMENT ON TABLE public.request_dedupe_keys IS
      'RLS: service_role only. authenticated/anon 접근 불가.';
  END IF;
END $$;
