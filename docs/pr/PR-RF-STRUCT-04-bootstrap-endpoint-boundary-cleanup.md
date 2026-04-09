# PR-RF-STRUCT-04 — Bootstrap endpoint boundary cleanup

## Scope
- `/api/bootstrap`, `/api/home/bootstrap`, `/api/session/bootstrap`의 책임 경계 명확화
- endpoint naming / ownership drift 정리

## Non-goals
- 각 endpoint의 business meaning 변경
- app/home UI 변경
- session source logic 변경

## Locked truth
- app init / home-lite / session-preview는 서로 다른 책임이다
- 이름 정리와 소비 경계 정리가 목적이지 semantics 변경이 목적이 아니다

## Why now
- 이름이 비슷한 bootstrap API가 서로 다른 역할을 가지면서 호출자 혼란과 회귀 범위를 키우고 있다.

## Files / modules in scope
- `src/app/api/bootstrap/route.ts`
- `src/app/api/home/bootstrap/route.ts`
- `src/app/api/session/bootstrap/route.ts`
- 관련 client fetch surface

## Out of scope
- session create
- readiness
- result claim flow

## PR boundary
- endpoint 목적과 naming 정리
- payload 대개편 금지

## Regression checklist
- app bootstrap data fetch
- home active-lite fetch
- session preview fetch
- debug mode 유지
