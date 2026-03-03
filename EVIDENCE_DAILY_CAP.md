# Evidence Pack: Max 1 Session per KST Day

## AT1) GET /api/session/active — today_completed=true after completion

**Expected:** After completing a session, GET /api/session/active returns:
```json
{
  "progress": { "completed_sessions": N, "last_completed_day_key": "2025-03-15", ... },
  "active": null,
  "today_completed": true,
  "next_unlock_at": "2025-03-15T15:00:00.000Z"
}
```

**Verify:** Run session complete, then GET /api/session/active. Check `today_completed` and `next_unlock_at`.

---

## AT2) POST /api/session/create — 409 DAILY_LIMIT_REACHED same day

**Expected:** Same KST day, no active session, after one completion:
```json
{
  "error": {
    "code": "DAILY_LIMIT_REACHED",
    "message": "오늘 이미 세션을 완료했습니다. 내일 다시 시작해 주세요.",
    "next_unlock_at": "2025-03-15T15:00:00.000Z",
    "day_key": "2025-03-15"
  }
}
```
Status: 409

**Verify:** Complete session → try create again same day → expect 409.

---

## AT3) POST /api/session/create — idempotent when active exists

**Expected:** With active_session_number set, create returns existing plan (idempotent: true), NOT 409.

**Verify:** Start session (don't complete) → call create again → expect 200 with same plan.

---

## AT4) After KST midnight — create allowed

**Expected:** After KST midnight (next calendar day), create succeeds.

**Verify:** Wait until next KST day or manually set last_completed_day_key to yesterday in DB for testing.

---

## AT5) DB row — last_completed_day_key updated

**Query:**
```sql
SELECT user_id, completed_sessions, last_completed_at, last_completed_day_key
FROM session_program_progress
WHERE user_id = '<your-user-id>';
```

**Expected:** After completion, `last_completed_day_key` = today's date in KST (YYYY-MM-DD).
