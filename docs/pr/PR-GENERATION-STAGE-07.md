# PR-GENERATION-STAGE-07 — 온보딩 직후 짧은 세션 구성 스테이징

## 1. Assumptions

- 온보딩 저장 성공 후 기존에는 `/onboarding-complete`로 바로 이동해 claim이 실행됨.
- 본 PR은 **표현·전환만** 추가하고, claim·readiness·세션 생성 계약은 **변경하지 않음**.
- 실제 백엔드 “진행률” API는 없으므로 **문장 단계 전환**만 사용(퍼센트·가짜 진행률 없음).

## 2. CURRENT_IMPLEMENTED (이 PR 후)

- **`/session-preparing`**: 온보딩 저장 후 진입, 약 **1.85s** 동안 3문장 순차 표시 + 점 인디케이터.
- 자동으로 **`router.replace('/onboarding-complete')`** → 기존 **claim·bridge 정리·ReadinessEntryGate 초기화** 흐름 그대로.
- **「바로 다음으로」**로 스테이징 생략 가능(동일하게 `onboarding-complete`로 이동).
- **홈 직링크는 두지 않음** — claim 우회 방지.

## 3. LOCKED_DIRECTION

- 결제 = 실행 unlock, 온보딩 최소, public-first 연속성 유지.

## 4. NOT_YET_IMPLEMENTED

- 서버 측 실시간 생성 진행률·WebSocket.
- PWA 설치·첫 실행 튜토리얼.

## 5. Findings (변경 전)

- 온보딩 제출 직후 **바로** 완료/claim 화면으로 넘어가 전환이 다소 급하게 느껴질 수 있음.

## 6. Root cause

- 실행 준비·세션 연결이 **인지상 한 번에 끝나는** 느낌.

## 7. Files changed

- `src/app/session-preparing/page.tsx` — 신규
- `src/app/onboarding/page.tsx` — 성공 시 `/session-preparing`으로 라우팅
- `docs/pr/PR-GENERATION-STAGE-07.md`

## 8. Proposed flow after change

1. `/onboarding` 저장 성공 → `/session-preparing` (짧은 3단계 카피)
2. → `/onboarding-complete` (기존 claim 등)
3. 사용자가 「앱으로 이동하기」→ `/app/home` (기존)

## 9. Why this is safe relative to SSOT

- **전용 라우트** 삽입만으로 기존 `onboarding-complete` 로직 **재사용**.
- auth/pay/bridge/claim API **미변경**.
- `/app` 실행 코어 **미변경**.

## 10. Acceptance tests (manual)

1. 결제·온보딩 퍼널 → 온보딩 저장 후 스테이징 → 완료 화면 → 홈까지 동작.
2. 스테이징 카피가 **실행·세션 준비** 톤(분석 과장 없음).
3. 「바로 다음으로」클릭 시에도 `onboarding-complete`에서 claim 경로 유지.
4. 온보딩 필드·API 페이로드 **변경 없음**.

## 11. Explicit non-goals

- 온보딩 폼·필드 수정.
- `session/create`·bootstrap 계약 재작성.
- 5~10초 고정 대기.

---

## Implementation type

**Route-level** (`/session-preparing`) + 클라이언트 타이머·카피만.

## Follow-up PRs

- 스테이징 문구 A/B, 실제 세션 생성 지연과 동기화(서버 이벤트 있을 때).

## Diff summary

- 신규 `session-preparing` 페이지(3문장·~1.85s·선택 스킵).
- 온보딩 성공 라우트만 `/session-preparing`으로 변경.

## Manual paths

- `/onboarding` 완료 → `/session-preparing` → `/onboarding-complete`.
- 스테이징에서 「바로 다음으로」.
