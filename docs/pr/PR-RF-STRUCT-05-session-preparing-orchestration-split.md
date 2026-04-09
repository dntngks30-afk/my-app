# PR-RF-STRUCT-05 — Session preparing orchestration split

## Scope
- `session-preparing/page.tsx`에서 orchestration과 scene rendering 책임 분리
- create trigger / dwell / redirect / progress pacing owner를 UI에서 떼어냄

## Non-goals
- createSession API semantics 변경
- post-pay funnel redesign
- onboarding-complete 수정

## Locked truth
- session preparing은 staged UX이되, API를 sleep시키지 않는다
- redirect 조건 의미는 바꾸지 않는다

## Why now
- 현재 page 하나가 생성 요청, in-flight 관리, dwell 정책, progress, redirect를 모두 소유해 수정 마찰이 크다.

## Files / modules in scope
- `src/app/session-preparing/page.tsx`
- 관련 client/session create helper
- scene props contract

## Out of scope
- session create backend
- onboarding-prep / onboarding-complete 화면 변경

## PR boundary
- orchestration 훅/서비스 분리까지
- dwell 기본값 의미 변경 금지

## Regression checklist
- 로그인 없음 에러 처리
- create 성공 후 redirect
- create 실패 후 메시지
- StrictMode / 재마운트 중복 요청 방지
