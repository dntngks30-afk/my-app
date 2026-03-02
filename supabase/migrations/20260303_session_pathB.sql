-- ============================================================
-- Path B: Session Rail (독립 레일 — 7일 테이블/정책 완전 분리)
-- 20260303_session_pathB.sql
-- ============================================================
-- 설계 원칙:
--   • 기존 user_routines / routine_completions / routine_day_plans 와 JOIN 없음
--   • 테이블명은 반드시 "session_" prefix
--   • RLS: SELECT만 허용(본인 row). INSERT/UPDATE/DELETE는 클라 direct write 금지.
--   • DB write는 서버(service role)에서만 수행 — RLS bypass 가능한 admin client 사용.

-- ============================================================
-- 1. session_user_profile
--    사용자의 세션 프로그램 설정 (1인 1행)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_user_profile (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_frequency SMALLINT NOT NULL DEFAULT 4
    CHECK (target_frequency IN (2, 3, 4, 5)),
  lifestyle_tag    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.session_user_profile ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 row만 허용
DROP POLICY IF EXISTS "session_user_profile_select_own" ON public.session_user_profile;
CREATE POLICY "session_user_profile_select_own"
  ON public.session_user_profile
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: 정책 없음 → 클라 direct write 완전 차단 (service role만 가능)

-- ============================================================
-- 2. session_program_progress
--    유저별 세션 프로그램 진행 상태 (1인 1행)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_program_progress (
  user_id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  program_version       TEXT NOT NULL DEFAULT 'session_v1',
  scoring_version       TEXT NOT NULL DEFAULT 'deep_v2',
  total_sessions        INT  NOT NULL DEFAULT 16 CHECK (total_sessions > 0),
  completed_sessions    INT  NOT NULL DEFAULT 0  CHECK (completed_sessions >= 0),
  active_session_number INT  CHECK (active_session_number IS NULL OR active_session_number >= 1),
  last_completed_at     TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT spp_completed_le_total CHECK (completed_sessions <= total_sessions)
);

CREATE OR REPLACE FUNCTION public.update_session_program_progress_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_spp_updated ON public.session_program_progress;
CREATE TRIGGER trg_spp_updated
  BEFORE UPDATE ON public.session_program_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_session_program_progress_updated_at();

ALTER TABLE public.session_program_progress ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 row만 허용
DROP POLICY IF EXISTS "session_program_progress_select_own" ON public.session_program_progress;
CREATE POLICY "session_program_progress_select_own"
  ON public.session_program_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: 정책 없음 → 클라 direct write 완전 차단 (service role만 가능)

-- ============================================================
-- 3. session_plans
--    세션별 플랜 (멱등: UNIQUE(user_id, session_number))
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_number   INT  NOT NULL CHECK (session_number >= 1),
  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'started', 'completed')),
  theme            TEXT NOT NULL,
  plan_json        JSONB NOT NULL DEFAULT '{}',
  condition        JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  UNIQUE(user_id, session_number)
);

-- 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_session_plans_user_status
  ON public.session_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_session_plans_user_created
  ON public.session_plans(user_id, created_at DESC);

ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 row만 허용
DROP POLICY IF EXISTS "session_plans_select_own" ON public.session_plans;
CREATE POLICY "session_plans_select_own"
  ON public.session_plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: 정책 없음 → 클라 direct write 완전 차단 (service role만 가능)

-- ============================================================
-- 추가 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_session_program_progress_user_id
  ON public.session_program_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_session_user_profile_user_id
  ON public.session_user_profile(user_id);

-- ============================================================
-- RLS 설계 주석 (문서화)
-- ============================================================
-- [RLS 정책 설계 근거]
-- 1. SELECT only: 각 테이블에 SELECT 정책만 존재.
--    클라이언트가 anon key로 INSERT/UPDATE/DELETE 시도 시 RLS에 막혀 "new row violates RLS" 에러 발생.
-- 2. service role(서버 admin client)은 RLS를 bypass함.
--    따라서 /api/session/* 라우트에서 getServerSupabaseAdmin()을 통한 write는 정상 동작.
-- 3. 이 구조는 "fail-close" 원칙: 명시적 허용이 없으면 기본 차단.
