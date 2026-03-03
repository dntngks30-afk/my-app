# PR BE REC01: Session exercise logs (세트/횟수/난이도)

## 목적

운동 종료 시 세트/횟수/난이도 로그를 DB에 저장하고, 기록 탭이 조회할 수 있게 API로 노출.
7일 시스템 미변경.

---

## 스키마 변경

**파일:** `supabase/migrations/202603161200_session_exercise_logs.sql`

`public.session_plans`에 컬럼 추가:

| 컬럼 | 타입 | 제약 |
|------|------|------|
| exercise_logs | JSONB NULL | v1: [{ templateId, name, sets, reps, difficulty }] |

---

## 멱등 규칙 (Idempotency)

- **첫 완료:** `status='completed'`, `completed_at`, `duration_seconds`, `completion_mode`, `exercise_logs` 저장.
- **이미 완료 (status='completed'):** 기존 `exercise_logs`를 **절대 덮어쓰지 않음**. 중복 complete 호출 시 저장된 값 유지. 응답에 `exercise_logs` 포함.

---

## API 변경

### POST /api/session/complete

**입력 (추가):**

```json
{
  "session_number": 1,
  "duration_seconds": 900,
  "completion_mode": "all_done",
  "exercise_logs": [
    {
      "templateId": "M01",
      "name": "스쿼트",
      "sets": 3,
      "reps": 10,
      "difficulty": 3
    },
    {
      "templateId": "M02",
      "name": "플랭크",
      "sets": 2,
      "reps": null,
      "difficulty": 2
    }
  ]
}
```

**검증:**
- `exercise_logs`: 0..50개
- `templateId`, `name`: string 필수, trim, 최대 80자
- `sets`: 0..20 clamp (없으면 null)
- `reps`: 0..200 clamp (없으면 null)
- `difficulty`: 1..5 clamp (없으면 null)
- 유효하지 않으면 400 BAD_REQUEST

**응답 (첫 완료):**

```json
{
  "progress": { ... },
  "next_theme": "Phase 2 · ...",
  "idempotent": false
}
```

**응답 (멱등):**

```json
{
  "progress": { ... },
  "next_theme": "...",
  "idempotent": true,
  "exercise_logs": [ ... ]
}
```

### GET /api/session/history

**출력 (추가):**

```json
{
  "progress": { ... },
  "items": [
    {
      "session_number": 1,
      "completed_at": "2026-03-16T...",
      "duration_seconds": 900,
      "completion_mode": "all_done",
      "theme": "Phase 1 · ...",
      "exercise_logs": [
        {
          "templateId": "M01",
          "name": "스쿼트",
          "sets": 3,
          "reps": 10,
          "difficulty": 3
        }
      ]
    }
  ]
}
```

`exercise_logs`가 없으면 `null` 반환.

---

## curl 예시

```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

# 완료 (exercise_logs 포함)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":900,"completion_mode":"all_done","exercise_logs":[{"templateId":"M01","name":"스쿼트","sets":3,"reps":10,"difficulty":3}]}' \
  "$BASE/api/session/complete" | jq .

# 멱등 재호출 (다른 exercise_logs로 호출해도 기존 값 유지)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":999,"completion_mode":"all_done","exercise_logs":[]}' \
  "$BASE/api/session/complete" | jq .

# 히스토리 조회 (exercise_logs 포함)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/history?limit=20" | jq .
```

---

## 수락 기준

- A1) Migration 적용 후 `exercise_logs` 컬럼 존재
- A2) complete 첫 호출 시 exercise_logs 저장
- A3) complete 멱등 호출 시 exercise_logs 덮어쓰기 없음
- A4) history items에 exercise_logs 포함 (null 또는 array)
- A5) npm run build PASS
