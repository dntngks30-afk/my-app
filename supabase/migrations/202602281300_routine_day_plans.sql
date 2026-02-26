-- routine_day_plans: Day Plan SSOT (Rule-based v1)
-- UNIQUE(routine_id, day_number), 멱등 보장
-- workout_routines 참조 (create-workout-routine-tables.sql 또는 동등 setup 필수)

CREATE TABLE IF NOT EXISTS public.routine_day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.workout_routines(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  
  selected_template_ids TEXT[] NOT NULL,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  constraints_applied TEXT[] NOT NULL DEFAULT '{}',
  
  generator_version TEXT NOT NULL DEFAULT 'gen_v1',
  scoring_version TEXT NOT NULL DEFAULT 'deep_v2',
  rule_version TEXT NOT NULL DEFAULT 'rule_v1',
  
  daily_condition_snapshot JSONB,
  plan_hash TEXT,
  
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(routine_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_routine_day_plans_routine_id
  ON public.routine_day_plans(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_day_plans_created
  ON public.routine_day_plans(created_at_utc);

-- updated_at_utc 트리거
CREATE OR REPLACE FUNCTION public.update_routine_day_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at_utc = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_routine_day_plans_updated_at ON public.routine_day_plans;
CREATE TRIGGER update_routine_day_plans_updated_at
  BEFORE UPDATE ON public.routine_day_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_routine_day_plans_updated_at();

-- RLS
ALTER TABLE public.routine_day_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own routine_day_plans" ON public.routine_day_plans;
CREATE POLICY "Users can read own routine_day_plans"
  ON public.routine_day_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_routines wr
      WHERE wr.id = routine_id AND wr.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: 서비스 역할만 (RLS bypass). anon은 정책 없음으로 거부됨.

-- ================================================
-- routine_day_plan_audit: 재생성 감사 로그
-- ================================================
CREATE TABLE IF NOT EXISTS public.routine_day_plan_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL,
  day_number INTEGER NOT NULL,
  old_plan_hash TEXT,
  new_plan_hash TEXT,
  reason TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_day_plan_audit_routine_day
  ON public.routine_day_plan_audit(routine_id, day_number);

ALTER TABLE public.routine_day_plan_audit ENABLE ROW LEVEL SECURITY;

-- audit: 읽기 정책 없음(내부 전용). 쓰기는 서비스 역할(RLS bypass)
