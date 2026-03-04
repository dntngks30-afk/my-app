# P0: 프로그램 종료 + 빈도 변경 제한

## 목적

- `completed_sessions >= total_sessions` 시 create/complete 차단 (409 PROGRAM_FINISHED)
- `completed_sessions > 0` 이후 total_sessions 줄이기 금지 (409 POLICY_LOCKED)
- 서버 SSOT: UI 우회 불가

## D1) 프로그램 종료 정책

| 조건 | POST /api/session/create | POST /api/session/complete |
|------|--------------------------|---------------------------|
| completed_sessions >= total_sessions | 409 PROGRAM_FINISHED | idempotent(이미 완료) 또는 409 PROGRAM_FINISHED |
| session_number > total_sessions | — | 409 PROGRAM_FINISHED |
| session_number < 1 | — | 400 VALIDATION_FAILED |

## D2) 빈도 → total_sessions 매핑 (SSOT)

| target_frequency | total_sessions |
|------------------|----------------|
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |

- completed_sessions > 0 이후 **줄이기** 금지 → 409 POLICY_LOCKED
- **늘리기** 허용 (total_sessions만 증가, completed_sessions 유지)

## 에러 코드 / HTTP status

| code | HTTP | 의미 |
|------|------|------|
| PROGRAM_FINISHED | 409 | 모든 세션 완료, create/complete 불가 |
| POLICY_LOCKED | 409 | 빈도 줄이기( total_sessions 감소) 금지 |
| VALIDATION_FAILED | 400 | session_number 유효하지 않음 |

## Acceptance Tests

### 1) Build
```powershell
npm run build
```

### 2) Migration
```powershell
supabase db push
```

### 3) 제약 확인
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.session_program_progress'::regclass;
```

### 4) PROGRAM_FINISHED 동작
```powershell
$TOKEN = "YOUR_ACCESS_TOKEN"
$BASE = "http://localhost:3000"

# active로 현재 progress 확인
Invoke-RestMethod -Uri "$BASE/api/session/active" -Headers @{ Authorization = "Bearer $TOKEN" }

# (완주 상태에서) create => 409
Invoke-RestMethod -Uri "$BASE/api/session/create" -Method POST `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body '{"condition_mood":"ok","time_budget":"short"}'

# complete 경계값 (session_number > total_sessions)
Invoke-RestMethod -Uri "$BASE/api/session/complete" -Method POST `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body '{"session_number":999,"duration_seconds":60,"completion_mode":"all_done","exercise_logs":[]}'
```

### 5) CURL (Linux)
```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" | jq .

curl -s -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' \
  "$BASE/api/session/create"

curl -s -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_number":999,"duration_seconds":60,"completion_mode":"all_done","exercise_logs":[]}' \
  "$BASE/api/session/complete"
```

## 마이그레이션 요약 (202603041500)

- session_program_progress: total_sessions IN (8,12,16,20) 제약
- 비정규 데이터: total_sessions NOT IN (8,12,16,20) → 16으로 보정

## Rollback

```sql
ALTER TABLE public.session_program_progress DROP CONSTRAINT IF EXISTS spp_total_sessions_valid;
-- 필요 시 total_sessions > 0 복원
ALTER TABLE public.session_program_progress
  ADD CONSTRAINT session_program_progress_total_sessions_check CHECK (total_sessions > 0);
```
