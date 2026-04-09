This PR follows docs/REFACTORING_SSOT_2026_04.md and is limited to behavior-preserving extraction unless explicitly stated otherwise.

PR-RF-02 — SQUAT UI GATE ISOLATION
1. Scope

이 PR의 범위는 src/lib/camera/auto-progression.ts 안에 있는 squat UI progression gate 계산 경계를 구조적으로 더 명확하게 분리하는 것에 한정된다.

구체적으로 RF-02는 아래 두 층만 다룬다.

computeSquatUiProgressionLatchGate(...) 자체의 물리적 분리
그 함수에 들어가는 순수 UI gate 입력 조립 구간의 최소 경계 분리

이 PR은 부모 SSOT가 잠근 auto-progression.ts 리팩토링 순서 중 A2. Squat UI gate isolation에 해당한다.

현재 repo 기준으로 RF-02의 핵심 대상은 다음이다.

computeSquatUiProgressionLatchGate(...)
evaluateExerciseAutoProgress(...) 내부의 squat Step C 구간
isFinalPassLatched(...) 내부 squat fallback 구간에서 같은 gate helper를 재사용하는 부분

RF-02의 목적은 “UI gate 계산”이 어디서 시작되고 끝나는지를 파일/함수 경계로 드러내는 것이지, pass truth를 새로 정의하거나 pass 체인을 재설계하는 것이 아니다.

2. Non-goals

이번 PR에서 하지 않는 것:

completion owner truth 계산 로직 변경
computeSquatCompletionOwnerTruth(...)의 의미 변경
primary squat owner truth source 변경
finalPassEligible / finalPassBlockedReason 산식 변경
shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...) 분리
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...) 분리
stampSquatFinalPassTimingBlockedReason(...) 분리
SquatCycleDebug 조립/스탬핑 builder 분리
setup/readiness/debug 관측 로직의 의미 변경
threshold / comparison operator / blocked reason 문자열 변경
evaluateExerciseAutoProgress(...)의 branch ordering 변경
overhead / wall-angel / balance 경로 리팩토링
RF-03 이상의 final-pass blocker isolation 선반영
RF-04 이상의 debug / observability builder isolation 선반영

즉 RF-02는 squat UI gate isolation only다.

3. Locked truth outputs

이 PR은 아래 truth output을 절대 바꾸면 안 된다.

Locked camera truth outputs
completionSatisfied
completionPassReason
completionBlockedReason
finalPassEligible
finalPassBlockedReason
passOwner
finalSuccessOwner
uiProgressionAllowed
uiProgressionBlockedReason
passConfirmationSatisfied
captureQuality

부모 SSOT가 잠근 camera invariant를 그대로 따른다.

Locked RF-02-specific outputs

RF-02에서 특히 잠가야 하는 것:

RF-02는 squat UI gate isolation only
completion owner truth는 현재 source를 그대로 사용
computeSquatUiProgressionLatchGate(...)의 의미 유지
uiProgressionAllowed / uiProgressionBlockedReason 의미 유지
finalPassBlockedReason semantics 유지
squat UI gate 입력 조립 순서 유지
setup-motion / readiness-stable-dwell / integrity / hard-blocker / confidence / passConfirmation 의미 유지
Locked blocked reason strings

다음 문자열은 그대로 유지해야 한다.

completion_owner_not_satisfied
live_readiness_not_ready
readiness_stable_dwell_not_met
setup_motion_blocked
minimum_cycle_duration_not_met
guardrail_not_complete
capture_quality_invalid
pass_confirmation_not_ready
pass_confirmation_frames_not_met
hard_blocker:${blocker}
confidence_too_low:${confidence.toFixed(2)}<${passThresholdEffective.toFixed(2)}

또한 squatIntegrityBlockForPass가 string일 때 그 문자열은 가공 없이 그대로 uiProgressionBlockedReason으로 흘러야 한다.

4. Current code findings
4.1 Parent SSOT alignment

