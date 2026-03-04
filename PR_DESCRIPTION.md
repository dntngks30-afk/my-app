# P0: Harden Session Complete (race-safe) + Active Flags + DB Progress Sync Trigger

## Risk Removed

1. **exercise_logs overwrite**: Concurrent double-submit could overwrite first completion's exercise_logs with second request's payload. Now update is conditional on `status IN ('draft','started')` — only first completion writes; second returns idempotent with stored logs.
2. **Daily cap bypass**: Progress update errors were swallowed; app could fail to sync `last_completed_day_key`. DB trigger is now SSOT — whenever `session_plans` transitions to `completed`, progress is atomically upserted.
3. **Active flags missing**: GET /api/session/active referenced undefined `todayCompleted`/`nextUnlockAt` when active exists; early return (no active) omitted these. Now both branches always include `today_completed` and `next_unlock_at` (when applicable).

## Changes

- **DB**: `trg_session_plans_sync_progress_on_completed` — AFTER UPDATE OF status, completed_at on session_plans; upserts session_program_progress (completed_sessions, active_session_number, last_completed_at, last_completed_day_key).
- **GET /api/session/active**: Always returns `today_completed`, `next_unlock_at` (when today completed).
- **POST /api/session/complete**: Conditional update; removed progress update block; idempotent path returns stored exercise_logs.

## Acceptance

- `npm run build` ✓
- `supabase db push` → trigger exists
- Active: `today_completed`, `next_unlock_at` in response
- Complete: two rapid completes → second idempotent, logs from first
- Create same KST day after complete → 409 DAILY_LIMIT_REACHED
