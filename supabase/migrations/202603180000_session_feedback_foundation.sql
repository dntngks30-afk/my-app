-- ============================================================
-- PR-P2-1: Session feedback foundation (additive only)
-- 202603180000_session_feedback_foundation.sql
-- ============================================================
-- 목적: 다음 세션 적응형 조정에 필요한 수행/체감 데이터 저장.
-- 범위: 데이터 수집 foundation. adaptation 로직은 별도 PR.
-- 원칙: additive only, backward compatible, idempotent upsert.
-- Rollback: DROP TABLE exercise_feedback; DROP TABLE session_feedback;

-- ============================================================
-- 1. session_feedback
--    세션 단위 피드백 (RPE, 통증, 난이도 체감 등)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.session_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id   UUID NULL REFERENCES public.session_plans(id) ON DELETE SET NULL,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_number    INT  NOT NULL CHECK (session_number >= 1),
  overall_rpe       INT  NULL CHECK (overall_rpe IS NULL OR (overall_rpe >= 1 AND overall_rpe <= 10)),
  pain_after        INT  NULL CHECK (pain_after IS NULL OR (pain_after >= 0 AND pain_after <= 10)),
  difficulty_feedback TEXT NULL CHECK (difficulty_feedback IS NULL OR difficulty_feedback IN ('too_easy', 'ok', 'too_hard')),
  completion_ratio  NUMERIC NULL CHECK (completion_ratio IS NULL OR (completion_ratio >= 0 AND completion_ratio <= 1)),
  time_overrun      BOOLEAN NULL,
  note              TEXT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_number)
);

COMMENT ON TABLE public.session_feedback IS '세션 단위 피드백 (RPE, 통증, 난이도 체감). 향후 adaptive progression용.';
COMMENT ON COLUMN public.session_feedback.overall_rpe IS 'RPE 1~10';
COMMENT ON COLUMN public.session_feedback.pain_after IS '운동 후 통증 0~10';
COMMENT ON COLUMN public.session_feedback.difficulty_feedback IS 'too_easy | ok | too_hard';
COMMENT ON COLUMN public.session_feedback.completion_ratio IS '0~1 완료 비율';

CREATE INDEX IF NOT EXISTS idx_session_feedback_user_session
  ON public.session_feedback(user_id, session_number);
CREATE INDEX IF NOT EXISTS idx_session_feedback_session_plan
  ON public.session_feedback(session_plan_id) WHERE session_plan_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_session_feedback_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_session_feedback_updated ON public.session_feedback;
CREATE TRIGGER trg_session_feedback_updated
  BEFORE UPDATE ON public.session_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_session_feedback_updated_at();

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_feedback_select_own" ON public.session_feedback;
CREATE POLICY "session_feedback_select_own"
  ON public.session_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE: 정책 없음 → service role만 write 가능

-- ============================================================
-- 2. exercise_feedback
--    운동 단위 피드백 (완료율, 난이도 체감, 통증 변화, 스킵 등)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exercise_feedback (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_feedback_id UUID NULL REFERENCES public.session_feedback(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_number      INT  NOT NULL CHECK (session_number >= 1),
  exercise_key        TEXT NOT NULL,
  completion_ratio    NUMERIC NULL CHECK (completion_ratio IS NULL OR (completion_ratio >= 0 AND completion_ratio <= 1)),
  perceived_difficulty INT NULL CHECK (perceived_difficulty IS NULL OR (perceived_difficulty >= 1 AND perceived_difficulty <= 5)),
  pain_delta          INT NULL CHECK (pain_delta IS NULL OR (pain_delta >= -5 AND pain_delta <= 10)),
  was_replaced        BOOLEAN NULL,
  skipped             BOOLEAN NULL,
  disliked_reason    TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_number, exercise_key)
);

COMMENT ON TABLE public.exercise_feedback IS '운동 단위 피드백. templateId 기준 exercise_key. 향후 adaptive progression용.';
COMMENT ON COLUMN public.exercise_feedback.exercise_key IS 'templateId 또는 item_N fallback';
COMMENT ON COLUMN public.exercise_feedback.perceived_difficulty IS '1~5 난이도 체감';
COMMENT ON COLUMN public.exercise_feedback.pain_delta IS '운동 전후 통증 변화 -5~+5 또는 0~10';

CREATE INDEX IF NOT EXISTS idx_exercise_feedback_user_session
  ON public.exercise_feedback(user_id, session_number);
CREATE INDEX IF NOT EXISTS idx_exercise_feedback_session_feedback
  ON public.exercise_feedback(session_feedback_id) WHERE session_feedback_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_exercise_feedback_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_exercise_feedback_updated ON public.exercise_feedback;
CREATE TRIGGER trg_exercise_feedback_updated
  BEFORE UPDATE ON public.exercise_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_exercise_feedback_updated_at();

ALTER TABLE public.exercise_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercise_feedback_select_own" ON public.exercise_feedback;
CREATE POLICY "exercise_feedback_select_own"
  ON public.exercise_feedback
  FOR SELECT
  USING (auth.uid() = user_id);
