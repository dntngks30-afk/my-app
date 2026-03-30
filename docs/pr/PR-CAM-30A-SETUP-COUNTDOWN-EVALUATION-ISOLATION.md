# PR-CAM-30A — Setup / Countdown Evaluation Isolation for Squat

## Status

**CURRENT_IMPLEMENTED** — `src/app/movement-test/camera/squat/page.tsx` 런타임 격리

---

## 1. Findings

### setup 에서 capture 가 시작되던 것이 문제였던 이유

`handleVideoReady` 가 `start(video)` 를 호출하면 `usePoseCapture` 가 즉시 샘플 카운터·duration 을 켜고, `CameraPreview` 의 `onPoseFrame` 이 `pushFrame` 으로 landmark 를 쌓았다. 사용자가 「준비됐어요」·카운트다운을 거치기 전에도 evaluator 입력이 살아 있어, setup 구간에서 이미 `gate` / `finalPassLatched` 가 움직일 수 있었다.

### pass latch effect 가 capturing 가드 없이 위험했던 이유

`effectivePassLatched` 만 보는 effect 가 `latchPassEvent()` 를 호출할 수 있었고, `cameraPhase` 와 무관했다. `readinessState === not_ready` 이고 countdown 클립이 재생 중이어도, landmark 가 쌓여 `isFinalPassLatched` 가 true 가 되면 pass latch·navigation 이 열릴 수 있는 구조적 모순이 있었다.

---

## 2. Files Changed

| 파일 | 내용 |
|------|------|
| `src/app/movement-test/camera/squat/page.tsx` | `handleVideoReady` 에서 `start(video)` 제거. `pushFrameDuringCapturingOnly` 로 `cameraPhase === 'capturing'` 일 때만 pose 누적. `gate` useMemo 는 capturing 전 `[]` + `SQUAT_PAGE_IDLE_CAPTURE_STATS` 로 평가. `liveReadinessSummary.success` / `effectiveProgressionState` / success cue / pass latch effect / `latchPassEvent` / ambiguous second-chance effect 에 capturing 가드. unmount terminal bundle 은 `squatCaptureSessionEnteredRef` 로 capturing 진입 세션만. export: `squatPageExerciseEvaluationActive`, `SQUAT_PAGE_IDLE_CAPTURE_STATS` |
| `scripts/camera-cam30a-no-pass-before-capturing-smoke.mjs` | phase 정책 스모크 |
| `scripts/camera-cam30a-countdown-isolation-smoke.mjs` | evaluator pass vs 페이지 정책 분리 스모크 |
| `docs/pr/PR-CAM-30A-SETUP-COUNTDOWN-EVALUATION-ISOLATION.md` | 본 문서 |

**미수정 (요구사항):** `auto-progression.ts`, `squat-completion-state.ts`, `squat-reversal-confirmation.ts`, `squat-event-cycle.ts`, `squat-depth-signal.ts`, `use-pose-capture.ts` (public API 변경 없음)

---

## 3. Regression Guards

### capturing 이후 정상 pass 가 유지되는 이유

카운트다운 종료 시 기존과 같이 `setCameraPhase('capturing')` 직후 `start(videoRef.current)` 호출. `squatPageExerciseEvaluationActive('capturing') === true` 가 되어 `landmarks`·`stats` 로 `evaluateExerciseAutoProgress` 가 동작하고, `pushFrame` 이 다시 유입된다. pass latch effect·`latchPassEvent` 는 `cameraPhase === 'capturing'` 일 때만 동작한다.

### countdown 중 pass 가 막히는 이유

- pose: `pushFrameDuringCapturingOnly` 가 countdown 에서 no-op  
- gate: 빈 landmark + idle stats 로만 계산 → pass 로 열리지 않음  
- latch: `latchPassEvent` 및 관련 effect 가 capturing 전 return

---

## 4. Tests Run

```bash
npx tsx scripts/camera-cam30a-no-pass-before-capturing-smoke.mjs
npx tsx scripts/camera-cam30a-countdown-isolation-smoke.mjs
npx tsx scripts/camera-cam29a-squat-final-pass-timing-smoke.mjs
npx tsx scripts/camera-cam29a-squat-no-mid-ascent-open-smoke.mjs
npx tsx scripts/camera-pr-core-pass-reason-align-01-smoke.mjs
npx tsx scripts/camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs
npx tsx scripts/camera-pr-04e3a-squat-relative-depth-truth-align-smoke.mjs
npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs
```

위 스크립트 **전부 PASS**.

---

## 5. Residual

- **첫 capturing 프레임 직전**: 한 틱 동안 `gate` 가 빈 입력으로 계산될 수 있으나, 곧 프레임 유입으로 정상 평가로 수렴한다.  
- **실기기**: preview·MediaPipe 지연과 함께 dogfooding 권장.
