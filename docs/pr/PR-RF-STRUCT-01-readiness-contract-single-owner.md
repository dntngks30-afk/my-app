# PR-RF-STRUCT-01 — Readiness contract single-owner

## Scope
- readiness 계산 owner를 단일 서버 contract로 수렴
- legacy adapter와 client gate는 consumer-only 경계로 정리

## Non-goals
- auth UX 개편
- payment flow 변경
- /app execution core 수정

## Locked truth
- readiness의 canonical owner는 서버다
- next_action 의미 자체는 바꾸지 않는다
- behavior-preserving boundary cleanup only

## Why now
- 현재 readiness truth가 server SSOT, legacy adapter, client gate에 분산되어 회귀를 반복 생산한다.

## Files / modules in scope
- `src/lib/readiness/get-session-readiness.ts`
- `src/lib/readiness/getCanonicalUserReadiness.ts`
- `src/app/app/_components/ReadinessEntryGate.tsx`

## Out of scope
- onboarding screen UI
- app/home 실행 흐름
- session create logic

## PR boundary
- readiness 계산 / 타입 / 라우팅 소비 경계만 정리
- 새로운 product semantics 추가 금지

## Regression checklist
- unauthenticated → auth
- active plan 없음 → payment
- result 없음 → result
- onboarding 미완료 → onboarding
- active session 있음 → app home
- session create 가능 → 기존 흐름 유지
