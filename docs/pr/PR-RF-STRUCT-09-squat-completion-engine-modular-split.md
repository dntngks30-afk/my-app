# PR-RF-STRUCT-09 — Squat completion engine modular split

## Scope
- `squat-completion-state.ts` 내부의 completion core / canonical contract / observability / policy annotation 경계 분리 설계
- single writer 원칙을 유지한 모듈 절단 방향 정의

## Non-goals
- threshold 변경
- pass/latch semantics 변경
- camera funnel product law 변경

## Locked truth
- pass owner는 단일 writer여야 한다
- canonical shallow closer 의미는 유지한다
- behavior-preserving extraction only

## Why now
- 현재 파일은 detection, rescue, canonical contract, observability, policy가 과도하게 밀집된 god file이라 변경 비용이 매우 높다.

## Files / modules in scope
- `src/lib/camera/squat-completion-state.ts`
- 관련 shallow/canonical contract helper 소비 경계

## Out of scope
- evaluator semantics 변경
- auto-progression product behavior 변경
- other motion analyzers

## PR boundary
- 모듈 분해 설계만
- truth output / blocked reason / fallback ordering 변경 금지

## Regression checklist
- standard / low_rom / ultra_low_rom existing pass truth 유지
- canonical shallow closer 유지
- observability field 의미 유지
- event promotion / provenance annotation 의미 유지
