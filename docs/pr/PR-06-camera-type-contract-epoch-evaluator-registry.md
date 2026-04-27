# PR-06 Camera Type Contract — Epoch / Evaluator / Registry

**상태:** 구현 완료(2026-04-28). A/B/C/D + 조건부 `squat-completion-debug-types` epoch export.

---

## Scope lock (2026-04-28) — approved iteration

### 진행 범위 (A/B/C/D만)

| ID | 영역 | 허용 파일 / 작업 |
|----|------|------------------|
| **A** | Epoch source 타입 | [squat-completion-state.ts](../../src/lib/camera/squat-completion-state.ts), [squat-completion-core.ts](../../src/lib/camera/squat/squat-completion-core.ts) — **epoch source 타입 정렬만** (런타임 source 문자열·ledger 계산·epoch 선택 로직 **불변**). |
| **B** | Squat evaluator debug | [evaluators/types.ts](../../src/lib/camera/evaluators/types.ts), [evaluators/squat.ts](../../src/lib/camera/evaluators/squat.ts) — **additive optional** debug metrics, `reversalConfirmedBy` union 정렬, **null/undefined 정규화** (아래 제약). |
| **C** | Overhead highlightedMetrics | [evaluators/overhead-reach.ts](../../src/lib/camera/evaluators/overhead-reach.ts) — **null/undefined 정규화만**. |
| **D** | Absurd pass registry | [squat-absurd-pass-registry.ts](../../src/lib/camera/squat/squat-absurd-pass-registry.ts) — **unknown / Partial / guard 기반 narrowing만** (predicate·rule 내용·키 **불변**). |
| **Doc** | PR 기록 | 본 문서 `docs/pr/PR-06-camera-type-contract-epoch-evaluator-registry.md` |

### 기본 제외 (이번 PR)

- [squat-shallow-structural-owner.ts](../../src/lib/camera/evaluators/squat-shallow-structural-owner.ts) — **수정하지 않는다** (`tsc`가 해당 파일에 직접 걸려도 동일). Follow-up: **PR-06B** 후보로 문서 끝에 기록.
- **예외:** A/B/C/D만으로 **핵심 오류 검증이 구조적으로 불가능**해진 경우에만 작업을 멈추고 **별도 승인** 요청 (일반 경로는 제외 유지).

### 구현 제약 (승인 조건)

1. **structural-owner** — 이번 PR 기본 범위에서 제외. 필요 시 **PR-06B**로 분리.
2. **CanonicalTemporalEpochSource** — `string`을 **바로** 넣지 않는다. 실제 `source` 리터럴을 `grep`으로 수집한 뒤 **union**으로 정렬한다.
3. **null/undefined** — **null 우선** 정규화. `?? 0`은 **pass gate 입력이 아니고**, 호출 대상 API가 `number`를 **필수**로 요구할 때만 허용 (내부 품질 등은 해당 규칙에 맞게).
4. **불변** — pass/fail에 영향을 줄 수 있는 **함수 body**, **threshold**, **owner**, **gate**, **epoch 산출/선택**은 수정하지 않는다.
5. **smoke** — 카메라 smoke에서 pass/fail **결과가 바뀌면** 즉시 중단하고 **diff 되돌림**.
6. **tsc** — 전체 `tsc` green을 **주장하지 않는다**; camera 관련 (본 PR 파일) **감소/소거**만 보고.

### 조건부 타입 파일 (기존 PR-06 draft와 동일)

- `squat-completion-debug-types.ts` / `squat-motion-evidence-v2.types.ts` — **실제 tsc·구조상 명확할 때만**, PLAN 근거와 함께.

---

## Purpose

- Camera 관련 **TypeScript 계약**만 정리: epoch `source` union, `EvaluatorDebugSummary`·`highlightedMetrics`·`SquatReversalCalibrationDebug`의 **null/undefined**·**Record** 정합, absurd registry `SquatCycleDebug` **Partial** 접근.
- **Pass/fail semantics·threshold·owner·gate·epoch 산출 로직** — 변경 없음.

## CURRENT_IMPLEMENTED

### 수정 후 `tsc` (본 PR 파일)