부모 SSOT는 auto-progression.ts를 최우선 P0 리팩토링 대상으로 잠그고 있으며, 카메라 domain에서 특히 squat은 아래 4개 층을 분리해야 한다고 명시한다.

completion owner truth
UI progression gate
final-pass UI-only blockers
observability/debug stamping

RF-02는 이 중 두 번째 층만 다루는 PR이다.

4.2 RF-01 document status

docs/pr/PR-RF-01-AUTO-PROGRESSION-PURE-HELPER-EXTRACTION.md는 현재 repo에서 확인되지 않았다.
따라서 RF-02 문서는 현 repo 구현 상태를 RF-01 이후 상태로 간주하고 설계한다.

즉 현재 기준으로는:

일부 pure helper extraction은 이미 반영되어 있음
그러나 squat gate chain은 여전히 auto-progression.ts 상위 오케스트레이션 안에 강하게 결합되어 있음
따라서 RF-02는 “새로운 개념 도입”이 아니라 “이미 있는 경계를 명확히 드러내는 분리”여야 함
4.3 Current squat gate chain inside evaluateExerciseAutoProgress(...)

현재 squat 경로는 개념적으로 아래 순서로 배치되어 있다.

Step A — completion truth read
getSquatProgressionCompletionSatisfied(...)가 completionSatisfied와 squatCycleDebug를 읽어온다.
이 단계는 evaluator output / passCore / squatCompletionState를 읽는 completion layer다.
RF-02 범위가 아니다.
Step B — owner truth materialization
현재 primary path에서는 computeSquatCompletionOwnerTruth(...)를 직접 쓰지 않고,
squatPassCore.passDetected를 owner truth source로 삼는 inline object를 만든다.
즉 현재 main path의 squatOwnerTruth는 대략 아래 구조다.
completionOwnerPassed = squatPassCore?.passDetected === true
completionOwnerReason = squatCs?.completionPassReason ?? null
completionOwnerBlockedReason = squatPassCore?.passBlockedReason ?? squatCs?.completionBlockedReason ?? null
이 source는 RF-02에서 절대 바꾸면 안 된다.
Step C — UI progression latch gate
여기서 비로소 computeSquatUiProgressionLatchGate(...)가 호출된다.
입력 조립에는 아래 값이 포함된다.
completionOwnerPassed
guardrailCompletionComplete
captureQualityInvalid
confidence
passThresholdEffective
effectivePassConfirmation
passConfirmationFrameCount
framesReq
captureArmingSatisfied
squatIntegrityBlockForPass
reasons
hardBlockerReasons
liveReadinessNotReady
readinessStableDwellSatisfied
setupMotionBlocked
Step D — UI-only final-pass blockers
gate가 허용된 뒤에만 아래 blocker helper가 UI gate 결과를 덮어쓴다.
shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...)
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...)
이 단계는 RF-02가 아니라 RF-03 범위다.
Step E — observability/debug enrichment
이후 squatCycleDebug에 아래가 스탬핑된다.
completionOwnerPassed
completionOwnerReason
completionOwnerBlockedReason
uiProgressionAllowed
uiProgressionBlockedReason
liveReadinessSummaryState
readinessStableDwellSatisfied
setupMotionBlocked
setupMotionBlockReason
successSuppressedBySetupPhase
기타 quality / lineage / owner trace
이 단계는 RF-02가 아니라 observability/debug stamping 레이어다.
4.4 What is already pure, and what is still mixed

중요한 점은 현재 computeSquatUiProgressionLatchGate(...) 함수 자체는 이미 pure helper라는 것이다.

문제는 pure helper 내부가 아니라, 그 주변 경계가 아직 섞여 있다는 점이다.

현재 섞여 있는 부분은 다음이다.

