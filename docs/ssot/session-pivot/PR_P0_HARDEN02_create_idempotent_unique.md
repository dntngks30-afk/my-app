# P0: Session Create Idempotent + Unique + No Overwrite

## What Changed

- **DB**: Migration ensures `UNIQUE(user_id, session_number)` on `session_plans` (idempotent if already exists).
- **POST /api/session/create**:
  - Daily cap: `last_completed_day_key` === today KST → 409 DAILY_LIMIT_REACHED (SSOT).
  - Completed row 보호: `status='completed'`인 plan은 절대 덮어쓰지 않음.
  - 멱등: 중복 create 시 idempotent=true, 동일 session_number 반환.
  - 응답에 `today_completed`, `next_unlock_at` 항상 포함.
- **Shared util**: `getTodayCompletedAndNextUnlock()` — active와 create에서 동일 로직 사용.

## Risk Removed

- 탭 왕복/뒤로가기/느린 네트워크로 create 2회 호출 → 두 번째는 idempotent, 새 row 생성 금지.
- 완료된 plan이 create로 덮어쓰여 exercise_logs/plan_json 손실 → 차단.
- 오늘 완료 후 create 재호출로 무한 진행 → 409 차단.

## Acceptance Tests

1. `npm run build` PASS
2. `supabase db push` → `SELECT conname FROM pg_constraint WHERE conrelid='public.session_plans'::regclass AND contype='u'` returns row
3. Create 2회 연속 → 두 번째 idempotent=true, 같은 session_number
4. Complete 후 같은 날 create → 409 DAILY_LIMIT_REACHED
5. Completed plan에 create 재호출 → plan_json/exercise_logs 불변

## Rollback

```sql
ALTER TABLE public.session_plans DROP CONSTRAINT IF EXISTS session_plans_user_id_session_number_key;
```

Then `git revert` the commit.
