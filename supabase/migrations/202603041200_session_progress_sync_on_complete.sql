-- ============================================================
-- P0: session_plans completed → session_program_progress atomic sync
-- 202603041200_session_progress_sync_on_complete.sql
-- ============================================================
-- When session_plans transitions to status='completed', atomically upsert
-- session_program_progress. SSOT for daily cap; app no longer updates progress.
-- Trigger runs only when: OLD.status != NEW.status AND NEW.status='completed' AND NEW.completed_at IS NOT NULL.

CREATE OR REPLACE FUNCTION public.session_sync_progress_on_plan_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'completed'
     AND NEW.completed_at IS NOT NULL
  THEN
    INSERT INTO public.session_program_progress (
      user_id,
      completed_sessions,
      active_session_number,
      last_completed_at,
      last_completed_day_key
    )
    VALUES (
      NEW.user_id,
      NEW.session_number,
      NULL,
      NEW.completed_at,
      (NEW.completed_at AT TIME ZONE 'Asia/Seoul')::date
    )
    ON CONFLICT (user_id) DO UPDATE SET
      completed_sessions = GREATEST(session_program_progress.completed_sessions, NEW.session_number),
      active_session_number = NULL,
      last_completed_at = NEW.completed_at,
      last_completed_day_key = (NEW.completed_at AT TIME ZONE 'Asia/Seoul')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_plans_sync_progress_on_completed ON public.session_plans;
CREATE TRIGGER trg_session_plans_sync_progress_on_completed
  AFTER UPDATE OF status, completed_at
  ON public.session_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.session_sync_progress_on_plan_completed();
