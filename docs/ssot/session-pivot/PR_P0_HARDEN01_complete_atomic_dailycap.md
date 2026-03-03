# P0: Session Complete Atomic + Daily Cap Hardening

## What Changed

- **DB trigger**: `trg_session_plans_sync_progress_on_completed` — when `session_plans` transitions to `status='completed'`, atomically upserts `session_program_progress` (completed_sessions, active_session_number, last_completed_at, last_completed_day_key). SSOT for daily cap.
- **GET /api/session/active**: Always returns `today_completed` and `next_unlock_at` (when today completed), whether active exists or not. Fixes undefined var runtime risk.
- **POST /api/session/complete**: Race-safe — update only when `status IN ('draft','started')`. First completion wins; second returns idempotent with stored exercise_logs (no overwrite). Progress update removed (trigger is SSOT).

## Why

- Concurrent double-submit could overwrite exercise_logs; progress update errors were swallowed.
- Active endpoint referenced undefined `todayCompleted`/`nextUnlockAt` when active exists.

## Acceptance Tests

1. `npm run build` exits 0.
2. `supabase db push` succeeds; `SELECT tgname FROM pg_trigger WHERE tgname='trg_session_plans_sync_progress_on_completed'` returns 1 row.
3. GET /api/session/active (no active) returns `{ progress, active: null, today_completed, next_unlock_at? }`.
4. Two rapid POST /api/session/complete with different exercise_logs → second returns idempotent:true, exercise_logs from first.
5. After completion, POST /api/session/create same KST day → 409 DAILY_LIMIT_REACHED.

## Rollback

```sql
DROP TRIGGER IF EXISTS trg_session_plans_sync_progress_on_completed ON public.session_plans;
DROP FUNCTION IF EXISTS public.session_sync_progress_on_plan_completed();
```

Then `git revert` the commit.
