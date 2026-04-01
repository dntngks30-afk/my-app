# PR-CAM-SHALLOW-TRAJECTORY-BRIDGE-05

## 왜 PR-4 이후에도 실패가 남았는가

- **CURRENT_IMPLEMENTED:** PR-4는 공식 shallow 입장·번들·권위 역전 축으로 `official_shallow_cycle`을 연다.
- **남은 갭:** 실기기에서 shallow 입장·하강·commitment는 맞는데, 역전 앵커는 **늦게** trajectory rescue 쪽에서만 잠기고, `ownerAuthoritativeReversalSatisfied` / closure 번들이 비어 `no_reversal`에 머무는 케이스.
- 이때 `trajectoryReversalRescueApplied`, 이벤트 사이클의 `reversalDetected`·`recoveryDetected`·`nearStandingRecovered` 등은 관측되지만 **권위 completion**은 닫히지 않았다.

## PR-5가 하는 일 (단 한 가지)

**통제된 trajectory-assisted shallow 권위 브리지** 한 줄기만 추가한다.

- trajectory **단독** 권위화가 아니다.
- provenance를 **전역**으로 승격하지 않는다.
- 이벤트 승격(`eventCyclePromoted`) 소유권을 복구하지 않는다.

조건을 **전부** 만족할 때만 `completionPassReason = 'official_shallow_cycle'`, `shallowAuthoritativeClosureReason = 'trajectory_guarded_official_shallow_cycle'`, `completionFinalizeMode = 'official_shallow_finalized'` 로 닫는다.

## 브리지 입장·차단 (요약)

- **입장:** 공식 shallow 후보·입장, 시도·하강·downward commitment, `peakLatched`·`peakLatchedAtIndex > 0`, shallow owner 대역.
- **오염 차단:** `setupMotionBlocked`, `eventCyclePromoted`, idle 위상, `not_armed`+무시도/무하강, `peak_anchor_at_series_start`, `series_too_short`, 바닥 정지 의심 위상 등.
- **증거 묶음:** `trajectoryReversalRescueApplied` + `reversalEvidenceProvenance === 'trajectory_anchor_rescue'` + 이벤트 사이클 역전·복구·near-standing + `completionMachinePhase === 'recovered'` + standing 복귀·finalize·continuity/drop 증명 + 최소 post-peak return(0.88×요구).

## 명시적 `shallowTrajectoryBridgeBlockedReason`

예: `setup_motion_blocked`, `series_too_short`, `peak_anchor_at_series_start`, `no_recovery_pattern`, `no_guarded_bridge_evidence`, `no_trajectory_reversal_rescue` 등.

## 여전히 금지되는 false-pass

- 서서만 있음, 하강만, 바닥 정지, 앉은 채 유지
- 시리즈 너무 짧음, 시리즈 시작 피크 오염
- shallow 입장·복구 체인 없이 trajectory-only
- 늦은 setup 오염(옵션으로 전달된 `setupMotionBlocked`가 true면 브리지 비통과)

## 연동

- `evaluateSquatCompletionState`에서 이벤트 사이클 부착 직후 브리지 병합.
- `evaluators/squat.ts`: `setupMotionBlocked`를 옵션으로 전달; PR-03과 동일하게 **닫힌 사이클**인데 늦은 setup 만 걸리는 경우 trajectory 브리지 성공 시에도 completion이 깨지지 않도록 bypass 조건에 `shallowTrajectoryBridgeSatisfied` 추가.
- `auto-progression`: `SquatCycleDebug`에 브리지 관측 필드 전달.

## 비목표

- `squat-event-cycle.ts` / `squat-progression-contract.ts` 변경
- 딥 `standard_cycle` 임계·경로 변경
- PR-2 권위 역전 분할 전역 완화
