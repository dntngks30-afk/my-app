# PR-CAM-29A — Squat Final Pass Timing Hardening

## CURRENT_IMPLEMENTED

- `minimumCycleDurationSatisfied`는 기존 `SQUAT_ARMING_MS`(1500ms)와 `squatCompletionState.cycleDurationMs`로 이미 계산되었다.
- `evaluateExerciseAutoProgress`의 squat `progressionPassed`와 `isFinalPassLatched('squat', …)`에 동일 조건 `squatMinimumCycleOkForFinalPass`를 연결했다.
- `finalPassBlockedReason` / `squatCycleDebug.finalPassTimingBlockedReason`으로 `minimum_cycle_duration_not_met`를 auto-progression 레이어에서만 노출한다.
- `finalPassEligible === progressionPassed`로 디버그 모순을 막는다.

## NOT_YET_IMPLEMENTED / 외부

- `scripts/camera-cam26-shallow-admission-and-standing-hardening-smoke.mjs` 등 **짧은 stepMs·짧은 cycleDurationMs** fixture는 본 PR 허용 수정 범위 밖이며, CAM-29A 적용 후 `status: pass` 기대는 타임스탬프/하단 홀드 보강이 필요할 수 있다.
- `camera-pr-04e3b` A4(`not_confirmed`)·`camera-cam30` E 등 일부 스모크는 **CAM-29A stash 후에도 동일 실패**하는 항목이 있어 본 PR 회귀로 단정하지 않는다.

## 검증

```bash
npx tsx scripts/camera-cam29a-squat-final-pass-timing-smoke.mjs
npx tsx scripts/camera-cam29a-squat-no-mid-ascent-open-smoke.mjs
```

회귀(요청 목록): `camera-pr-04e3a`, `camera-pr-04e2`, `camera-pr-arming-baseline-handoff-01`, `camera-pr-retro-arming-assist-01`, `camera-ultra-low-rom-event-gate-01`, `camera-pr-core-pass-reason-align-01`, `camera-shallow-squat-finalize-band-01`, `camera-pr-04d1`, `camera-pr-04e1`, `camera-cam25` — 실행 시 exit 0 확인.
