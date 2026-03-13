# Dogfooding / Launch Ops Runbook

**목적**: 도그푸딩·런칭 직전 운영자가 사용자별 여정을 빠르게 검수할 수 있도록 하는 최소 읽기 도구 사용 가이드.

---

## 1. 접근 경로

- **페이지**: `/admin/dogfooding`
- **권한**: ADMIN_EMAIL_ALLOWLIST 또는 `users.role='admin'` 필요
- **검색**: 이메일 또는 사용자 ID (UUID)

---

## 2. 스냅샷 섹션

| 섹션 | 내용 |
|------|------|
| **A. User Summary** | user id, email, plan_status, plan_tier, role, created_at, updated_at |
| **B. Deep Test Snapshot** | 최신 final deep_test_attempts (result_type, scoring_version, finalized_at) |
| **C. Session Journey** | 최근 5개 session_plans (session_number, status, theme, completed_at, adaptation_summary) |
| **D. Latest Feedback** | 최신 session_feedback (overall_rpe, difficulty_feedback, completion_ratio, body_state_change, discomfort_area) |
| **E. Latest Adaptive Summary** | 최신 session_adaptive_summaries (completion_ratio, avg_rpe, dropout_risk_score, flags 등) |
| **F. Admin Audit** | 최근 5개 admin_actions (해당 유저 대상) |

---

## 3. Triage 플래그 의미

| 플래그 | 의미 | 확인 순서 |
|--------|------|-----------|
| `NO_DEEP_TEST` | Deep Test가 없거나 final이 아님 | 1 |
| `DEEP_TEST_NO_SESSION` | Deep Test는 있으나 세션이 하나도 없음 | 2 |
| `SESSION_DRAFT_STUCK` | draft/started 세션만 있고 완료된 세션 없음 | 3 |
| `COMPLETED_NO_FEEDBACK` | 완료된 세션이 있으나 피드백 없음 | 4 |
| `FEEDBACK_NO_ADAPTIVE_SUMMARY` | 피드백은 있으나 적응형 요약 없음 | 5 |
| `RECENT_MANUAL_OVERRIDE` | 최근 24시간 내 관리자 수동 변경 이력 있음 | 참고 |

---

## 4. 검수 체크리스트 (도그푸딩 시)

1. **Deep Test → 세션 생성**: `NO_DEEP_TEST` / `DEEP_TEST_NO_SESSION` 확인
2. **세션 완료 → 피드백**: `COMPLETED_NO_FEEDBACK` 확인
3. **피드백 → 적응형**: `FEEDBACK_NO_ADAPTIVE_SUMMARY` 확인
4. **다음 세션 미리보기**: C 섹션의 `adaptation_summary`로 적응 사유 확인
5. **수동 변경 이력**: F 섹션 및 `RECENT_MANUAL_OVERRIDE` 확인

---

## 5. API (직접 호출 시)

```
GET /api/admin/dogfooding/user-snapshot?email=user@example.com
GET /api/admin/dogfooding/user-snapshot?userId=<uuid>
Authorization: Bearer <access_token>
```

응답: `UserSnapshotResponse` (user, deepTest, sessions, feedback, adaptiveSummary, adminActions, triageFlags)

---

## 6. 제한 사항

- 읽기 전용. 쓰기/수정은 기존 plan-status API 등 별도 경로 사용.
- session_exercise_events는 현재 스냅샷에 미포함 (필요 시 확장 가능).
- plan_status / paywall 불일치는 triage 플래그에 미포함 (추후 확장 가능).