owner truth materialization과 UI gate input assembly가 같은 상위 구간에 붙어 있음
setup/readiness 파생값이 Step C용 입력이면서 동시에 Step E debug stamping용 재사용 값이기도 함
UI gate 결과가 곧바로 Step D blocker overwrite와 Step E debug stamping에 이어짐
isFinalPassLatched(...)의 squat fallback path도 같은 helper를 재사용하므로 helper contract drift 위험이 있음

즉 지금 혼재는 “gate helper 내부 로직 혼재”가 아니라, gate helper 전후의 orchestration 경계 혼재다.

4.5 Current semantics of computeSquatUiProgressionLatchGate(...)

현재 이 helper의 판단 순서는 이미 잠겨 있으며, 아래 순서를 그대로 유지해야 한다.

completionOwnerPassed === false
liveReadinessNotReady === true
readinessStableDwellSatisfied === false
setupMotionBlocked === true
captureArmingSatisfied !== true
guardrailCompletionComplete !== true
captureQualityInvalid === true
confidence < passThresholdEffective
effectivePassConfirmation === false
passConfirmationFrameCount < framesReq
squatIntegrityBlockForPass != null
hardBlockerReasons ∩ reasons
else allow

이 ordering은 RF-02에서 절대 바뀌면 안 된다.

4.6 Current connection to computeSquatCompletionOwnerTruth(...)

현재 repo에서 중요한 비대칭이 하나 있다.

evaluateExerciseAutoProgress(...)의 primary squat path는 squatPassCore.passDetected 기반 inline squatOwnerTruth를 사용한다.
isFinalPassLatched(...)의 squat fallback path는 computeSquatCompletionOwnerTruth(...)를 호출해 owner truth를 재계산한다.

이 비대칭은 RF-02에서 해결 대상이 아니다.
오히려 RF-02는 이 비대칭을 그대로 문서화하고 보존해야 한다.

왜냐하면 RF-02의 목적은 gate isolation이지, owner truth unification이 아니기 때문이다.

4.7 Current assembly points for target outputs

현재 조립 위치는 아래와 같이 나뉜다.

uiProgressionAllowed / uiProgressionBlockedReason
직접 owner: computeSquatUiProgressionLatchGate(...)
이후 Step D blocker가 overwrite 가능
이후 Step E에서 squatCycleDebug에 스탬핑됨
finalPassEligible
squat에서는 최종적으로 progressionPassed
progressionPassed = squatOwnerTruth.completionOwnerPassed && squatUiGate.uiProgressionAllowed
finalPassBlockedReason
squat에서는 owner truth와 UI gate를 조합하여 최종 조립
순서:
owner false → completionOwnerBlockedReason ?? 'completion_owner_blocked'
ui gate false → uiProgressionBlockedReason ?? 'ui_progression_blocked'
else null

즉 RF-02는 ui gate의 계산 경계만 분리해야 하며, 이 최종 조립 semantics는 건드리면 안 된다.

5. Files changed

RF-02에서 실제로 건드릴 수 있는 최소 파일 집합은 아래다.

Required
src/lib/camera/auto-progression.ts
Proposed new file
src/lib/camera/squat/squat-ui-progression-latch-gate.ts
Optional but still in-scope if kept minimal
없음

RF-02는 원칙적으로 2파일만 건드리는 것이 가장 안전하다.

즉 부모 SSOT의 “one PR = one layer” 원칙상, 이번 PR은 auto-progression.ts와 new squat UI gate file 정도로 제한하는 것이 맞다.

6. Proposed extraction boundary
6.1 Minimal extraction unit actually possible in current repo

현재 repo 상태 기준으로 RF-02에서 실제로 분리 가능한 최소 단위는 다음이다.

Boundary A — pure UI gate helper file extraction

현재 auto-progression.ts에 있는 아래 helper를 전용 파일로 이동한다.

computeSquatUiProgressionLatchGate(...)

그리고 이 helper의 input shape를 명시 타입으로 함께 이동한다.

예시 파일 구조:

