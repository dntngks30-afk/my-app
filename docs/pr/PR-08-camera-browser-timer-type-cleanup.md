# PR-08 Camera Browser Timer Type Cleanup

## Purpose

`live-readiness.ts` / `voice-guidance.ts`의 **browser timer id** 타입 오류(TS2322)만 정리한다. `readiness` / `voice` **semantics**, 상수, cue 순서, settle/cancel **의미**는 변경하지 않는다.

## CURRENT_IMPLEMENTED

**수정 전 `tsc` (참고; 행은 리포지토리 상태에 따라 약간 변할 수 있음)**

- `src/lib/camera/live-readiness.ts(225,5)`: `TS2322: Type 'number' is not assignable to type 'Timeout'.`
- `src/lib/camera/voice-guidance.ts(641,3)`: 동일 `TS2322` (`voiceWaitWatchdogId`에 `window.setTimeout` 반환 `number` 할당).
- `src/lib/camera/voice-guidance.ts(876,7)`, `(993,7)`: `TS2739` — `StepGuardrailResult` 필드 누락 (Timer **아님**; 본 PR **미수정**).

**live-readiness `timeoutRef` (수정 전)**

- `useRef<ReturnType<typeof setTimeout> | null>(null)` + 실제 `window.setTimeout` → DOM `number` vs Node `Timeout` 혼선.

**voice-guidance `voiceWaitWatchdogId` (수정 전)**

- `ReturnType<typeof window.setTimeout> | null` + `window.setTimeout` 할당 → 동일 `TS2322`.

**PR-07에서 Follow-up으로 남았던 점**

- [PR-07-external-sdk-platform-ui-primitive-type-cleanup.md](./PR-07-external-sdk-platform-ui-primitive-type-cleanup.md) `NOT_YET_IMPLEMENTED` / Follow-up: `live-readiness` / `voice-guidance` Timer (`number` vs `NodeJS.Timeout`). PR-08이 그 **Timer-only** 후속이다.

**475행 `setTimeout`**

- tsc는 해당 줄에 오류를 보고하지 않았다. **fire-and-forget** 이고 `window` 강제 시 서버/테스트 리스크를 피하기 위해, **이번 PR에서는 변경하지 않는다** (승인 조건).

## Root cause

- DOM `window.setTimeout`은 **`number` id**를 반환하나, `ReturnType<typeof setTimeout>`(global) 등은 `@types/node`·lib 병합에서 **`Timeout`/`NodeJS.Timeout`**으로 잡힐 수 있어 `window.clearTimeout` / 할당 쪽과 **충돌**한다.
- 런타임 policy 문제가 아니라 **browser timer id 표기** 문제다.

## LOCKED_DIRECTION

- Browser(클라이언트) 경로의 timer id는 **`number | null`로 명시**한다.
- set/clear는 **watchdog·stabilize 경로**에서 `window.setTimeout` / `window.clearTimeout`을 그대로 사용한다(의미 유지).
- Readiness state machine, `READY_ENTER_DELAY_MS`, voice timing **상수**, cue sequence, `settleWait` / `cancelVoiceGuidance` **동작**은 **변경하지 않는다**.

## NOT_YET_IMPLEMENTED

- **PR-08 후속(별도 PR):** `voice-guidance.ts` 876, 993 `StepGuardrailResult` **TS2739** — `VoiceGuidanceGate` / `guardrail` shape 계약 정합(필드 `stepId`, `confidence`, `retryRecommended`, `fallbackMode`, `completionStatus` 등).
- PR-06B structural-owner, evidence-gate, camera smoke baseline drift, **전체 `tsc` green** 등(기존 SSOT/복구 설계).

## Files Changed

- `src/lib/camera/live-readiness.ts`
- `src/lib/camera/voice-guidance.ts`
- `docs/pr/PR-08-camera-browser-timer-type-cleanup.md` (본 문서)

## Why this is safe relative to SSOT

- Camera **pass/완료 semantics** 미수정, **readiness** 전이·지연·blocker **미수정**, **voice cue sequence** / anti-spam / intro·countdown **미수정**, **audio fallback** **미수정** — **timer id 타입**과 `!== null` clear 가드만 정리한다.

## Verification

- `npx tsc --noEmit` — PR-08 범위: **live-readiness / voice-guidance**에서 **Timer 관련 TS2322 제거** 확인.
- `voice-guidance` **TS2739** (876, 993)는 **잔여 가능**; Timer PR 비목표.
- (선택) `npm run` 목록에 voice/camera/readiness 스크립트가 있으면 실행; 실패 시 기존 drift vs 이번 diff 구분.
- **전체 `tsc` green**은 본 PR에서 주장하지 않는다.

## Explicit Non-goals

- **전체 `tsc` green** (StepGuardrail 등 **후속 PR**)
- `READY_ENTER_DELAY_MS` / `STABLE_HOLD_MS` / `REPEAT_COOLDOWN_MS` / `getVoiceCueMaxWaitMs` **변경**
- cue text / priority / cooldown, intro / countdown / follow-up **순서** 변경
- `cancelVoiceGuidance` / `settleWait` / watchdog **의미** 변경 (타입·clear 가드 제외)
- 475행 **global** `setTimeout` → `window.setTimeout` **강제 전환** (tsc 미보고, 승인상 유지)
- `korean-audio-pack.ts`, camera **evaluator** / **squat core**, session, package, tsconfig **수정**
- `as any` / `@ts-ignore` / `@ts-expect-error`

## Follow-up PRs (제안)

- **Voice guardrail / StepGuardrailResult TS2739** — `voice-guidance` 호출·`StepGuardrailResult` 타입 정합
- PR-06B structural-owner, evidence-gate, PR-CAM-SMOKE, 잔여 tsc

## Success criteria (recap)

- `live-readiness` Timer 관련 **TS2322** 제거; `useRef<number | null>`, `!== null` clear guard, `window` set/clear 유지.
- `voice-guidance` **voiceWaitWatchdogId** `number | null` + watchdog **TS2322** 제거; 475행 **불필요 변경 없음** (tsc 없음).
- **TS2739**는 **수정하지 않음**; 본 문서 **Follow-up**에 기록.
- 허용 파일 **3개만**; 상수·시맨틱·`as any`/지시어 **없음**.
