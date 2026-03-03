# P0: Session History Contract

## What Changed

- **DB**: exercise_logs DEFAULT '[]', duration_seconds DEFAULT 0
- **DB**: status='completed' AND completed_at IS NULL row 보정
- **DB**: CHECK (status='completed' → completed_at NOT NULL)
- **DB**: history용 인덱스 (user_id, session_number DESC) WHERE status='completed'
- **GET /api/session/history**: 정렬 session_number DESC, limit 50~100, exercise_logs/duration_seconds/completion_mode null → []/0/'unknown' 강제

## Contract

- status='completed'만 노출
- 정렬: session_number DESC (최신 위)
- exercise_logs: JSONB 배열, null → []
- duration_seconds: null → 0
- completion_mode: null → 'unknown'

## Acceptance Tests

1. `npm run build` PASS
2. `supabase db push` PASS
3. GET /api/session/history → items[0].session_number 최대, exercise_logs 배열
4. Complete 직후 history → 최상단에 방금 기록
5. exercise_logs null row → 응답 []

## Rollback

```sql
DROP INDEX IF EXISTS idx_session_plans_user_completed_session;
ALTER TABLE public.session_plans DROP CONSTRAINT IF EXISTS session_plans_status_completed_at_check;
ALTER TABLE public.session_plans ALTER COLUMN exercise_logs DROP DEFAULT;
ALTER TABLE public.session_plans ALTER COLUMN duration_seconds DROP DEFAULT;
```
