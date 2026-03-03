# fix(routine): keep today completed state and block second session UX

## Summary
- Read `today_completed` + `next_unlock_at` from GET /api/session/active
- If `today_completed=true` and no active session: show "오늘 완료" card (no "움직임 리셋 시작" CTA)
- If user clicks CTA and create returns 409 DAILY_LIMIT_REACHED: switch UI to "오늘 완료" state
- Two buttons in "오늘 완료" state: "홈으로" → /app/home, "루틴 확인" → /app/checkin

## Acceptance Tests
- [ ] AT1: Complete session → switch tabs → return to routine → "오늘 완료" state persists
- [ ] AT2: Attempt create again same day → UI shows daily limit message, not "리셋 시작"
- [ ] AT3: Next day after KST midnight → "리셋 시작" appears and create works
- [ ] AT4: No auto create on page entry (Network confirms)
- [ ] AT5: npm run build PASS

## Changes
- RoutineHubClient: nextUnlockAt state, DAILY_LIMIT_REACHED sets todayCompleted + nextUnlockAt
- "오늘 완료" card: countdown text + 홈으로/루틴 확인 buttons
- session/client: SessionApiError.next_unlock_at for 409 response passthrough
