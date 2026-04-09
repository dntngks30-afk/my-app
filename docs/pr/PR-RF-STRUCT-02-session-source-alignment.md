# PR-RF-STRUCT-02 — Session source alignment

## Scope
- session create / bootstrap / read 경로의 analysis input source contract 정렬
- claimed public result 우선, legacy deep fallback 원칙을 공통 resolver로 모음

## Non-goals
- session generation 알고리즘 변경
- result scoring 변경
- adaptive modifier 변경

## Locked truth
- 세션 입력 1차 source는 claimed public result
- legacy deep는 fallback only
- source semantics는 바꾸지 않고 owner만 단일화

## Why now
- create와 bootstrap이 서로 다른 truth를 읽으면 생성 성공/미리보기 실패 같은 구조적 장애가 계속 난다.

## Files / modules in scope
- `src/app/api/session/create/route.ts`
- `src/app/api/session/bootstrap/route.ts`
- `src/lib/deep-result/session-deep-summary.ts`
- public result source resolver 관련 모듈

## Out of scope
- public result UI
- camera refine
- session panel UI

## PR boundary
- source selection 경계만 정리
- response payload redesign 금지

## Regression checklist
- claimed public result만 있는 사용자
- legacy deep만 있는 사용자
- 둘 다 있는 사용자
- 둘 다 없는 사용자
- active session 있는 경우 bootstrap 유지
