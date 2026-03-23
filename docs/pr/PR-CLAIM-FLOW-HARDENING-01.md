# PR-CLAIM-FLOW-HARDENING-01

## 목적

공개 결과 claim이 일시 실패해도 **복구 상태(bridge)**가 남도록 하여, 온보딩 직후 실행 truth와 공개 퍼널 결과의 괴리 가능성을 줄인다.

## CURRENT_IMPLEMENTED (이 PR)

- **Bridge 정리**: `claimed` / `already_owned`가 **확인된 경우에만** `clearBridgeContext()` 호출 (`src/app/onboarding-complete/page.tsx`).
- **실패 시**: bridge 유지 + 구조화된 `console` 로그 (`bridge_retained_after_claim_failure`).
- **재시도**: `claimPublicResultClient`에서 **최대 3회 시도**, **5xx·네트워크 계열**만 재시도 (`src/lib/public-results/useClaimPublicResult.ts`).
- **관측**: `[FLOW-05 claim]` 로그로 `success` / `retry` / `failed` / `failed_after_retries` / `skipped` 구분.

## NOT_YET_IMPLEMENTED (비목표)

- readiness·session-create 우선순위 재설계 (legacy deep vs public 동시 존재 시).
- claim API·DB 스키마 변경.
- 앱 셸·플레이어·맵 변경.

## 검증 메모

- 서버 `claimPublicResult` 멱등 규칙은 변경 없음.
- 온보딩 플로우: `onboarding` → `session-preparing` → `onboarding-complete` → 사용자가 `앱으로 이동하기`로 `/app/home`.
