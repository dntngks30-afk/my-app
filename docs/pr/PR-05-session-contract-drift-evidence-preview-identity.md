# PR-05 Session contract drift: evidence-gate, next-session preview, exercise-log identity

## Purpose

- [evidence-gate.ts](src/lib/session/evidence-gate.ts): `countCompletedItems` **반환 타입**에 런타임에서 이미 반환하던 `cooldownItemsCount`, `cooldownCompleted`를 **명시**하고, **`CompletedItemCounts` 타입 alias**로 shape를 정렬한다.
- [exercise-log-identity.ts](src/lib/session/exercise-log-identity.ts): `buildCompletionExerciseLogsWithIdentity`의 `result.push`에서 `ExerciseLogItemWithIdentity` **필수** `difficulty`를 `difficulty: log.difficulty ?? null`로 보장한다.
- [next-session-preview.ts](src/lib/session/next-session-preview.ts): `focus_label`은 **표시용**(`NextSessionPreviewData`만)으로 유지하고, **Payload 타입에 추가하지 않는다**; `getPreviewFocusLabel`로 union에서 안전 접근; `resolveLockedNextSessionPreview`의 **`undefined` 반환 여지**를 `?? null`로 제거한다.
- **threshold / MAIN gate 분기 / coverage·evidence score / 메시지 / preview copy / readiness / locked next 의미** — **변경 없음**。

## CURRENT_IMPLEMENTED

### Root cause (타입 정렬)

- `countCompletedItems`는 이미 `cooldownItemsCount`, `cooldownCompleted`를 반환했으나, 함수 **명시 반환 타입**에 누락 → 구조분해·호출부와 **불일치**。
- `ExerciseLogItemWithIdentity`는 `difficulty: number | null` **필수**인데, spread만으로는 `difficulty?` 콜백 반환과 **맞지 않을 수 있음**。
- `NextSessionPreviewPayload`에 `focus_label` 없이 union에서 직접 `payload.focus_label` 접근 → **타입 오류**; `resolveLockedNextSessionPreview`는 `NextSessionPreviewPayload | null`인데 `nextSession`이 `undefined`일 수 있어 **undefined 누수**。

### 수정 범위

- 위 **세 파일** + 본 PR 문서만.

## LOCKED_DIRECTION

- Public result → session / evidence **의미**는 SSOT·기존 gate 정책과 동일; 본 PR은 **TypeScript·계약 정렬**。

## NOT_YET_IMPLEMENTED

- `test:evidence-gate` **2 fail** (아래) — **threshold/MAIN 분기로 고치지 않음**; **별도 evidence-gate behavior / test-alignment PR**。

## Files Changed

1. [src/lib/session/evidence-gate.ts](src/lib/session/evidence-gate.ts) — `CompletedItemCounts`, `countCompletedItems` 반환 타입
2. [src/lib/session/exercise-log-identity.ts](src/lib/session/exercise-log-identity.ts) — `difficulty: log.difficulty ?? null`
3. [src/lib/session/next-session-preview.ts](src/lib/session/next-session-preview.ts) — `getPreviewFocusLabel`, `resolveLockedNextSessionPreview` `?? null`
4. [docs/pr/PR-05-session-contract-drift-evidence-preview-identity.md](docs/pr/PR-05-session-contract-drift-evidence-preview-identity.md) — 본 문서

**미수정 (명시):** `route.ts`, `adaptive-evaluator.ts`, `session-exercise-events.ts`, `plan-generator.ts`, `bootstrap-summary.ts`, camera, `package`/`tsconfig`.

## Why this is safe relative to SSOT

- **런타임 분기·임계값·게이트 문구** — evidence-gate에서 **불변** (타입·alias만).
- `focus_label` — **API Payload 확장 없음**; display 경로만 narrow.
- exercise log — **필드 의미·plan_item_key/legacy** — **불변**。

## Verification

- `npx tsc --noEmit` — 프로젝트 전체 **green은 본 PR 범위 아님**; 위 세 파일은 **tsc 리포트에 미포함**으로 확인.
- `npm run test:session-snapshot` — **18 passed**。
- `npm run test:session-gen-cache` — **11 passed**。
- `npm run test:evidence-gate` — **19 passed, 2 failed** (기대 밖 동작; 아래 **기존 테스트 기대 드리프트**로 기록, 본 PR에서 gate 로직 **미수정**).

### Existing test expectation drift (`test:evidence-gate`)

| Assertion | Result | Classification |
|-----------|--------|----------------|
| `AT2: MAIN_SEGMENT_REQUIRED` | failed | 스모크가 기대하는 **MAIN rejected**와 현재 allow/reject 경로 **불일치** — **잠재적 기대 주석/픽스처 드리프트**; **evidence-gate behavior / test-alignment** 후속 PR에서 정합. |
| `AT2: rejected path has reject_reason_code` | failed | **rejected** 메타와 assertion **불일치**; 동일 후속 PR에서 **관측 필드·assert** 정렬. |

**본 PR에서 threshold/MAIN 분기/메시지로 “테스트를 통과”시키지 않는다.**

## Explicit Non-goals

- evidence gate **정책**·**threshold**·**MAIN gate**·**coverage/score** 조정
- `NextSessionPreviewPayload`에 `focus_label` **추가**
- `ExerciseLogItem` / `plan_item_key` / legacy migration **변경**
- `scripts/evidence-gate-smoke.mjs` **수정** (드리프트는 **문서·후속 PR**)

## Success criteria

1. 세 파일 **의도한 타입/계약** 정렬
2. **금지된 경로** 미수정
3. `test:evidence-gate` 실패는 **문서화**하고 **별도 PR**로 분리
