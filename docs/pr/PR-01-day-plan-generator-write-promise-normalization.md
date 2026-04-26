# PR-01 Day Plan Generator Write Promise Normalization

## Purpose

- routine day plan 저장 write op에서 Supabase `PostgrestFilterBuilder`(thenable)를 `Promise<unknown>[]`에 넣어 발생하던 **TS2739 / TS2345**를 제거한다.
- `day-plan-generator.ts` 한 파일의 tsc 잡음을 후속 session/camera/SDK 오류와 분리한다.
- **선택 1(승인):** `const writes: Promise<unknown>[]` → `const writes: PromiseLike<unknown>[]`만 변경. `toWritePromise` 헬퍼는 **추가하지 않음** (이 변경으로 오류가 제거됨).

## CURRENT_IMPLEMENTED

- 수정 **전** `npx tsc --noEmit`에서 본 [day-plan-generator.ts](src/lib/routine-plan/day-plan-generator.ts) 오류(3건):

| Line | Code | Summary |
|------|------|--------|
| 619 | TS2739 | `upsertOp` (Postgrest builder)가 `Promise<unknown>`과 호환되지 않음 |
| 621 | TS2345 | `revisions` insert — `push` 대상 `Promise<unknown>` 부적합 |
| 624 | TS2345 | `audit` insert — 동일 |

- 기존 write flow(변경 없음):
  - `routine_id`+`day_number` 키로 `routine_day_plans` **upsert** (`upsertOp`)
  - `routine_day_plan_revisions` **insert**(`revisionPayload`) — `hasChange`일 때
  - `routine_day_plan_audit` **insert**(`auditPayload`) — `oldHash !== planHash`일 때
  - `existing.data`가 있을 때: 위 op들을 `Promise.all(writes)`로 **병렬**
  - `existing.data`가 없을 때: `upsert` 후 `hasChange`이면 `revisions` insert만 **순차** (else 분기: 기존 tsc 오류 없어 **수정 없음**)

## Root cause

- Supabase `upsert`/`insert` 체이닝 결과는 **완전한 `Promise` 타입**이 아니라 `PostgrestFilterBuilder`이며, `Promise`의 `catch`/`finally` 등이 없다고 판정되어 `Promise<unknown>[]`에 넣을 수 없었다.
- **런타임 저장 정책** 문제가 아니라 **TypeScript의 배열 요소 타입**이 과도하게 `Promise<unknown>`으로 좁혀진 **표현 문제**였다.
- **수정:** `Promise.all`이 받는 이터러블은 사실 `PromiseLike`를 지원하므로, 배열 타입을 **`PromiseLike<unknown>[]`로** 맞췄다. payload, 분기, 실행 순서, `Promise.all` 병렬 의미는 **동일**.

## LOCKED_DIRECTION

- Supabase write op는 **thenable = `PromiseLike`**로 취급하는 것이 `Promise.all`과 일치하며, 저장 조건·payload·순서·에러 처리(추가 검사/throw 없음)는 유지.
- day plan **도메인 정책**(운동 선택, 해시, regen)은 **이 PR에서 변경하지 않음**.

## NOT_YET_IMPLEMENTED (후속 PR)

- `src/app/api/session/complete/route.ts` TS2589
- `plan-generator` `meta.confidence` 등
- session contract / bootstrap 드리프트
- camera epoch / evaluator / fixtures 타입
- media/pdf/외부 SDK, UI `Slot.Root` TS2339 등

## Files Changed

1. [src/lib/routine-plan/day-plan-generator.ts](src/lib/routine-plan/day-plan-generator.ts) — `writes` 배열 요소 타입 1곳
2. [docs/pr/PR-01-day-plan-generator-write-promise-normalization.md](docs/pr/PR-01-day-plan-generator-write-promise-normalization.md) — 본 문서

## Why this is safe relative to SSOT

- public-first 흐·auth·pay·**session creation source-of-truth** — 코드 미수정.
- `/app` execution 코어, camera pass semantics, **upsert/revision/audit payload 필드** — 동일.
- `throwOnError` / 새 `error` 검사 / 새 `throw` / `as any` — **없음**.

## Verification

| Command | Note |
|--------|------|
| `npx tsc --noEmit 2>&1 \| Select-String "day-plan-generator"` | **오류 0** (다른 경로 tsc는 여전히 실패 가능) |
| `npm run test:plan-generator` | 로컬에서 **SKIP: Supabase env required** (스모크는 설치/환경 없으면 자동 skip — 본 PR 타입 변경과 무관) |

- 전체 `npx tsc --noEmit` **green이 성공 기준은 아님**; `day-plan-generator` 관련 TS2739/TS2345 **제거**가 목표.

## Explicit Non-goals

- 전체 tsc green
- 운동 선택/템플릿/해시/일일 regen **알고리즘** 변경
- Supabase **에러 처리 정책** 변경(새 검사·throw)
- DB migration
- `src/lib/session/**`, `src/lib/camera/**`, `package.json` / `tsconfig` 수정

## Follow-up PRs (추천)

- **PR-04** — session `complete` TS2589(깊이)
- **PR-02** — plan-generator meta 등
- **PR-03** — session contract
