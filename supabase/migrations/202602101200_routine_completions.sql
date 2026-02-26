-- routine_completions: 7일 루틴 완료 기록 (멱등)
-- 정책 B: 로그만 저장, user_routines.last_activated_at은 변경하지 않음
-- UNIQUE(user_id, day_number, started_at_utc)로 멱등 보장

CREATE TABLE IF NOT EXISTS public.routine_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  started_at_utc TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, day_number, started_at_utc)
);

-- 인덱스: current_day 기준 완료 여부 조회용
CREATE INDEX IF NOT EXISTS idx_routine_completions_user_day
  ON public.routine_completions(user_id, day_number);

-- RLS
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인만 조회
DROP POLICY IF EXISTS "Users can read own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can read own routine_completions"
  ON public.routine_completions
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: 본인만 삽입 (멱등은 ON CONFLICT로 처리)
DROP POLICY IF EXISTS "Users can insert own routine_completions" ON public.routine_completions;
CREATE POLICY "Users can insert own routine_completions"
  ON public.routine_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RPC: 멱등 삽입 후 실제 삽입 여부 반환 (complete-session API용)
CREATE OR REPLACE FUNCTION public.insert_routine_completion_if_new(
  p_user_id uuid,
  p_day_number int,
  p_started_at_utc timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.routine_completions (user_id, day_number, started_at_utc)
  VALUES (p_user_id, p_day_number, p_started_at_utc)
  ON CONFLICT (user_id, day_number, started_at_utc) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
