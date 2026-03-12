# Deep Test Finalize: target_frequency 서버 반영 계약

## 목적

Deep Test 완료 시 사용자가 선택한 `target_frequency`가 **서버에서 즉시** `session_user_profile` + `session_program_progress`에 반영되도록 보장한다.
클라이언트 pre-save 실패 시에도 silent fail-open 없이, finalize가 authoritative write를 수행한다.

---

## 계약

| target_frequency | total_sessions |
|-----------------|----------------|
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |

사용자가 5를 선택했으면, 세션 레일 첫 로드 시 반드시 `total_sessions=20`이어야 한다.
(정책상 불가한 경우: `completed_sessions > total_sessions` 감소 시도 → 409 POLICY_LOCKED)

---

## Non-silent failure 규칙

- finalize 요청에 `target_frequency`가 포함되어 있으면, 서버에서 `applyTargetFrequency` 실행
- **실패 시**: finalize 성공 차단, 409 또는 500 반환, 사용자에게 에러 표시
- **sessionStorage draft**: 클라이언트 pre-save 실패 시에만 사용. 서버가 primary source.

---

## 구현

- `POST /api/deep-test/finalize` body에 `target_frequency` (optional) 포함
- `lib/session/profile.ts`의 `applyTargetFrequency` 공유 (profile API와 동일 로직)
- finalize 성공 반환 전에 profile + progress 업데이트 완료

---

## Regression tests

`npm run test:target-frequency-regression` (scripts/target-frequency-regression.mjs)

- E. Mapping: 2→8, 3→12, 4→16, 5→20
- A/B. Stale 16 prevention: freq 5 must resolve to 20
- C. applyTargetFrequency mock: server authoritative path (pre-save failure path)
- D. existing progress safety: wouldPolicyLock when total would drop below completed

---

## 관련 문서

- BE-ONB-01: profile API
- BE-ONB-02: active/create sync
