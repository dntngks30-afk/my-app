# PR-HMM-03A — Squat calibration observability

## 왜 지금은 threshold 변경이 아니라 observability 강화인가

실기기 shallow attempt에서 **pass/completion 의미**와 **HMM assist 정책**은 이미 고정되어 있다. 잘못된 threshold 튜닝은 회귀를 키우기 쉽다. 따라서 이 PR은 **동일한 truth·정책** 아래에서, assist 전/후·finalize·HMM evidence를 **한 번에 읽을 수 있는 계층**만 추가한다. 다음 PR에서 실제 threshold calibration을 할 때 **근거 있는 비교**가 가능해진다.

## assist 전/후 blocked reason을 분리 저장하는 이유

- **ruleCompletionBlockedReason**: assist를 적용하기 **전**, 순수 rule 기반 completion이 막힌 이유.
- **postAssistCompletionBlockedReason** / **completionBlockedReason**(최종): assist 적용 여부를 반영한 **최종** blocked reason.

같은 문자열이 될 수 있어도, calibration에서는 “원래 rule이 뭐였고, assist 후에 뭐로 바뀌었는지”를 분리해야 shallow 성공/실패를 비교할 수 있다.

## assistSuppressedByFinalize의 의미

HMM이 strong assist evidence를 만족하고, assist 대상 rule block(예: `no_descend` 계열)이었더라도, **recovery / guarded standing finalize** 계열에서 다시 막히면 assist는 적용되지 않거나 최종적으로 여전히 실패로 남는다. 이 경우 **assist eligibility는 있었으나 finalize 쪽이 최종 게이트**였음을 `assistSuppressedByFinalize === true`로 표시한다. (정책/threshold 변경 없음, 관측용 플래그.)

## 실기기 shallow calibration 때 볼 필드

| 영역 | 필드 / 위치 |
|------|-------------|
| Rule vs 최종 | `ruleCompletionBlockedReason`, `completionBlockedReason` / `postAssistCompletionBlockedReason` |
| Assist | `hmmAssistEligible`, `hmmAssistApplied`, `hmmAssistReason` |
| Finalize | `standingRecoveryFinalizeReason`, `standingRecoveryBand`, `assistSuppressedByFinalize` |
| HMM | `debug.squatHmm`, `debug.squatCalibration`의 `hmmConfidence`, `hmmExcursion`, `hmmTransitionCount`, `hmmDominantStateCounts` |
| Trace / compact | `camera-trace` `diagnosisSummary.squatCycle.calib` (short keys: `rb`, `fb`, `ae`, `aa`, …) |
| 진단 스냅샷 | `squatCalibrationCompact` on success / failed shallow snapshots |

## 다음 PR에서 threshold calibration을 어떻게 할지 (권장)

1. 동일 기기·동일 shallow fixture로 **ruleBlocked → finalBlocked** 전이 로그를 모은다.
2. `assistSuppressedByFinalize`가 true인 비율과 `finalizeReason`/`finalizeBand`를 묶어 본다.
3. HMM 쪽은 `hmmExcursion`, `transitionCount`, dominant counts와 **assistEligible**의 관계를 본 뒤, **정책 모듈**에서만 threshold를 조정한다 (이 PR 범위 아님).
4. 회귀: `camera-pr-hmm-02b`, `01b`, `cam27`, `03a` smoke 유지.

## Acceptance (이 PR)

- 기존 smoke 3종 + `camera-pr-hmm-03a-squat-calibration-trace-smoke.mjs` 통과.
- `completionSatisfied` / `completionPassReason` / `completionBlockedReason` **최종 semantics** 불변.
- 추가 필드는 **additive / optional**.
- squat `page.tsx` production UX·voice·auto-advance 불변 (dev 패널에 calibration 블록만 추가).
