# P0: Session Events Audit Trail

## What Changed

- **DB**: `session_events` 테이블 추가 (user_id, event_type, session_number, kst_day, status, code, meta)
- **DB**: RLS — service_role만 INSERT/SELECT, authenticated 유저 접근 금지
- **BE**: `logSessionEvent()` 유틸, `summarizeExerciseLogs()` (원문 저장 금지)
- **BE**: active/create/complete/history 라우트에 핵심 이벤트 로깅 삽입

## Event Types

| event_type | status | 언제 |
|------------|--------|------|
| session_active_read | ok | active 조회 성공 |
| session_active_read | error | active 500 |
| session_create | ok | 신규 세션 생성 |
| session_create_idempotent | ok | active_exists / conflict_return |
| session_create_blocked | blocked | DAILY_LIMIT_REACHED, DEEP_RESULT_MISSING, PROGRAM_FINISHED |
| session_create_blocked | error | DB_ERROR, INTERNAL |
| session_complete | ok | 첫 완료 |
| session_complete_idempotent | ok | 이미 완료된 세션 재호출 |
| session_complete_blocked | blocked | NOT_FOUND, CONCURRENT_UPDATE |
| session_history_read | ok | history 조회 성공 |

## 조회 방법 (서비스 롤 SQL)

```sql
SELECT event_type, status, code, session_number, kst_day, created_at, meta
FROM public.session_events
WHERE user_id = '<user-uuid>'
ORDER BY created_at DESC
LIMIT 20;
```

## 데이터 민감도 / 용량 정책

- **민감정보 금지**: 이메일, 전화, 주소 등 개인식별정보 저장 금지
- **exercise_logs 원문 금지**: meta에는 `logs_summary`(exercise_count, total_sets, total_reps, avg_difficulty)만
- **meta 4KB 제한**: 초과 시 `{ _truncated: true }`로 대체

## Rollback

```sql
DROP TABLE IF EXISTS public.session_events;
```
