# PR-CAM-SNAPSHOT-BUNDLE-01 — Capture session JSON bundle (mobile debugging)

## Findings

- **CURRENT_IMPLEMENTED**: `AttemptSnapshot`와 `SquatAttemptObservation`는 각각 `moveReCameraTrace:v1`, `moveReCameraSquatObservation:v1`에 bounded 저장된다.
- **NOT_YET_IMPLEMENTED (본 PR 전)**: 한 번의 실제 촬영 시도(성공·재시도·무효·이탈)를 **단일 JSON**으로 묶은 저장소가 없어, 실기기에서 콘솔/라이브 패널 없이 “이번 시도 전체”를 복사하기 어렵다.

## Why current trace is insufficient on mobile

- 모바일에서는 화면 녹화·오버레이 디버그 패널이 부담스럽다.
- 스냅샷 배열과 관측 배열을 수동으로 대응시키기 어렵고, 붙여넣기 한 번에 공유할 **시도 단위 번들**이 없다.

## Scope

- `CaptureSessionBundle` 타입 및 `moveReCameraTraceBundle:v1` 저장(최대 20건).
- 터미널 시점에 스냅샷 1건 + 시간 창으로 필터된 squat 관측만 포함.
- `getLatestCaptureSessionBundle`, `copyLatestCaptureSessionBundleJson` 등 export 및 dev-only `window.__MOVE_RE_CAMERA_TRACE__`.
- 스쿼트 캡처 페이지에서 터미널/abandon 기록(1스텝 1회 가드).

## Non-goals

- `evaluateSquatCompletionState`, `auto-progression` 산식, pose/completion 이벤트 사이클 로직·임계값 변경.
- raw frame, landmark 배열, video blob 저장.
- 카메라 UX·음성·네비게이션·`/app`·public funnel·auth/pay 경로 수정.

## Files changed

- `src/lib/camera/camera-trace.ts` — `clearAttempts` 시 번들 키 제거.
- `src/lib/camera/camera-trace-bundle.ts` — 번들 타입·저장·필터·복사.
- `src/app/movement-test/camera/squat/page.tsx` — 터미널·unmount abandon·dev global.
- `scripts/camera-cam-snapshot-bundle-01-smoke.mjs` — 스모크.
- `docs/pr/PR-CAM-SNAPSHOT-BUNDLE-01.md` — 본 문서.

## Bundle summary (권장 필드)

`latestAttempt.diagnosisSummary.squatCycle` 및 스냅샷 상단에서 안전 추출:

- `completionPassReason`, `completionPathUsed`, `passOwner`, `finalSuccessOwner`
- `captureQuality`, `confidence`, `relativeDepthPeak`, `rawDepthPeak`, `depthBand`, `romBand`
- `passBlockedReason`, `completionBlockedReason`, `standardPathBlockedReason`
- `eventCycleDetected`, `eventCyclePromoted`, `eventCycleSource`

## Acceptance tests

- 타입·lint 통과.
- pass/gate/completion 관련 파일에 **산식 diff 없음**(지정 금지 파일 미변경).
- 터미널 번들이 `success` | `retry_*` | `invalid` | `failed` | `abandoned` 중 하나로 저장 가능.
- 최신 번들 JSON 직렬화·복사 API가 문자열을 반환.
- 기존 attempt / observation 저장 회귀 없음.
- 스모크: `npx tsx scripts/camera-cam-snapshot-bundle-01-smoke.mjs`

## Device observation workflow

1. 스쿼트 캡처 페이지에서 시도 1회(성공·실패·재시도·이탈 등).
2. **개발 빌드**에서 원격 디버깅 콘솔 또는 Safari Web Inspector 연결.
3. `await window.__MOVE_RE_CAMERA_TRACE__.copyLatestCaptureSessionBundleJson()` 또는 `getLatestCaptureSessionBundle()` 후 JSON 붙여넣기.

## Rollback

- `camera-trace-bundle.ts` 제거 및 페이지의 import·effect·ref 블록 제거.
- `camera-trace.ts`의 `clearAttempts`에서 `removeItem('moveReCameraTraceBundle:v1')` 제거.
- 클라이언트 localStorage 키 `moveReCameraTraceBundle:v1`은 무시해도 동작에 영향 없음.

## Why this is safe relative to SSOT / product rules

- **관측성만 추가**: 판정·게이트·completion 소유권 로직은 변경하지 않는다.
- **프라이버시**: 기존 스냅샷과 동일하게 원시 미디어·랜드마크 배열을 저장하지 않는다.
- **실행 코어·퍼널**: 스쿼트 카메라 페이지와 trace 모듈만 touched.
