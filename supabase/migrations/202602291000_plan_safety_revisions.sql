-- PR-P3-06: Safety-mode regeneration policy
-- routine_day_plans: safety_mode, safety_reason, revision_no
-- routine_day_plan_audit: created_by (user_id), revision_no

ALTER TABLE public.routine_day_plans
  ADD COLUMN IF NOT EXISTS safety_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safety_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_no INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.routine_day_plan_audit
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revision_no INTEGER;

-- routine_day_plan_revisions: 감사/리비전 테이블 (spec 권장)
CREATE TABLE IF NOT EXISTS public.routine_day_plan_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES public.workout_routines(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  revision_no INTEGER NOT NULL,
  reason TEXT NOT NULL,
  old_hash TEXT,
  new_hash TEXT NOT NULL,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_routine_day_plan_revisions_routine_day
  ON public.routine_day_plan_revisions(routine_id, day_number);

ALTER TABLE public.routine_day_plan_revisions ENABLE ROW LEVEL SECURITY;
