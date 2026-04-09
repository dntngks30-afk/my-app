# PR-RF-STRUCT-10 — Readiness legacy type surface cleanup

## Scope
- readiness export/type surface에서 legacy compat를 내부 레이어로 격리
- 신규 소비자가 정본 타입을 잘못 참조하지 않게 표면 정리

## Non-goals
- readiness 계산 규칙 변경
- next_action semantics 변경
- app route behavior 변경

## Locked truth
- canonical readiness 타입은 1개여야 한다
- legacy compat는 필요해도 public surface owner가 되면 안 된다

## Why now
- 레거시 adapter 타입이 남아 있으면 신규 코드가 그 표면을 정본으로 오인해 중복 구조가 다시 생긴다.

## Files / modules in scope
- `src/lib/readiness/getCanonicalUserReadiness.ts`
- `src/lib/readiness/get-session-readiness.ts`
- readiness 타입 export surface

## Out of scope
- client gate behavior
- onboarding / payment route logic
- bootstrap alignment

## PR boundary
- type/export surface cleanup 설계만
- runtime semantics 변경 금지

## Regression checklist
- 기존 readiness 소비자 import 경로 확인
- legacy compat 필요 소비자 목록 확인
- canonical type 단일화 후도 외부 동작 변화 없음
