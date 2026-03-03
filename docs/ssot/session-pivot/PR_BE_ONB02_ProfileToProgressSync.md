# BE-ONB-02: session/profile → total_sessions 연동 (active/create)

## 목적

Path B의 `/api/session/active`, `/api/session/create`에서 progress 초기화 시 `total_sessions=16` 고정을 제거하고,
`session_user_profile.target_frequency`를 조회해 8/12/16/20으로 초기화/동기화한다.

---

## 문제

- BE-ONB-01에서 profile 저장/매핑을 해도, **(a) progress가 없는 상태에서 active/create가 먼저 호출되면 16으로 생성**됨
- 환경/운영에서 데이터 누락/리셋 시에도 계속 16으로 굳어질 수 있음

---

## 해결

- `resolveTotalSessions` 헬퍼로 profile 기반 total_sessions 결정
- progress init 시 resolved 값 사용 (16 고정 제거)
- progress 존재 시 안전 조건에서만 sync (UPDATE total_sessions)

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/session/active/route.ts` | resolveTotalSessions + init/sync |
| `src/app/api/session/create/route.ts` | resolveTotalSessions + init/sync |
| `docs/ssot/session-pivot/PR_BE_ONB02_ProfileToProgressSync.md` | 이 문서 |

---

## 동작

### resolveTotalSessions (각 route 내부 헬퍼)

- `session_user_profile`에서 `target_frequency` 조회 (admin client)
- 매핑: 2→8, 3→12, 4→16, 5→20
- profile 없음/쿼리 에러 → fallback 16
- 반환: `{ totalSessions, source: 'profile' | 'default' }`

### GET /api/session/active

- progress 없음: insert 시 `total_sessions: resolved.totalSessions`
- progress 있음 + profile 존재 + 값 다름:
  - **sync 조건**: `resolved.totalSessions >= progress.completed_sessions` AND `progress.active_session_number === null`
  - 조건 충족 시: UPDATE `total_sessions`
  - 미충족 시: 기존 progress 유지 (로그 경고만)

### POST /api/session/create

- **멱등 경로**: `progress.active_session_number` 존재 시 → profile 조회 없이 즉시 반환
- 그 외: resolve → init 또는 sync (active와 동일 로직) → nextSessionNumber 계산

---

## 안전 조건 (sync 시)

- `resolved.totalSessions >= progress.completed_sessions` (completed_sessions 침범 금지)
- `progress.active_session_number === null` (active 세션 중 변경 금지)
- 두 조건 모두 충족 시에만 UPDATE `total_sessions`

---

## 제약

- `completed_sessions` 침범 금지: `total_sessions`를 `completed_sessions`보다 작게 설정 불가
- active 세션 중 변경 금지: `active_session_number`가 있으면 sync 스킵
- 응답 shape 변경 없음: `{ progress, active }` 유지

---

## 수락 테스트

- A1) 7일 레일 파일 변경 0개
- A2) DB 마이그레이션 변경 0개
- A3) profile 없음 → total_sessions=16
- A4) profile target_frequency=3 → progress init 시 total_sessions=12
- A5) progress 존재 + profile 5 → sync 시 total_sessions=20 (completed/active 안전 시)
- A6) create idempotent 경로에서 profile 쿼리 0회
- A7) 빌드 통과

---

## 롤백

- 커밋 revert 시 active/create가 다시 16 고정으로 동작. 기존 progress 행은 DB에 그대로 유지.
