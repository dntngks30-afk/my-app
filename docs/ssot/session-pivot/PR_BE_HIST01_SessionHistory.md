# BE-HIST-01: Add GET /api/session/history (read-only)

## 목적

완료된 세션 스탬프 목록 반환. 캘린더/히스토리 UI용.
Read-only. DB 마이그레이션 없음. 7일 시스템 미변경.

---

## API Contract

### GET /api/session/history?limit=60

**Auth:** Bearer token. 401 if not logged in.

**Response 200:**
```json
{
  "progress": {
    "completed_sessions": 3,
    "total_sessions": 16,
    "last_completed_at": "2026-03-03T12:00:00.000Z"
  },
  "items": [
    {
      "session_number": 3,
      "completed_at": "2026-03-03T12:00:00.000Z",
      "duration_seconds": null,
      "theme": "Phase 1 · glute_activation 안정화"
    },
    {
      "session_number": 2,
      "completed_at": "2026-03-02T10:30:00.000Z",
      "duration_seconds": null,
      "theme": "Phase 1 · glute_activation 안정화"
    }
  ]
}
```

- **duration_seconds:** 현재 null (컬럼 없음). 향후 session_events 또는 plan_json에서 추출 시 채울 수 있음.
- **items:** `status='completed'` plans only, `completed_at` desc, limit 1~120 (default 60).
- **progress:** `session_program_progress` 행 없으면 `completed_sessions: 0`, `total_sessions: 16`, `last_completed_at: null`.

---

## curl 예시

```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/history" | jq .
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/history?limit=20" | jq .
```

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/session/history/route.ts` | 신규 (read-only) |
| `docs/ssot/session-pivot/PR_BE_HIST01_SessionHistory.md` | 이 문서 |

7일/UI 파일: 변경 0개.
