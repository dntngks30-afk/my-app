-- ============================================================
-- PR-A refine: session_exercise_events integrity (truthful granularity)
-- 202603201400_session_exercise_events_integrity.sql
-- ============================================================
-- Additive only. Exercise-level when aggregate-only; stable plan identity.
-- ============================================================

-- 1. Add new columns
ALTER TABLE public.session_exercise_events
  ADD COLUMN IF NOT EXISTS execution_granularity TEXT NOT NULL DEFAULT 'exercise'
    CHECK (execution_granularity IN ('exercise', 'set'));

ALTER TABLE public.session_exercise_events
  ADD COLUMN IF NOT EXISTS segment_index INT NULL;

ALTER TABLE public.session_exercise_events
  ADD COLUMN IF NOT EXISTS item_index INT NULL;

ALTER TABLE public.session_exercise_events
  ADD COLUMN IF NOT EXISTS data_quality TEXT NOT NULL DEFAULT 'full'
    CHECK (data_quality IN ('full', 'partial'));

-- 2. Add plan_item_key (nullable first for backfill)
ALTER TABLE public.session_exercise_events
  ADD COLUMN IF NOT EXISTS plan_item_key TEXT NULL;

-- Backfill existing rows: preserve current uniqueness
UPDATE public.session_exercise_events
SET plan_item_key = template_id || '-s' || set_index
WHERE plan_item_key IS NULL;

-- Make NOT NULL with default for new rows
ALTER TABLE public.session_exercise_events
  ALTER COLUMN plan_item_key SET DEFAULT 'legacy';

-- Ensure no NULLs remain
UPDATE public.session_exercise_events SET plan_item_key = COALESCE(plan_item_key, template_id || '-s0') WHERE plan_item_key IS NULL;
ALTER TABLE public.session_exercise_events ALTER COLUMN plan_item_key SET NOT NULL;

-- 3. Drop old unique index
DROP INDEX IF EXISTS public.idx_session_exercise_events_dedup;

-- 4. Create new unique index (plan_item_key distinguishes same template in multiple segments)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_exercise_events_dedup
  ON public.session_exercise_events(session_plan_id, plan_item_key, set_index, event_source);

COMMENT ON COLUMN public.session_exercise_events.execution_granularity IS
  'exercise=aggregate block, set=true per-set. Do not fabricate set rows from aggregate.';
COMMENT ON COLUMN public.session_exercise_events.plan_item_key IS
  'Stable identity: seg{N}-item{M} from plan, or log{N} fallback.';
COMMENT ON COLUMN public.session_exercise_events.data_quality IS
  'full=plan_json available, partial=fallback mapping only.';

-- 5. Add UPDATE policy for upsert conflict path
CREATE POLICY "service_role_update_session_exercise_events"
  ON public.session_exercise_events
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
