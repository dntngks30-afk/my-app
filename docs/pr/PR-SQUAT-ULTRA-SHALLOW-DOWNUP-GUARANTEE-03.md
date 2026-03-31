# PR-SQUAT-ULTRA-SHALLOW-DOWNUP-GUARANTEE-03

## 목적

실기기 증상 클래스(relativeDepthPeak ~0.06, shallow admission 열림, `no_reversal` 등)에서 **유의미한 하강→상승→복귀**가 있으면 `ultra_low_rom_cycle` 등 shallow completion truth로 닫히고, **gate pass / final latch**까지 도달하도록 completion-state를 보강한다.

## CURRENT_IMPLEMENTED (이 PR)

- `getGuardedTrajectoryReversalRescue`: `low_rom_guarded_finalize` / `ultra_low_rom_guarded_finalize`일 때 `recoveryMeetsLowRomStyleFinalizeProof` 이중 요구 제거(해당 finalize에서 이미 동일 증거 통과).
- `shouldApplyUltraShallowMeaningfulDownUpRescue`: 공식 shallow closure 번들이 아직 없고(`shallowClosureProofBundleFromStream === false`), strict/HMM 역전 없음, ultra-low 밴드에서 finalize+primary 되돌림(0.88×요구)이 성립하면 progression 앵커를 `committedOrPostCommitPeakFrame`에 연결.
- assist provenance: `ultra_shallow_meaningful_down_up_rescue` / `reversalEvidenceProvenance` 동일 문자열.
- 스모크: `scripts/camera-squat-ultra-shallow-pass-guarantee-01-smoke.mjs` (landmark 파이프라인 → `evaluateExerciseAutoProgress` pass + `isFinalPassLatched`).

## LOCKED_DIRECTION

- depth는 quality, completion은 이벤트(하강·상승·복귀) 기반.
- shallow 성공은 `standard_cycle`로 위장하지 않음.

## NOT_YET_IMPLEMENTED

- 원본 landmark JSON 리플레이(본 PR은 synthetic symptom fixture만).

## 회귀

`REGRESSION_MATRIX.md`에 있는 squat 관련 스모크 + 본 PR 스모크 실행.
