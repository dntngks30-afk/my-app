# PR4A-Delta: exercise_logs [] 계약 강제

## 목적

PR4A 핵심(첫 완료만 write, 덮어쓰기 방지)은 유지하면서, NULL/응답 계약 리스크만 최소 변경으로 제거.

## 변경 사항

### 1) 저장 계약 (complete)

- **이전**: exercise_logs 미제공 시 payload에 포함 안 함 → DB에 NULL 남을 수 있음
- **이후**: 항상 배열로 저장. 미제공 시 `[]` 저장

### 2) 응답 계약 (complete)

- **이전**: idempotent 응답에서 `exercise_logs: planRow.exercise_logs ?? null` → null 내려감
- **이후**: `toExerciseLogsArray(planRow.exercise_logs)` → 항상 배열([] 포함)

### 3) DB 보정 (202603161230)

- 기존 `exercise_logs IS NULL` row → `'[]'::jsonb`로 보정
- `ALTER COLUMN exercise_logs SET DEFAULT '[]'::jsonb` (컬럼 존재 시에만)

### 4) 마이그레이션 순서

- 202603041300이 exercise_logs default를 건드렸으나, 컬럼 추가는 202603161200.
- 기존 migration 수정 금지. 202603161230으로 보강 migration 추가해 우회.

## 계약 요약

| 구분 | 계약 |
|------|------|
| 저장 | exercise_logs는 항상 배열. 미제공 시 `[]` |
| 응답 | complete/history 모두 exercise_logs는 항상 배열. null 금지 |
| DB | NULL row 없음. DEFAULT `'[]'::jsonb` |

## Acceptance

1. complete without exercise_logs → 200, DB/history에 `[]`
2. idempotent complete → `exercise_logs` 배열 (null 아님)
3. `SELECT count(*) FROM session_plans WHERE exercise_logs IS NULL` → 0
