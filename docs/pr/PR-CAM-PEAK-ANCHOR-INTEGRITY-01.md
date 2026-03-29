# PR-CAM-PEAK-ANCHOR-INTEGRITY-01 — Squat reversal anchor integrity (commitment-safe peak)

## Findings from latest JSON

- `reversalAtMs < committedAtMs` — 역전 시각이 commitment 이전으로 기록됨 (앵커 불일치).
- `peakLatchedAtIndex = 0` — 관측용 피크 래치가 초기 인덱스에 고정된 채 진행.
- `perStepSummary.ascent.frameCount = 0` 인데 `completionPassReason === "standard_cycle"` 및 success — 상승 구간 관측과 통과 사유가 어긋남.
- 원인 요약: `evaluateSquatCompletionCore()`에서 `peakFrame`이 **전체** `depthFrames`의 최대 depth이고, `revConf.reversalConfirmed === true`이면 `reversalFrame`을 **그 `peakFrame`으로 즉시 승격**했다. commitment 이후에 “역전 앵커가 유효한지”를 검증하지 않아, **commitment 이전의 전역 피크**가 progression용 reversal 앵커가 될 수 있었다.

## Why the issue is anchor integrity, not raw depth threshold

- 역전 **탐지**(`detectSquatReversalConfirmation`)와 drop 임계·primary 기하는 변경하지 않았다.
- 문제는 “역전이 감지됐다”는 신호에 **어떤 시각/인덱스를 reversal 앵커로 붙일지**였다. 전역 `peakFrame`은 디버그/관측용 최대 depth와 progression 앵커를 동일하게 취급하면, commitment 이후 궤적과 **시간 순서가 맞지 않는** 앵커가 될 수 있다.

## Current main behavior (before this PR)

- `reversalFrame = peakFrame` 조건: `committedFrame != null && revConf.reversalConfirmed` (및 HMM assist·trajectory rescue에서도 `peakFrame` 승격).
- commitment 이후에도 `peakFrame.timestampMs < committedFrame.timestampMs`인 경우가 허용되어, `reversalAtMs < committedAtMs`가 발생할 수 있었다.

## Scope

- **오직** `squat-completion-state.ts` 내부에서:
  - `findCommittedOrPostCommitPeakFrame` — commitment 인덱스 **이후(포함)** 서브셋에서만 최대 depth 프레임 선택.
  - `hasValidCommittedPeakAnchor` — 위 프레임이 commitment와 인덱스·시각상 일관된지 게이트.
  - `reversalFrame` — `revConf.reversalConfirmed`는 그대로 두고, 앵커만 `committedOrPostCommitPeakFrame`으로 제한.
  - HMM reversal assist·`getGuardedTrajectoryReversalRescue`는 **동일한 commitment-safe 앵커**를 쓰도록 정렬 (전역 `peakFrame` 승격 제거).
- **변경하지 않음**: `peakAtMs`, `peakLatchedAtIndex`, `rawDepthPeak`, `relativeDepthPeak`, `completionPassReason` 계산 규칙, pass owner, finalize hold/min, event-cycle, 임계값, `ascendConfirmed` 강제 조작.

## Non-goals

- `squat-reversal-confirmation.ts`, `auto-progression.ts`, `squat-event-cycle.ts`, `squat-completion-arming.ts`, `evaluators/squat.ts`, `pose-features.ts` 수정 없음.
- threshold / `STANDARD_OWNER_FLOOR` / `LOW_ROM_*` / `STANDARD_LABEL_FLOOR` 변경 없음.
- descent/reversal **디텍터** 완화·강화 없음.

## Files changed

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-peak-anchor-integrity-01-smoke.mjs`
- `docs/pr/PR-CAM-PEAK-ANCHOR-INTEGRITY-01.md`

## Acceptance tests

- **A.** Pre-commit 전역 피크 + 이후 commitment 시나리오: `reversalAtMs`가 `committedAtMs`보다 이전이면 안 됨 (또는 progression reversal 미설정).
- **B.** 얕은 의미 있는 하강·상승·복귀: completion 유지, 앵커 시각 일관성.
- **C.** 서 있기만 함 / commitment 없음: `completionSatisfied === false`.
- **D.** 깊은 정상 스쿼트 (`relativeDepthPeak >= STANDARD_OWNER_FLOOR`): `completionPassReason === 'standard_cycle'` 유지.
- **E.** 얕은 low-ROM 궤적: rule 또는 event 경로가 **완전히 막히지** 않음.
- **F.** 금지 엔진 파일 diff 0.

## Why this avoids prior regressions

- 통과 **이유**·owner·finalize·이벤트 승격 조건은 그대로이므로, 깊은 `standard_cycle`과 얕은 event/low-ROM 경로의 정책 분기를 바꾸지 않는다.
- 바뀌는 것은 progression에 쓰이는 **reversal 시각 앵커**뿐이라, “앉는 도중 전역 피크만으로 역전이 열리는” false positive만 제거하는 데 국소화된다.
- `committedFrame == null`이면 helper가 `undefined`를 반환하므로 서 있는 상태에서 reversal 앵커가 열리지 않는 기존 방어가 유지된다.