src/lib/camera/squat/squat-ui-progression-latch-gate.ts
export interface SquatUiProgressionLatchGateInput
export interface SquatUiProgressionLatchGateResult
export function computeSquatUiProgressionLatchGate(...)

이것이 RF-02의 최소/핵심 분리 단위다.

6.2 Allowed local section boundary inside auto-progression.ts

필요하다면 evaluateExerciseAutoProgress(...) 내부 Step C에서 아래 입력 조립용 local adapter까지는 RF-02 허용 범위다.

추천 이름:

buildSquatUiProgressionLatchGateInput(...)
또는 assembleSquatUiProgressionLatchGateInput(...)

이 adapter가 해도 되는 일은 딱 여기까지다.

squatFramesReq 결정
readinessStableDwellForGate 결정
setupMotionBlockedForGate 결정
liveReadinessNotReady 결정
최종 computeSquatUiProgressionLatchGate(...) input object 조립

이 adapter가 해서는 안 되는 일:

squatOwnerTruth 계산
Step D blocker 적용
finalPassEligible / finalPassBlockedReason 계산
squatCycleDebug 스탬핑
stampSquatFinalPassTimingBlockedReason(...) 호출
owner truth source 변환

즉 이 adapter는 “순수 UI gate 입력 조립”까지만 허용된다.

6.3 Recommended exact RF-02 boundary

RF-02에서 가장 안전한 경계는 아래다.

Keep in auto-progression.ts
Step A completion truth read
Step B owner truth materialization
Step D final-pass UI-only blockers
Step E debug/observability enrichment
final progressionPassed / finalPassBlockedReason 조립
isFinalPassLatched(...)의 squat fallback orchestration
Move / isolate
computeSquatUiProgressionLatchGate(...)
그 input/result 타입
필요 시 Step C input assembly only
6.4 Explicit RF-02 / RF-03 boundary
RF-02까지 허용
pure gate helper file 분리
gate input type 분리
gate input assembly local adapter 분리
RF-03부터 허용
shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...) 분리
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...) 분리
관련 blocked reason constant 분리
Step D 전체를 별도 file/module로 이동
6.5 Explicit RF-02 / debug-builder boundary
RF-02까지 허용
uiProgressionAllowed와 uiProgressionBlockedReason를 기존처럼 Step E에 전달하는 것
RF-04 이상
squatCycleDebug package/stamp builder 분리
stampSquatFinalPassTimingBlockedReason(...) 분리
Step E observability enrichment 전체 분리
7. Why this is behavior-preserving

RF-02는 behavior-preserving extraction으로 볼 수 있다. 이유는 아래와 같다.

7.1 UI gate owner를 새로 정의하지 않는다

RF-02는 computeSquatUiProgressionLatchGate(...)가 판단하는 조건을 바꾸지 않는다.
오직 그 helper를 더 명확한 파일/경계로 드러낼 뿐이다.

7.2 completion owner truth source를 건드리지 않는다

현재 main squat path는 squatPassCore.passDetected 기반 inline squatOwnerTruth를 사용한다.
RF-02는 이를 computeSquatCompletionOwnerTruth(...)로 치환하지 않는다.

즉 owner truth source는 그대로 유지된다.

7.3 gate ordering을 그대로 유지한다

이 helper의 핵심은 조건 자체보다도 순서다.
RF-02는 조건 순서를 재배치하지 않는다.

7.4 blocked reason 문자열을 그대로 유지한다

snapshot / debug / regression proof 상 문자열은 사실상 계약이다.
RF-02는 string formatting 포함 전부 보존해야 한다.

7.5 final pass semantics를 건드리지 않는다

RF-02는 finalPassEligible와 finalPassBlockedReason를 새로 만들지 않는다.
그 산식은 여전히 상위 orchestration에 남는다.

7.6 final-pass blocker layer를 분리하지 않는다

Step D는 현재 UI gate 계산 직후 붙는 별도 레이어다.
RF-02는 Step D를 건드리지 않기 때문에 UI gate isolation과 blocker isolation이 섞이지 않는다.

