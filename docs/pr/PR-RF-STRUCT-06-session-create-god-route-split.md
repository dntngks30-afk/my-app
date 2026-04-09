# PR-RF-STRUCT-06 — Session create god-route split

## Scope
- `/api/session/create` 내부 책임을 단계별로 분리할 설계 경계 정의
- auth / dedupe / source resolve / policy / generation / persistence / response 조립 분리

## Non-goals
- 세션 알고리즘 변경
- adaptive logic 재설계
- DB schema 변경

## Locked truth
- create route의 외부 contract와 side-effect ordering은 유지
- public result first / legacy fallback 원칙은 유지

## Why now
- 현재 route 하나가 너무 많은 책임을 가져, 작은 수정도 광범위한 회귀 위험을 만든다.

## Files / modules in scope
- `src/app/api/session/create/route.ts`
- session generation / snapshot / adaptive helper 소비 경계

## Out of scope
- session/bootstrap
- SessionPanelV2
- phase policy semantics 변경

## PR boundary
- 같은 동작을 더 작은 unit으로 절단하는 구조 리팩토링 설계만
- 응답 형식/코드 의미 변경 금지

## Regression checklist
- dedupe 유지
- active session idempotent 유지
- program finished / daily limit 차단 유지
- public result source / legacy fallback 유지
- debug extras 유지
