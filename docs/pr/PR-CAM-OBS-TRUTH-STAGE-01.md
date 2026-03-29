# PR-CAM-OBS-TRUTH-STAGE-01

## Findings

`completionBlockedReason`는 completion-state가 항상 “attempt truth” 단계일 때만 completion 실패의 권위 있는 신호로 읽어야 한다. 현재 관측 JSON에는 `attemptStarted === false`, `baselineFrozen === false`인 프레임에서도 동일 필드가 채워져, JSON만 보면 completion 실패로 오해할 수 있다.

이 PR은 **판정 산식·`completionBlockedReason` 문자열·threshold·pass 로직을 변경하지 않고**, 관측·번들 export에 **해석용 메타**만 추가한다.

## Scope

- `src/lib/camera/camera-trace.ts`: `SquatAttemptObservation` 확장, `computeObservationTruthFields`, `buildSquatAttemptObservation`에서 필드 채움
- `src/lib/camera/camera-trace-bundle.ts`: `CaptureSessionBundleSummary` 확장, `buildCaptureSessionBundle` summary에 동일 필드 병합

## Non-goals

- `squat-completion-state.ts`, `auto-progression.ts`, `pose-features.ts`, `squat-event-cycle.ts`, `squat-reversal-confirmation.ts` 수정 없음
- `completionBlockedReason` 값 변경·null 덮어쓰기 금지
- `completionPassReason` / pass owner 필드 변경 없음
- success snapshot writer 변경 없음

## Truth rules (구현 그대로)

**`observationTruthStage`**

1. `eventType === 'capture_session_terminal'` → `terminal_truth` (다음 규칙보다 우선)
2. `!attemptStarted` → `pre_attempt_hint`
3. `attemptStarted && !baselineFrozen` → `pre_attempt_hint`
4. `attemptStarted && baselineFrozen` → `attempt_truth`

**`completionBlockedReasonAuthoritative`**

- `attemptStarted === true && baselineFrozen === true` 일 때만 `true`

## Files changed

- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- `scripts/camera-cam-obs-truth-stage-01-smoke.mjs`
- `docs/pr/PR-CAM-OBS-TRUTH-STAGE-01.md`

## Acceptance tests

- `npx tsx scripts/camera-cam-obs-truth-stage-01-smoke.mjs` — pre-attempt / attempt / terminal / 번들 summary
- 기존 관측·번들 smoke 회귀 권장: `camera-cam-obs-flush-harden-01-smoke.mjs`, `camera-cam-snapshot-bundle-01-smoke.mjs`

## Rollback

`computeObservationTruthFields` 호출 및 인터페이스 필드 제거 시 이전 JSON 형태로 복귀(신규 필드만 사라짐).

## Why this is safe

blocked reason 원천 값과 completion 평가 경로는 그대로이며, 소비자가 “언제 권위 있는지”만 명시적으로 구분할 수 있게 한다.
