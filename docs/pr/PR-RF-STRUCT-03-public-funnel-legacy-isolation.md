# PR-RF-STRUCT-03 — Public funnel legacy isolation

## Scope
- canonical public entry 외 병렬 엔트리를 compat / legacy / sunset 경계로 분리
- 어떤 라우트가 정본인지 명확히 잠금

## Non-goals
- funnel 카피 전면 수정
- auth/pay 로직 개편
- /app core 수정

## Locked truth
- public entry는 single-entry 방향 유지
- survey가 baseline이고 camera는 optional refine
- legacy route는 정본으로 복귀시키지 않는다

## Why now
- `/movement-test`, `/free-survey`, `/survey`가 병렬로 살아 있으면 구조와 제품 방향이 계속 충돌한다.

## Files / modules in scope
- `src/app/movement-test/*`
- `src/app/free-survey/*`
- `src/app/survey/*`
- intro/public funnel bridge 관련 모듈

## Out of scope
- result renderer 세부 UI
- payment unlock semantics
- app shell

## PR boundary
- route ownership / compat redirect / exposure 정리만
- scoring pipeline 변경 금지

## Regression checklist
- canonical entry 진입
- legacy route 직접 진입
- survey 완료 후 baseline/result 연결
- camera refine bridge 유지
