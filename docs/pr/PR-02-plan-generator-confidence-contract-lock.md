# PR-02 Plan Generator Confidence Contract Lock

## Purpose

- `plan_json.meta.confidence`의 **타입·의미 계약**을 **숫자(`number`)**로 고정한다.
- `'high' | 'mid' | 'low'` tier 문자열을 **같은 필드**에 넣지 않는다 (`confidence_tier`는 이번 PR에서 **추가하지 않음**).
- session create 경로의 `deepSummary.effective_confidence ?? deepSummary.confidence` → `PlanGeneratorInput.confidence` 흐름과 `plan_json.meta` 계약을 **혼동하지 않게** 한다.

## CURRENT_IMPLEMENTED

### 수정 전 tsc (plan-generator.ts)

| Line | Code | 내용 |
|------|------|------|
| 1349 | **TS2322** | `meta.confidence`에 `'high'\|'mid'\|'low'` 문자열 대입 — `PlanJsonOutput.meta.confidence?: number`와 불일치 |
| 146–148 | TS2322 | `GoldPathSegmentRule` / `Omit<…,'count'>` — **이번 PR 비범위** (readonly tuple vs mutable 등, 후속 세션 계약/타입 정리 PR) |

### 타입 계약

- `PlanGeneratorInput.confidence?: number` ([plan-generator.ts](src/lib/session/plan-generator.ts))
- `PlanJsonOutput.meta.confidence?: number` (동일 파일)
- [plan-materialize.ts](src/app/api/session/create/_lib/plan-materialize.ts) L75: `confidence: deepSummary.effective_confidence ?? deepSummary.confidence` — **이 PR에서 미변경**

### deep summary

- `SessionDeepSummary.confidence` — legacy 숫자; `effective_confidence` — SSOT 숫자 ([session-deep-summary.ts](src/lib/deep-result/session-deep-summary.ts) 맥락). materialize가 **eff ?? legacy**로 generator에 전달.

### Root cause

- 구현 한 곳에서 numeric `input.confidence`를 받아 두고, `meta.confidence`에는 **tier 문자열**을 넣어 타입 계약과 충돌.
- 저장/표시 계약 필드에 **숫자와 tier 의미를 같은 키에 섞으면** 안 됨.

## Known behavior note

기존 구현은 `plan_json.meta.confidence`에 `high | mid | low` 문자열을 넣고 있었으나, 타입 계약은 `number`였다.  
이번 PR은 타입 계약에 맞춰 `meta.confidence`를 **숫자**로 되돌린다.

현재 `SessionRoutinePanel`은 `신뢰도 {meta.confidence}`를 그대로 표시하므로 **표시값이 문자열 tier에서 numeric confidence로 바뀔 수 있다.**  
이 UI 표현 개선은 `/app` 실행 코어 수정 범위이므로 **이번 PR에서는 건드리지 않고**, 필요하면 별도 UI PR에서 `confidence_tier` 또는 formatter를 설계한다.

## LOCKED_DIRECTION

- `meta.confidence`는 **optional `number`** 유지.
- tier 문자열이 제품적으로 필요해지면 **`meta.confidence_tier` 등 별도 필드**로만 (이번 PR 미추가).
- `effective_confidence` SSOT 흐름은 **유지**.
- 세션 생성·운동 선택 **알고리즘·정책** — 변경 없음.

## NOT_YET_IMPLEMENTED

- `src/app/api/session/complete/route.ts` TS2589
- session contract drift (예: plan-generator 146–148 GoldPath)
- camera epoch/evaluator 타입
- external SDK/platform, UI `Slot.Root` TS2339

## Files Changed

1. [src/lib/session/plan-generator.ts](src/lib/session/plan-generator.ts) — `meta.confidence` 대입만
2. [docs/pr/PR-02-plan-generator-confidence-contract-lock.md](docs/pr/PR-02-plan-generator-confidence-contract-lock.md) — 본 문서

## Why this is safe relative to SSOT

- public-first flow, `/app` 실행 코어 **로직** 미수정.
- session create **source truth**, plan selection **알고리즘** 미수정.
- `plan-materialize` / `session-deep-summary` **미수정**.
- **confidence 메타 계약 정리**만.

## Verification

| Command | 기대 |
|---------|------|
| `npx tsc --noEmit` + `plan-generator.ts` 필터 | **L1349 TS2322 제거**; 146–148은 **남을 수 있음** |
| 전체 `tsc` | **green 주장 안 함** |

가능 시: `npm run test:plan-generator`, `test:session-snapshot`, `test:session-gen-cache` — Supabase/env SKIP이면 환경 이슈로 기록.

## Explicit Non-goals

- 전체 tsc green
- `0.9` / `0.6` / `0.3` 등 **임의 숫자 tier 매핑**
- `confidence?: number \| string` union
- `as any`
- GoldPathSegmentRule(146–148) 수정
- `plan-materialize` confidence 출처 변경

## Success criteria (잠금)

1. plan-generator.ts **L1349 부근 confidence TS2322 제거**
2. `meta.confidence` — **number** 계약 유지
3. `confidence_tier` **미추가**
4. `plan-materialize` / `session-deep-summary` 흐름 **미수정**
5. `SessionRoutinePanel` **미수정**
6. GoldPathSegmentRule 오류 **미수정**
7. 전체 tsc green **주장 금지**

## Follow-up PRs

- **PR-03** — plan-generator GoldPath / bootstrap segment rule tuple 정리
- **PR-04** — session complete TS2589