- [squat-completion-core.ts](../../src/lib/camera/squat/squat-completion-core.ts), [squat-completion-state.ts](../../src/lib/camera/squat-completion-state.ts), [squat-completion-debug-types.ts](../../src/lib/camera/squat/squat-completion-debug-types.ts), [evaluators/types.ts](../../src/lib/camera/evaluators/types.ts), [evaluators/squat.ts](../../src/lib/camera/evaluators/squat.ts), [evaluators/overhead-reach.ts](../../src/lib/camera/evaluators/overhead-reach.ts), [squat-absurd-pass-registry.ts](../../src/lib/camera/squat/squat-absurd-pass-registry.ts) — **해당 경로 `tsc` 오류 없음** (로컬 `npx tsc --noEmit` grep 기준).
- [squat-shallow-structural-owner.ts](../../src/lib/camera/evaluators/squat-shallow-structural-owner.ts) — **이번 PR 미수정**; `EvaluatorDebugSummary` `tsc` 1건 **잔여** → **PR-06B** 후보.

### 관측 (highlightedMetrics)

- `holdSatisfiedAtMs` 등: **Record**에 넣을 때만 `?? null` — 로컬 변수는 기존과 같이 `undefined` 유지 가능.

## Root Cause

- Debug/observability 필드·epoch source union·`Record` index `null` 계약·`{}` 추론 — **타입 surface drift** (런타임 pass 정책과 별개).

## LOCKED_DIRECTION

- Debug 타입 **additive optional**; **null** 계약 우선; epoch source는 **실제 리터럴 union**; pass threshold·owner·gate **불변**.

## NOT_YET_IMPLEMENTED

- `squat-shallow-structural-owner` — **PR-06B** (EvaluatorDebugSummary 머지·필수 필드 등) 후보.
- evidence-gate test alignment, SDK/UI, 전체 tsc green 등 (기존 SSOT/PR-05 후속).

## Files Changed

1. [squat-completion-debug-types.ts](../../src/lib/camera/squat/squat-completion-debug-types.ts) — `DescentTimingEpochSource`, `CanonicalTemporalEpochSource` export (core와 동일 리터럴, `string` 캐치올 없음).
2. [squat-completion-core.ts](../../src/lib/camera/squat/squat-completion-core.ts) — 로컬 `DescentTimingEpochSource` 제거, debug-types에서 import; `CanonicalTemporalEpoch` `source`를 `CanonicalTemporalEpochSource`로 정렬.
3. [squat-completion-state.ts](../../src/lib/camera/squat-completion-state.ts) — `selectedCanonical*EpochSource` 필드 타입을 `DescentTimingEpochSource` / `CanonicalTemporalEpochSource`로 정렬.
4. [evaluators/types.ts](../../src/lib/camera/evaluators/types.ts) — `validFrameCountAfterReadinessDwell?`, `reversalConfirmedBy`에 `'trajectory'`.
5. [evaluators/squat.ts](../../src/lib/camera/evaluators/squat.ts) — `computeSquatInternalQuality`에 `recoveryDropRatio`/`returnContinuityFrames` `?? 0`; `buildSquatEvaluatorHighlightedMetrics`·`highlightedMetrics` `Record` **undefined 제거**·`recoveryDropRatio` `null` 등.
6. [evaluators/overhead-reach.ts](../../src/lib/camera/evaluators/overhead-reach.ts) — `highlightedMetrics`·일부 reason/timestamp **null** 정규화; `holdSatisfiedAtMs` **null** when unset.
7. [squat-absurd-pass-registry.ts](../../src/lib/camera/squat/squat-absurd-pass-registry.ts) — `Partial<SquatCycleDebug>` + non-array object 가드.
8. 본 문서.

## Why this is safe relative to SSOT

- Camera pass semantics·V2 pass owner·readiness/arming·public/session flow **미수정**; **타입/관측 계약**만.

## Verification

- `npx tsc --noEmit` — 전체 **exit ≠ 0** 가능; 본 PR 대상 경로 **오류 0** (structural-owner 1건 제외).
- `npm run test:camera-pr2-signal` — **17 passed, 0 failed**.
- `npm run test:camera-pr3-stability` — **16 passed, 1 failed** (AT6: `isFinalPassLatched` low-quality 케이스). 타입 전용 PR과 무관한 **기존 스모크 드리프트**로 분류; 본 PR에서 threshold/게이트 미수정.
- `npm run test:camera-pr4-trace` — **33 passed, 3 failed** (AT10b/c/j pass_snapshot). 동일히 **기존 드리프트** 후보; 본 PR은 trace 경로·스냅샷 빌더 **미수정**.

## Explicit Non-goals

- 전체 tsc green; shallow/deep/standing guard/overhead hold **튜닝**; **session/app/package/tsconfig**; UI/voice.

## Follow-up PRs

- **PR-06B (후보):** [squat-shallow-structural-owner.ts](../../src/lib/camera/evaluators/squat-shallow-structural-owner.ts) — `EvaluatorDebugSummary`와의 `debug` 머지/필수 필드 `tsc` 정렬 (PR-06 본문 A/B/C/D와 독립).
