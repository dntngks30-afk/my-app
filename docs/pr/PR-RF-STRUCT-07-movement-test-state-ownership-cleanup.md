# PR-RF-STRUCT-07 — movement-test state ownership cleanup

## Scope
- `movementTestSession:v2`의 owner 역할을 축소하고, localStorage를 cache/bridge 보조로 재정의
- intro → survey → baseline 결과 흐름의 상태 ownership 경계 정리

## Non-goals
- free survey scoring 변경
- baseline result copy/UI 변경
- claim logic 변경

## Locked truth
- 설문 baseline 흐름은 유지
- localStorage continuity는 보조 수단일 뿐 canonical owner가 아니다

## Why now
- 현재 intro profile merge, survey answers, baseline build가 모두 localStorage 세션에 강하게 묶여 continuity 리스크가 크다.

## Files / modules in scope
- `src/lib/public/survey-bridge.ts`
- `src/app/movement-test/survey/page.tsx`
- `src/app/movement-test/baseline/page.tsx`
- public result handoff 관련 모듈

## Out of scope
- camera refine
- result renderer 개편
- payment / auth bridge

## PR boundary
- state ownership과 persistence boundary만 정리
- funnel semantics 변경 금지

## Regression checklist
- intro profile merge 유지
- survey 저장/복구 유지
- baseline 결과 생성 유지
- direct revisit / refresh 시 continuity 확인