7.7 debug layer를 분리하지 않는다

Step E observability stamping을 그대로 두므로, gate helper 분리 과정에서 debug field가 runtime truth처럼 재배선될 위험을 줄인다.

7.8 isFinalPassLatched(...) fallback contract를 보존한다

현재 fallback path도 동일 helper contract를 사용한다.
RF-02는 helper의 signature/meaning을 유지해야 하므로, fallback 소비 의미도 그대로 남는다.

8. Regression proof

RF-02가 behavior-preserving이라고 주장하려면 아래 회귀 증명이 필요하다.

8.1 Mandatory pre/post compare

동일 fixture / 동일 smoke / 동일 실기기 시나리오에서 아래 값이 전부 동일해야 한다.

completionSatisfied
completionPassReason
completionBlockedReason
finalPassEligible
finalPassBlockedReason
passOwner
finalSuccessOwner
uiProgressionAllowed
uiProgressionBlockedReason
passConfirmationSatisfied
captureQuality
8.2 Gate ordering proof matrix

최소한 아래 case 각각에서 pre/post output identical compare가 필요하다.

owner false
expected: completion_owner_not_satisfied
live readiness blocked
expected: live_readiness_not_ready
readiness stable dwell blocked
expected: readiness_stable_dwell_not_met
setup motion blocked
expected: setup_motion_blocked
arming timing blocked
expected: minimum_cycle_duration_not_met
guardrail incomplete
expected: guardrail_not_complete
capture invalid
expected: capture_quality_invalid
confidence blocked
expected exact formatted confidence_too_low:...<...
pass confirmation not ready
expected: pass_confirmation_not_ready
pass confirmation frames insufficient
expected: pass_confirmation_frames_not_met
integrity block passthrough
expected exact original squatIntegrityBlockForPass string
hard blocker hit
expected exact hard_blocker:${blocker}
success
expected: uiProgressionAllowed === true, uiProgressionBlockedReason === null
8.3 Final pass chain compare

squat path에서 아래 compare가 필요하다.

progressionPassed
finalPassEligible
finalPassBlockedReason

특히 owner blocked case와 ui gate blocked case의 fallback 순서가 동일해야 한다.

8.4 Step D overwrite preservation

아래 두 blocker helper가 기존과 동일하게 gate 허용 이후에만 UI gate 결과를 overwrite하는지 검증해야 한다.

shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...)
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...)

즉 RF-02 이후에도:

completion owner truth unchanged
blocker는 UI gate result만 덮어씀
finalPassBlockedReason는 기존처럼 owner → ui gate 순서로 보임
8.5 Step E debug stamping preservation

아래 field가 pre/post identical 이어야 한다.

completionOwnerPassed
completionOwnerReason
completionOwnerBlockedReason
uiProgressionAllowed
uiProgressionBlockedReason
liveReadinessSummaryState
readinessStableDwellSatisfied
setupMotionBlocked
setupMotionBlockReason
successSuppressedBySetupPhase
8.6 isFinalPassLatched(...) fallback compatibility

isFinalPassLatched(...) squat fallback path가 동일 helper contract를 사용하므로, 아래도 비교해야 한다.

fallback path에서 uiProgressionAllowed
fallback path에서 latch boolean
same input → same output
8.7 Parent SSOT merge gates

부모 SSOT 기준 필수 검증도 유지해야 한다.

squat smoke
overhead smoke
final pass / blocked reason golden snapshot compare
setup false-pass regression compare
shallow squat regression compare
실기기 camera sanity 1회 이상
9. Residual risks
9.1 Primary path and fallback path use different owner truth sources

현재 main path는 squatPassCore.passDetected 기반이고, fallback path는 computeSquatCompletionOwnerTruth(...)를 사용한다.

RF-02는 이 비대칭을 해결하지 않으므로, 구조만 분리해도 “왜 여기선 passCore고 저기선 completionState냐”라는 이해 비용은 남는다.

