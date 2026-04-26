# PR-04 Session Complete Adaptive Evaluator Supabase Adapter

## Purpose

- [complete/route.ts](src/app/api/session/complete/route.ts)에서 `runEvaluatorAndUpsert(supabase, …)` 호출 시 발생하던 **TS2589**를 제거한다.
- `getServerSupabaseAdmin()`의 **full Database 제네릭**과 inline structural 파라미터 간 **타입 인스턴스화 깊이** 문제를, [adaptive-evaluator](src/lib/session/adaptive-evaluator.ts) 전용 **얕은 `AdaptiveEvaluatorSupabase` + `createAdaptiveEvaluatorSupabaseAdapter(unknown)`** 한 경계로 차단한다.
- 세션 완료 **정책**, evidence gate, event logging, progress, idempotency, **adaptive 계산·upsert payload·반환 shape**는 **변경하지 않는다**.

## CURRENT_IMPLEMENTED

### 수정 전

- `src/app/api/session/complete/route.ts` **L467** 근처: **TS2589** (type instantiation excessively deep).
- [adaptive-evaluator.ts](src/lib/session/adaptive-evaluator.ts): `loadSessionEventsForEval` / `runEvaluatorAndUpsert`가 **inline** supabase structural 타입 사용; 호출부에서 full admin client 대입 시 깊은 제네릭 전개.

### 실제 DB surface (불변)

- `session_exercise_events`: `select` + `eq('session_plan_id', …)`
- `session_adaptive_summaries`: `upsert([row], { onConflict: 'session_plan_id' })`, `error`만 사용

### Root cause

- **런타임 버그가 아님** — TypeScript가 full `SupabaseClient<Database,…>`가 inline structural 타입과 **구조적으로 호환**됨을 증명하는 과정에서 제네릭이 과도하게 전개됨.

## LOCKED_DIRECTION

- **Adapter 경계**(`createAdaptiveEvaluatorSupabaseAdapter`) 내부에만 `supabase as AdaptiveEvaluatorSupabase` 단언.
- [route.ts](src/app/api/session/complete/route.ts)에 **신규 `as any` 없음**; 기존 `(supabase as any)` progress 조회는 **미변경**.

## NOT_YET_IMPLEMENTED

- evidence-gate / next-session-preview / exercise-log-identity drift
- camera, external SDK, UI `Slot.Root`

## Files Changed

1. [src/lib/session/adaptive-evaluator.ts](src/lib/session/adaptive-evaluator.ts) — `AdaptiveEvaluatorSelectEqResult`, `AdaptiveEvaluatorUpsertResult`, `AdaptiveEvaluatorSupabase`, `createAdaptiveEvaluatorSupabaseAdapter`, 시그니처 정리
2. [src/app/api/session/complete/route.ts](src/app/api/session/complete/route.ts) — `createAdaptiveEvaluatorSupabaseAdapter(supabase)`로만 `runEvaluatorAndUpsert` 호출
3. [docs/pr/PR-04-session-complete-adaptive-evaluator-supabase-adapter.md](docs/pr/PR-04-session-complete-adaptive-evaluator-supabase-adapter.md) — 본 문서

**미수정:** [session-exercise-events.ts](src/lib/session/session-exercise-events.ts) (직접 TS2589 없음, 본 PR 범위 밖).

## Why this is safe relative to SSOT

- public-first flow, `/app` 실행 UX, session create **source truth** — **미수정**.
- **Evaluator** `evaluateSession`, `resolveAdaptiveModifier`, row 필드, upsert 옵션, `AdaptiveSummaryDebug` — **동일**.

## Verification

- `npx tsc --noEmit` — **TS2589** on `complete/route` **제거** (전체 tsc **green 주장 안 함**).
- 선택: `npm run test:adaptive-evaluator-observability`, `test:adaptive-progression`, `test:session-feedback`, `test:evidence-gate`, `test:session-snapshot` — env SKIP 시 기록.

## Explicit Non-goals

- 전체 tsc green
- session complete **비즈니스**·evidence·scoring·DB **스키마** 변경
- `getServerSupabaseAdmin` / [supabase.ts](src/lib/supabase.ts) 변경
- camera / routine-plan / session create 경로

## Success criteria (잠금)

1. `complete/route` L467 부근 **TS2589 제거**
2. full client를 `runEvaluatorAndUpsert`에 **직접 전달하지 않음**
3. **단일 adapter 경계**에 타입 단언
4. route **나머지** 로직·adaptive **계산/페이로드** **불변**
5. `session-exercise-events` **미수정**

## Follow-up PRs

- session contract / evidence / camera 등 [PR-00](docs/pr/PR-00-tsc-scope-dependency-unblock.md) 잔여
