# PR-CAM-SHALLOW-CLOSURE-PROOF-NORMALIZE-06

## 문제

**CURRENT_IMPLEMENTED (PR-4/PR-5 이후):** shallow 입장·하강·trajectory rescue·이벤트 사이클 reversal/recovery/nearStanding·`completionMachinePhase === 'recovered'` 까지 올라와도,

- `officialShallowPrimaryDropClosureFallback` / stream closure 번들 / 권위 역전 축이 비어 있으면
- `officialShallowClosureProofSatisfied` 가 false 로 남고
- PR-4 `getShallowAuthoritativeClosureDecision` 의 `explicitClosureProof` 가 켜지지 않아
- `completionBlockedReason === 'no_reversal'` 에 고정되는 케이스가 있다.

## 방향 (전역 승격 아님)

- trajectory provenance 를 **전역 권위**로 올리지 않는다.
- **통제된** shallow+trajectory+이벤트 사이클+복구+post-peak drop 증거가 모두 맞을 때만,
  `officialShallowPrimaryDropClosureFallback` (및 이에 따른 `officialShallowClosureProofSatisfied`) 를 **합성**한다.
- 그 다음 **기존 PR-4 authoritative shallow closure** 가 자연스럽게 `official_shallow_cycle` 로 닫히게 한다 (세 번째 pass reason 발명 없음).
- PR-5 `mergeShallowTrajectoryAuthoritativeBridge` 는 그대로 두되, PR-6 으로 이미 닫히면 satisfied 경로는 관측만 정리된다.

## 구현 요약

- `guardedTrajectoryShallowSignalBlockReason` + `getGuardedShallowClosureProofFromTrajectoryBridge` 로 자격만 판정.
- 자격이 있고 기존 native closure proof 가 없으면 `evaluateSquatCompletionCore` 를 `guardedShallowTrajectoryClosureProofApply: true` 로 **한 번 더** 호출해 코어 내부에서 `officialShallowPrimaryDropClosureFallback = true` 를 OR.
- `officialShallowClosureProofSatisfied` 반환 시 **`officialShallowPrimaryDropClosureFallback === true` 도 OR** (누락 버그 보정).
- `officialShallowReversalSatisfied` 는 apply 플래그 시 true (관측·closure 축 정렬; `ownerAuthoritativeReversalSatisfied` 는 비터치).
- PR-05 브리지 판정은 동일 가드를 `guardedTrajectoryShallowSignalBlockReason` 로 공유; PR-06 에서 `not_armed`·`no_committed_peak_anchor`(`peakAnchorTruth`) 를 더 엄격히 막음.

## 관측 필드

- `guardedShallowTrajectoryClosureProofSatisfied`
- `guardedShallowTrajectoryClosureProofBlockedReason`

## 비목표

- `squat-event-cycle.ts` / `squat-reversal-confirmation.ts` / `squat-progression-contract.ts` 변경
- 딥 `standard_cycle` 임계 변경
- 이벤트 승격 소유권 복구
