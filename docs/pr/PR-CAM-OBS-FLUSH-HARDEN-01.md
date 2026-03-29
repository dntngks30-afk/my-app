# PR-CAM-OBS-FLUSH-HARDEN-01 — Squat observation flush into terminal bundles

## Findings

- **CURRENT_IMPLEMENTED**: `recordCaptureSessionTerminalBundle`는 `getRecentSquatObservations()`로 관측 배열을 읽어 필터 후 번들에 넣는다.
- **증상**: export JSON에서 `observations`가 빈 배열로 반복되는 사례가 있다.
- **가설 원인**: (1) 통과 경로는 effect가 `captureTerminal` 블록에 들어가기 전 `latchPassEvent`로 return 되어 **`capture_session_terminal` 관측이 없을 수 있음** (2) `localStorage.setItem` 실패/레이스 시 직후 `getItem`이 최신을 못 읽음 (3) 터미널 직전 push와 bundle read의 순서가 얇게 어긋남.

## Root cause hypothesis

- **플로우**: 성공 시 `effectivePassLatched` 분기가 먼저 실행되어 terminal용 `recordSquatObservationEvent`가 스킵되고, bundle만 생성 → 필터 통과 관측이 0에 가깝게 보일 수 있음.
- **저장소**: LS만 신뢰하면 쓰기 실패 시 메모리상 최신 목록이 반영되지 않음.
- **버그(동시 수정)**: `buildSquatAttemptObservation` 내부에 정의되지 않은 `csFull` 참조가 있어, 런타임에서 `ReferenceError`로 **관측 자체가 기록되지 않을 수 있음**(Node/스모크에서 확정).

## Why user is not at fault

- 관측은 캡처 중 emit되지만, **export 타이밍**과 **성공 분기**가 맞물리면 번들 입력 배열이 비어 보일 수 있다.

## Scope

- `pushSquatObservation` 후 메모리 캐시 + `getRecentSquatObservationsSnapshot`.
- 번들 생성 시 snapshot 헬퍼 사용.
- 스쿼트 페이지에서 terminal bundle **직전** `capture_session_terminal` 1회(기존 ref로 중복 방지).
- `summary.observationCount` 보조 필드.

## Non-goals

- auto-progression / completion-state / pose / arming / event-cycle **산식·임계** 변경.
- observation 스키마 대규모 변경, 음성·UX·navigation 변경.
- raw frame / landmark / video 저장.

## Files changed

- `src/lib/camera/camera-trace.ts` (캐시·snapshot·`getObservationStorage`·`csFull` 참조 수정)
- `src/lib/camera/camera-trace-bundle.ts`
- `src/app/movement-test/camera/squat/page.tsx`
- `scripts/camera-cam-obs-flush-harden-01-smoke.mjs`, `scripts/camera-cam-snapshot-bundle-01-smoke.mjs` 보강
- `docs/pr/PR-CAM-OBS-FLUSH-HARDEN-01.md`

## Acceptance tests

- 타입·lint(변경 파일).
- pass/gate/completion 산식 diff 없음(지정 금지 파일 미수정).
- 관측 1건 이상 후 terminal bundle → `bundle.observations.length >= 1` 및 `observationCount` 일치.
- LS 쓰기 실패 시나리오에서 캐시로 snapshot이 비지 않음(스모크).
- `npx tsx scripts/camera-cam-obs-flush-harden-01-smoke.mjs`
- `npx tsx scripts/camera-cam-snapshot-bundle-01-smoke.mjs`

## Rollback

- 캐시·snapshot 헬퍼·페이지 flush·`observationCount` 제거 후 `getRecentSquatObservations()` 단일 경로로 복귀.

## Why this is safe

- **판정 로직 미변경**: 관측 기록·읽기·순서만 보강.
- **하위 호환**: 기존 필드 유지, `observationCount`·캐시는 additive.
