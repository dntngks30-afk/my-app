# PR-CAM-31 — Squat guarded trajectory reversal rescue

## 왜 threshold PR이 아닌가

실기기에서 얕은/블렌드 보조 rep는 **깊이·커밋·스탠딩 복귀·finalize**까지 도달해도, 명시 **primary 역전(rule reversal)** 이 한 프레임이라도 빠지면 `no_reversal`로 끊길 수 있다. 본 PR은 임계·홀드·owner 플로어·라우팅을 바꾸지 않고, **이미 finalize·복귀 증거가 잠긴 경우에만** 피크를 역전 앵커로 승격하는 **구조적 truth rescue**다.

## 구조 보조 계약 (정확히)

- `getGuardedTrajectoryReversalRescue`는 파일 내 기존 값만 사용한다: `reversalFrame`, `committedFrame`, `attemptStarted`, `downwardCommitmentReached`, `standingRecoveryFinalizeReason`, `recovery`, `peakFrame`.
- **기존 `reversalFrame != null`이면** 반환은 그대로이며 합성 없음.
- **그렇지 않을 때만** 다음을 **모두** 만족하면 `peakFrame`을 역전으로 승격하고 `trajectoryReversalConfirmedBy === "trajectory"`:
  - `committedFrame != null`, `attemptStarted`, `downwardCommitmentReached`
  - `standingRecoveryFinalizeReason` ∈ `standing_hold_met` | `low_rom_guarded_finalize` | `ultra_low_rom_guarded_finalize`
  - `recoveryMeetsLowRomStyleFinalizeProof(recovery) === true`
- 진행 truth만 `progressionReversalFrame` / `ascendForProgression` / 재계산된 `ruleCompletionBlockedReason`에 반영한다.
- `reversalDepthDrop` / `reversalFrameCount` 등 **raw rule·HMM 역전 관측**은 기존 산식 그대로 둔다.

## 의도적으로 바꾸지 않은 것

- `auto-progression`, arming, squat 페이지, `components/camera`, `lib/motion`, trace/diagnostic.
- confidence·래치·스탠딩 홀드 ms·tolerance·owner 상수·primary/blended 라우팅·`completionPassReason` 문자열.
- `detectSquatReversalConfirmation` 및 초기 `reversalFrame` 산출 식.

## 다섯 가지 수락 테스트 (스모크)

`scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs`:

1. **A** — CAM-27 얕은 사이클 + 하지 가시성 저하(피크 직후 구간): depth/admission 유지, gate pass, `completionTruthPassed`, `standing_recovered`, 최종 `no_reversal` 아님, 역전은 `trajectory` 또는 기존 rule.
2. **B** — shallow보다 약간 깊은 저ROM + 바닥 근처 제한적 가시성 저하: pass, blocked null, `standard_cycle` 아님.
3. **C** — CAM-29급 깊은 사이클(무 degrade): `standard_cycle` 유지, `reversalConfirmedBy !== 'trajectory'`(명시 역전 경로).
4. **D** — CAM-27 스탠딩 노이즈: truth pass 아님, gate pass 아님.
5. **E** — 하강만/복귀 없음: pass 아님, trajectory 오탐 없음.

검증 명령:

- `npx tsx scripts/camera-cam31-squat-guarded-trajectory-reversal-smoke.mjs`
- `npx tsx scripts/camera-cam27-shallow-depth-truth-smoke.mjs`
- `npx tsx scripts/camera-cam28-shallow-completion-slice-smoke.mjs`
- `npx tsx scripts/camera-cam25-squat-easy-final-pass-smoke.mjs`