하지만 이 비대칭을 해소하려는 순간 RF-02를 넘어선다.

9.2 Setup/readiness inputs are shared with debug enrichment

squatSetupTraceForGate와 squatLiveSummaryForGate는 gate 입력용이면서 Step E debug stamping에도 재사용된다.

잘못 분리하면 debug 소비값이 gate source-of-truth처럼 보이거나, 반대로 gate 계산이 debug builder에 종속될 수 있다.

9.3 Blocked reason strings are de facto contract

RF-02는 구조 변경 PR이지만, string literal 하나만 바뀌어도 regression snapshot이 깨질 수 있다.

9.4 Step D and Step E adjacency may tempt scope creep

현재 Step C 직후 Step D, Step E가 연달아 붙어 있어서, 구현 중에 “같이 빼면 더 깔끔해 보이는” 유혹이 크다.

그러나 그 순간 RF-03 / RF-04 범위가 섞인다.

9.5 Over-abstraction risk

RF-02에서 generic camera gate abstraction까지 가면 실패한다.
이번 PR은 squat-specific boundary를 더 또렷하게 드러내는 것만 허용된다.

10. Follow-up PRs
PR-RF-03 — Squat final-pass blocker isolation

대상:

shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...)
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...)
관련 blocked reason constants
Step D orchestration

잠금:

completion truth unchanged
owner truth unchanged
UI gate semantics unchanged
PR-RF-04 — Squat debug / observability builder isolation

대상:

Step E squatCycleDebug enrichment
stampSquatFinalPassTimingBlockedReason(...)

잠금:

debug field values unchanged
debug field 삭제 금지
debug가 gate input으로 역류하는 새 경로 금지
Later PR — evaluateExerciseAutoProgress(...) orchestration thinning

RF-02, RF-03, RF-04 이후에만 가능하다.

그 전에는 상위 오케스트레이터를 얇게 만들려 하지 않는다.

설계 핵심 요약
현재 repo에서 computeSquatUiProgressionLatchGate(...) 자체는 이미 pure helper에 가깝다. 진짜 문제는 그 전후 경계가 owner truth / final-pass blocker / debug stamping과 같은 오케스트레이션 블록 안에 붙어 있다는 점이다.
RF-02의 최소 안전 단위는 딱 두 가지다.
computeSquatUiProgressionLatchGate(...)를 전용 파일로 이동
필요하면 그 입력을 조립하는 local adapter만 추가
RF-02에서 절대 하면 안 되는 건 세 가지다.
primary squat owner truth source를 squatPassCore.passDetected에서 다른 것으로 바꾸는 것
Step D final-pass blocker를 같이 분리하는 것
Step E debug stamping을 같이 builder로 빼는 것
즉 RF-02는 “gate 계산 그 자체”와 “gate input assembly”까지만 다루고,
owner truth → ui gate → final-pass blocker → debug stamping 중 ui gate 층만 선명하게 잘라내는 PR이어야 한다.
가장 보수적인 파일 계획은 아래다.
수정: src/lib/camera/auto-progression.ts
추가: src/lib/camera/squat/squat-ui-progression-latch-gate.ts
구현 시 절대 건드리면 안 되는 것
squatOwnerTruth의 primary source
squatPassCore.passDetected 기반 owner truth 의미
computeSquatUiProgressionLatchGate(...)의 조건 순서
uiProgressionBlockedReason 문자열
finalPassBlockedReason 조립 순서
progressionPassed = owner truth && ui gate
shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...)
shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...)
stampSquatFinalPassTimingBlockedReason(...)
squatCycleDebug field 값/이름/의미
liveReadinessNotReady 판정 의미
readinessStableDwellSatisfied 판정 의미
setupMotionBlocked 판정 의미
squatIntegrityBlockForPass passthrough semantics
confidence formatting
pass confirmation frame 기준
threshold 값
comparison operator
detecting / retry / pass / fail branch semantics