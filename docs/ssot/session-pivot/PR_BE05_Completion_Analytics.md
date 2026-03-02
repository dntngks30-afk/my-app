# BE-05: Session completion analytics

## 목적

세션 완료 시 `duration_seconds`, `completion_mode`를 저장하고,
GET /api/session/history에서 노출. 7일 시스템 미변경.

---

## 스키마 변경

**파일:** `supabase/migrations/20260303_session_completion_analytics.sql`

`public.session_plans`에 컬럼 추가:

| 컬럼 | 타입 | 제약 |
|------|------|------|
| duration_seconds | INT NULL | 0..7200 clamp (앱 레벨) |
| completion_mode | TEXT NULL | 'all_done' \| 'partial_done' \| 'stop_early' |

인덱스: `idx_session_plans_user_completed` (user_id, completed_at DESC).

---

## 멱등성 (Idempotency)

- **첫 완료:** `status='completed'`, `completed_at`, `duration_seconds`, `completion_mode` 저장. progress 증가.
- **이미 완료:** 추가 변경 없음. 기존 stored 값 유지. progress 2회 증가 방지.

---

## API 변경

### POST /api/session/complete

- **첫 완료:** `duration_seconds` (0..7200 clamp), `completion_mode` 저장.
- **이미 완료:** 동일 응답 반환, DB 변경 없음.

### GET /api/session/history

- `items` 각 항목에 `duration_seconds`, `completion_mode` 포함.
- 기존 행(null) 허용. null이면 `null` 반환.

---

## curl 예시

```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

# 완료 (첫 호출)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":900,"completion_mode":"all_done"}' \
  "$BASE/api/session/complete" | jq .

# 멱등 재호출 (동일 응답, progress 변경 없음)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":999,"completion_mode":"partial_done"}' \
  "$BASE/api/session/complete" | jq .

# 히스토리 조회
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/history?limit=20" | jq .
```

---

## 수락 기준

- A1) 7일 관련 파일 변경 0개
- A2) 새 migration 파일만 추가
- A3) 완료 시 duration/mode 저장, 재완료 시 멱등
- A4) 기존 행(null duration/mode) history에서 정상 반환
