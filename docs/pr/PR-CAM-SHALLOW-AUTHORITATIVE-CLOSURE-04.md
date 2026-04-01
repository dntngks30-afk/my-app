# PR-CAM-SHALLOW-AUTHORITATIVE-CLOSURE-04

## 왜 이 PR이 필요한가

- **CURRENT_IMPLEMENTED (PR-3 이후):** 깊은 유효 스쿼트는 `standard_cycle` 등 기존 권위 경로로 정상 종료된다.
- **남은 갭:** 실기기에서 **얕은 ROM** 유효 사이클은 여전히 `completionBlockedReason`이 `no_reversal` / `not_armed` 류로 막히거나, 권위 completion이 열리지 않는 경우가 있다.
- **LOCKED_DIRECTION:** provenance(trajectory / tail / ultra rescue)나 이벤트 승격이 **성공 소유권**을 갖지 않는다는 원칙은 유지한다.

이 PR은 **첫 번째로** “얕은 스쿼트가 권위 있게 통과할 수 있는” 경로를 추가하되, **통제된 shallow 권위 종료 계약**으로만 연다.

## 무엇을 바꿨는가

- `squat-completion-state.ts`에 `getShallowAuthoritativeClosureDecision`을 두어, 다음을 **모두** 만족할 때만:
  - 공식 shallow 입장(`officialShallowPathCandidate` + `officialShallowPathAdmitted`)
  - 실제 시도·하강(`attemptStarted`, `descendConfirmed`, commitment)
  - shallow owner 대역(`relativeDepthPeak < STANDARD_OWNER_FLOOR`), 표준 깊이 `standard_cycle` 도둑질 없음
  - 시리즈 시작 피크 오염(`peakLatchedAtIndex === 0`) 배제
  - **권위 역전:** `ownerAuthoritativeReversalSatisfied` 또는 `officialShallowAscentEquivalentSatisfied`, 또는 (기존 임계의) **closure 번들 + 0.88×역전 drop**
  - provenance-only 역전 단독·trajectory 라벨 + closure 증거 없음 차단
  - **권위 복구:** `ownerAuthoritativeRecoverySatisfied` 또는 (shallow/low-ROM finalize 밴드 + guarded finalize 사유 + continuity/drop 증명)
  - **closure 증거:** 권위 역전 또는 stream bridge 또는 explicit closure 번들/primary 폴백
- 충족 시에만:
  - `completionPassReason = 'official_shallow_cycle'`
  - `completionSatisfied = true`, `completionBlockedReason = null`
  - `completionFinalizeMode = 'official_shallow_finalized'`
  - 관측 필드: `ownerAuthoritativeShallowClosureSatisfied`, `shallowAuthoritativeClosureReason`, `shallowAuthoritativeClosureBlockedReason`

## provenance는 여전히 권위가 아니다

- `trajectoryReversalRescueApplied`, `reversalTailBackfillApplied`, `provenanceReversalEvidencePresent`만으로는 shallow 권위 종료를 **열 수 없다**.
- 진단·출처 추적용으로만 남으며, PR-2의 `ownerAuthoritativeReversalSatisfied` 엄격 축을 **약화하지 않는다** (별도 계약으로 additive).

## 명시적으로 계속 막는 false-pass

- 서서 정지(무하강·무 commitment)
- 하강만/하강 정지(역전·closure 없음)
- 앉은 채·정적 크라우치·미세 바운스만
- trajectory-only + 공식 shallow closure 증거 없음
- 시리즈 시작 피크 오염

## 연동

- `auto-progression.ts`: `official_shallow_cycle`을 shallow/easy latch 분기(`isSquatShallowRomPassReason`)에 포함, `completionPathUsed`는 `low_rom`으로 매핑(UX 일관), `SquatCycleDebug`에 관측 필드 전달.
- `squat-progression-contract.ts`: lineage를 `completion_truth_event`에 포함.

## 비목표

- 이벤트 승격으로 성공 소유권 복구
- 딥 `standard_cycle` 임계·게이트 변경
- `squat-event-cycle.ts` / `squat-progression-contract.ts`(실행 코어) 대규모 리팩터
