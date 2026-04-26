# PR-03 GoldPath Rule Readonly Contract Alignment

## Purpose

- Shared GoldPath rules (`LOWER_PAIR_GOLD_PATH_RULES`, `TRUNK_CORE_GOLD_PATH_RULES` 등)는 **`as const` readonly**다.
- Local consumer `GoldPathSegmentRule`이 **가변 배열**(`[]`)만 요구해 `as const` 원천과 **TS2322**가 났다.
- **Consumer 타입**을 readonly-friendly로 맞춰 오류를 제거한다. **Rule 값·알고리즘·스코어·segment 구성**은 변경하지 않는다.

## CURRENT_IMPLEMENTED

### 수정 전 tsc (대표)

| File | Lines | 요지 |
|------|--------|------|
| [plan-generator.ts](src/lib/session/plan-generator.ts) | 146–148 | `readonly` 튜플 / `Omit<GoldPathSegmentRule,'count'>` — mutable 배열 요구와 불일치 |
| [bootstrap-summary.ts](src/lib/session/bootstrap-summary.ts) | 109–111 | 동일 (`GOLD_PATH_RULES`에 shared spread) |

### Readonly 원천 (이 PR에서 **미수정**)

- [lower-pair-session1-shared.ts](src/lib/session/lower-pair-session1-shared.ts) — `LOWER_PAIR_GOLD_PATH_RULES` `as const`
- [trunk-core-session1-shared.ts](src/lib/session/trunk-core-session1-shared.ts) — `TRUNK_CORE_GOLD_PATH_RULES` `as const`
- [deconditioned-stable-session1-shared.ts](src/lib/session/deconditioned-stable-session1-shared.ts) — 직접 tsc가 걸리지 않아 **미수정**

### Consumer (수정한 타입)

- [plan-generator.ts](src/lib/session/plan-generator.ts): `GoldPathSegmentRule` 배열 필드 `readonly TemplatePhase[]` / `readonly GoldPathVector[]` / `readonly number[]`; [hasTemplatePhase](src/lib/session/plan-generator.ts) `phases: readonly TemplatePhase[]`.
- [bootstrap-summary.ts](src/lib/session/bootstrap-summary.ts): `preferredPhases: readonly string[]` (최소 diff; `TemplatePhase` import 확장 **미실시**), 나머지 동일 readonly.

### Mutation

- Rule의 `preferredPhases` 등에 **push/splice 없음** — `includes`·`indexOf`·헬퍼 전달만.

## Root cause

- **Readonly**로 추론된 상수 배열을 **mutable** `T[]` 전용으로 선언한 타입에 넣으려 해 **readonly/mutable** 계약이 어긋남. 런타임 알고리즘 문제는 아님.

## LOCKED_DIRECTION

- Shared **`as const` 유지**; rule **내용/키** 변경 없음.
- `selectGoldPathTemplates` / `scoreGoldPathSegmentFit` / `buildGoldPathSegmentRules` 등 **로직** 변경 없음 (타입만).

## NOT_YET_IMPLEMENTED

- `src/app/api/session/complete` TS2589
- evidence-gate, next-session-preview, exercise-log-identity 등 session contract drift
- camera, external SDK, UI `Slot.Root`

## Files Changed

1. [src/lib/session/plan-generator.ts](src/lib/session/plan-generator.ts) — `GoldPathSegmentRule` + `hasTemplatePhase`
2. [src/lib/session/bootstrap-summary.ts](src/lib/session/bootstrap-summary.ts) — `GoldPathSegmentRule`만
3. [docs/pr/PR-03-goldpath-rule-readonly-contract-alignment.md](docs/pr/PR-03-goldpath-rule-readonly-contract-alignment.md) — 본 문서

## Why this is safe relative to SSOT

- public-first, `/app` execution, session create **source truth**, plan **selection** 시맨틱 **미수정** — **타입 계약**만 `readonly` 정렬.

## Verification

- `npx tsc --noEmit` + `Select-String "plan-generator.ts|bootstrap-summary.ts"` — **해당 경로 GoldPath/readonly 관련 TS2322 없음** (전체 tsc **green 주장 안 함**).
- 선택: `npm run test:session-snapshot`, `test:session-gen-cache`, `test:first-session-ssot`, `test:result-session-alignment`, `test:plan-generator` — env SKIP 시 기록.

## Explicit Non-goals

- 전체 tsc green
- GoldPath **rule 값** 변경, `as const` 제거, 런타임 spread 복사로 타입 맞춤
- `as any` / `as unknown as` / `@ts-ignore`
- session complete / camera / SDK

## Success criteria (잠금)

1. plan-generator 146–148 **TS2322 제거**
2. bootstrap-summary 109–111 **TS2322 제거**
3. shared **`as const` 유지**
4. **Rule 값** 변경 없음, **알고리즘** 변경 없음
5. 전체 tsc **green 주장 금지**
6. 본 문서 작성

## Follow-up PRs

- **PR-04** — session complete TS2589 (또는 [PR-00](docs/pr/PR-00-tsc-scope-dependency-unblock.md) 잔여)
