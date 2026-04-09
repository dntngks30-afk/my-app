This PR follows docs/REFACTORING_SSOT_2026_04.md and is limited to behavior-preserving extraction unless explicitly stated otherwise.
RF-05 is intentionally limited to diagnosisSummary split only; perStepSummary/stabilitySummary remain deferred.

0. Positioning note

부모 SSOT의 5.B는 camera-trace.ts 리팩토링 순서를 B1 storage split -> B2 observation builders split -> B3 diagnosis summary split -> B4 quick stats/export split으로 잠근다 .
따라서 이번 PR은 RF-03 storage split 완료, RF-04 observation builder split 완료 이후의 B3 단계로 정의한다.

주의:

부모 문서의 section 9 예시 순서에는 PR-RF-05가 다른 영역으로 적혀 있으나, 이번 문서는 section 5.B의 locked extraction order를 우선으로 해석한다.
즉 이번 RF-05의 진짜 범위는 session/create가 아니라 camera-trace.ts diagnosis summary split이다.
1. Scope

이번 PR의 범위는 src/lib/camera/camera-trace.ts 안에 남아 있는 diagnosis summary 조립 책임만 분리하는 것이다.

구체적으로는 현재 camera-trace.ts 내부의 아래 책임을 별도 diagnosis module로 이동한다.

buildDiagnosisSummary(...)
diagnosis summary 내부에서만 사용되는 순수 read/assembly 로직
squat diagnosis subtree 조립
overhead diagnosis subtree 조립
cue/playback observability를 diagnosis subtree에 반영하는 조립 책임

이번 PR의 목적은 다음 한 줄이다.

camera-trace.ts에서 diagnosis summary 조립을 떼어내고, top-level trace file은 attempt snapshot orchestration만 남긴다.

현재 repo 기준으로 camera-trace.ts는 이미 storage 계층을 ./trace/camera-trace-storage로, observation 계층을 ./trace/camera-trace-observation-builders로 분리한 상태이며, diagnosis summary만 아직 같은 파일 안에 남아 있다. 이번 PR은 바로 그 잔여 diagnosis 조립 책임을 분리하는 단계다.

2. Non-goals

이번 PR의 비목표는 아래와 같다.

AttemptSnapshot shape 변경
diagnosisSummary payload 필드 추가/삭제/이름 변경
attempt snapshot meaning 변경
quick stats/export meaning 변경
storage policy 변경
success snapshot bridge 변경
buildAttemptSnapshot(...)의 top-level field ordering/semantics 변경
extractPerStepSummary(...) / extractStabilitySummary(...)의 의미 변경
recordAttemptSnapshot(...)의 non-blocking failure semantics 변경
runtime gate / evaluator / guardrail / voice guidance 로직 변경
trace 값을 runtime truth input으로 다시 읽는 경로 추가
threshold / blocked reason / fallback ordering / contract / response semantics 변경

특히 아래는 금지한다.

gateToOutcome(...) 변경 금지
stepIdToMovementType(...) 변경 금지
DEBUG_VERSION 변경 금지
diagnosisSummary 안의 null vs undefined 정규화 방식 변경 금지
typeof window !== 'undefined' 가드 위치/의미 변경 금지
squat / overhead diagnosis subtree의 field source 변경 금지
3. Locked truth outputs

이번 PR 전후로 아래 출력은 동일해야 한다.

3.1 Top-level attempt snapshot truth
id
ts
movementType
outcome
captureQuality
confidence
motionCompleteness
progressionPassed
finalPassLatched
fallbackType
flags
topReasons
perStepSummary
readinessSummary
stabilitySummary
diagnosisSummary
squatCameraObservability
debugVersion
3.2 Diagnosis summary base truth
diagnosisSummary.stepId
diagnosisSummary.readinessState
diagnosisSummary.captureQuality
diagnosisSummary.completionSatisfied
diagnosisSummary.passConfirmed
diagnosisSummary.passLatched
diagnosisSummary.autoNextObservation
diagnosisSummary.sampledFrameCount
diagnosisSummary.cue.*
3.3 Squat diagnosis subtree truth

아래는 source, 값, nullability까지 동일해야 한다.

squatCycle.peakDepth
depthBand
currentSquatPhase
descendDetected
bottomDetected
recoveryDetected
startBeforeBottom
cycleComplete
passBlockedReason
completionPathUsed
completionRejectedReason
descendStartAtMs
downwardCommitmentAtMs
committedAtMs
reversalAtMs
ascendStartAtMs
recoveryAtMs
standingRecoveredAtMs
standingRecoveryHoldMs
successPhaseAtOpen
cycleDurationMs
downwardCommitmentDelta
ultraLowRomCandidate
ultraLowRomGuardPassed
ultraLowRomRejectReason
standingStillRejected
falsePositiveBlockReason
descendConfirmed
ascendConfirmed
reversalConfirmedAfterDescend
recoveryConfirmedAfterReversal
minimumCycleDurationSatisfied
captureArmingSatisfied
finalPassTimingBlockedReason
standardPathBlockedReason
baselineStandingDepth
rawDepthPeak
relativeDepthPeak
failureOverlayArmed
failureOverlayBlockedReason
shallowObservationEligible
attemptStarted
downwardCommitmentReached
evidenceLabel
completionBlockedReason
ultraLowRomPathDisabledOrGuarded
squatEvidenceLevel
squatEvidenceReasons
cycleProofPassed
romBand
confidenceDowngradeReason
insufficientSignalReason
guardrailPartialReason
guardrailCompletePath
lowRomRejectionReason
ultraLowRomRejectionReason
completionMachinePhase
completionPassReason
completionTruthPassed
lowQualityPassAllowed
passOwner
finalSuccessOwner
standardOwnerEligible
shadowEventOwnerEligible
ownerFreezeVersion
completionOwnerPassed
completionOwnerReason
completionOwnerBlockedReason
uiProgressionAllowed
uiProgressionBlockedReason
liveReadinessSummaryState
readinessStableDwellSatisfied
setupMotionBlocked
setupMotionBlockReason
attemptStartedAfterReady
successSuppressedBySetupPhase
qualityOnlyWarnings
armingDepthSource
armingDepthPeak
squatDepthPeakPrimary
squatDepthPeakBlended
armingDepthBlendAssisted
armingFallbackUsed
reversalConfirmedBy
reversalDepthDrop
reversalFrameCount
relativeDepthPeakSource
rawDepthPeakPrimary
rawDepthPeakBlended
squatDepthObsFallbackPeak
squatDepthObsTravelPeak
squatDepthBlendOfferedCount
squatDepthBlendCapHitCount
squatDepthBlendActiveFrameCount
squatDepthSourceFlipCount
baselineFrozen
peakLatched
peakLatchedAtIndex
peakAnchorTruth
eventCycleDetected
eventCycleBand
eventCyclePromoted
eventCycleSource
eventBasedDescentPath
completionFinalizeMode
completionAssistApplied
completionAssistSources
completionAssistMode
promotionBaseRuleBlockedReason
reversalEvidenceProvenance
trajectoryReversalRescueApplied
reversalTailBackfillApplied
officialShallowPathCandidate
officialShallowPathAdmitted
officialShallowPathClosed
officialShallowPathReason
officialShallowPathBlockedReason
closedAsOfficialRomCycle
closedAsEventRescuePassReason
officialShallowStreamBridgeApplied
officialShallowAscentEquivalentSatisfied
officialShallowClosureProofSatisfied
officialShallowPrimaryDropClosureFallback
officialShallowReversalSatisfied
officialShallowDriftedToStandard
officialShallowDriftReason
officialShallowPreferredPrefixFrameCount
displayDepthTruth
ownerDepthTruth
cycleDecisionTruth
squatInternalQuality
passSeverity
resultInterpretation
qualityWarningCount
limitationCount
hmmShadow
calib
arm
hra
3.4 Overhead diagnosis subtree truth

아래도 source, 값, nullability까지 동일해야 한다.

overhead.peakElevation
legacyPeakElevationDeg
truePeakArmElevationDeg
risePeakArmElevationDeg
armElevationTimeAvgDeg
exportedPeakElevationProvenance
peakElevationRepresentsTimeAverageFallback
armRangeMetricSemantics
peakCount
holdDurationMs
holdAccumulationMs
holdTooShort
topReachDetected
upwardMotionDetected
topDetectedAtMs
topEntryAtMs
stableTopEntryAtMs
holdArmedAtMs
holdAccumulationStartedAtMs
holdSatisfiedAtMs
holdArmingBlockedReason
holdRemainingMsAtCue
holdCuePlayed
holdCueSuppressedReason
successEligibleAtMs
successTriggeredAtMs
successBlockedReason
holdDurationMsLegacySpan
dwellHoldDurationMs
legacyHoldDurationMs
stableTopEnteredAtMs
stableTopExitedAtMs
stableTopDwellMs
stableTopSegmentCount
holdComputationMode
completionMachinePhase
completionBlockedReason
overheadInternalQuality
meaningfulRiseSatisfied
riseStartedAtMs
riseBlockedReason
finalPassBlockedReason
inputTruthMap
pageHookStatsEcho
inputStability
readinessBlockerTrace
ohKinematic*
ohHeadRelative*
visualTruthCandidates
visualTruthSnapshots
3.5 Sink-only invariant

trace / diagnosis 레이어는 판정을 만드는 레이어가 아니라 관측용 sink이며, runtime truth를 바꾸거나 다시 입력으로 읽는 구조를 추가하면 안 된다 .

4. Files changed

이번 PR의 예상 변경 파일은 아래로 잠근다.

Modified
src/lib/camera/camera-trace.ts
Added
src/lib/camera/trace/camera-trace-diagnosis-summary.ts
Optional only if type-cycle avoidance is necessary
없음이 기본
정말 필요할 때만 src/lib/camera/trace/camera-trace-types.ts 또는 동등한 type-only file을 별도 PR 없이 추가할 수 있다
단, 이 경우도 schema extraction이 아니라 type cycle 해소용 최소 이동이어야 하며 runtime shape 변화는 없어야 한다

금지:

storage file 수정 금지
observation builders file 의미 변경 금지
quick stats/export code 이동 금지
success diagnostic 관련 로직 변경 금지
5. Extraction boundary

이번 PR의 분리 경계는 아래처럼 잠근다.

5.1 Move out

새 diagnosis module로 이동 가능한 책임:

buildDiagnosisSummary(...)
squat diagnosis subtree builder
overhead diagnosis subtree builder
cue/playback diagnosis subtree builder
diagnosis builder 내부에서만 쓰이는 순수 helper
5.2 Keep in camera-trace.ts

기존 파일에 남겨야 하는 책임:

AttemptSnapshot top-level contract
RecordAttemptOptions
stepIdToMovementType(...)
gateToOutcome(...)
extractStabilitySummary(...)
extractPerStepSummary(...)
buildAttemptSnapshot(...)
pushAttemptSnapshot(...)
getRecentAttempts(...)
clearAttempts(...)
getQuickStats(...)
recordAttemptSnapshot(...)
5.3 Why this exact boundary

RF-04 시점에서 observation builders는 이미 camera-trace.ts 밖으로 분리되었고, 현재 남은 과밀 책임 중 가장 큰 덩어리는 diagnosis summary assembly다.
이번 PR은 그 한 층만 떼어내고, top-level snapshot orchestration은 유지한다. 이는 부모 SSOT의 “One PR = one layer”, “Behavior-preserving extraction first” 원칙과 맞다 .

5.4 Explicitly out of boundary

다음은 이번 PR에서 다루지 않는다.

perStepSummary builder separate extraction
stabilitySummary builder separate extraction
quick stats / export utility split
attempt snapshot type/schema split
dev panel/UI import cleanup
6. Why behavior-preserving

이번 extraction이 behavior-preserving이어야 하는 이유는 명확하다.

부모 SSOT가 camera-trace refactor를 schema 유지형 구조 분리로 잠근다 .
diagnosis summary는 runtime pass truth가 아니라 관측용 snapshot surface다.
diagnosis summary는 already-computed gate/evaluator/guardrail/readiness 값을 읽어 조립할 뿐, 새로운 truth를 계산하면 안 된다.
따라서 이번 PR은 “판단 로직 이동”이 아니라 “조립 책임 이동”이어야 한다.

구현 원칙:

새 diagnosis module은 read-only builder여야 한다
입력은 기존과 동일하게 stepId, gate, context, options
출력은 기존과 동일한 AttemptSnapshot['diagnosisSummary']
camera-trace.ts는 diagnosis builder를 호출만 하고, branch ordering은 그대로 둔다
helper extraction 과정에서 null, undefined, boolean coercion, typeof number === 'number' 체크 순서를 바꾸지 않는다
7. Regression proof

이번 PR의 회귀 검증은 아래로 잠근다.

7.1 Golden compare
동일 fixture/gate 입력에 대해 buildAttemptSnapshot(...).diagnosisSummary pre/post deep-equal
squat terminal pass case
squat retry case
squat shallow observed but no attempt evidence case
overhead hold success case
overhead hold too short case
overhead invalid capture case
7.2 Snapshot contract compare
AttemptSnapshot 전체 JSON pre/post diff identical
특히 diagnosisSummary subtree deep-equal
debugVersion unchanged
topReasons, flags, perStepSummary, stabilitySummary unchanged
7.3 Trace storage continuity
recordAttemptSnapshot(...)가 여전히 non-blocking
localStorage write failure 시 예외 전파 없음
최근 attempt count 동일
기존 stored snapshot parsing 영향 없음
7.4 Observation continuity
latest squat observation count 동일
latest overhead observation count 동일
success snapshot continuity unchanged
observation builder dedup behavior unchanged
7.5 Camera sanity
dev 환경에서 squat 1회, overhead 1회 실기기 sanity
TraceDebugPanel 또는 export에서 diagnosis surface가 기존과 동일하게 보이는지 확인
cue/playback observability가 browser 환경에서만 읽히는 가드 유지 확인
8. Residual risks
8.1 Null vs undefined drift risk

diagnosis summary는 field 수가 매우 많고, 일부는 null, 일부는 undefined, 일부는 field omission을 사용한다. helper 분리 과정에서 이 차이가 무너지면 schema는 같아 보여도 export diff가 생길 수 있다.

8.2 Hidden source drift risk

squat subtree는 gate.squatCycleDebug, highlightedMetrics, evaluatorResult.debug.squatCompletionState, squatInternalQuality, camera-success-diagnostic를 동시에 읽는다. extraction 중 source 우선순위가 바뀌면 semantics가 변한다.

8.3 Browser-only observability risk

getCorrectiveCueObservability() / getLastPlaybackObservability()는 window 가드 하에서만 읽는다. 이 가드가 새 파일로 이동하면서 위치가 바뀌면 SSR/Node path에서 차이가 날 수 있다.

8.4 Type cycle risk

AttemptSnapshot['diagnosisSummary'] 타입을 새 파일에서 직접 참조하려다 import cycle이 생길 수 있다. 이 경우 runtime logic를 건드리지 말고, type-only alias 또는 local structural typing으로 해결해야 한다.

8.5 Overhead subtree bloat risk

overhead diagnosis subtree는 visual truth, input stability, readiness blocker trace 등 주변 observability를 많이 포함한다. RF-05에서 여기에 손대다가 observation/export 영역까지 같이 건드리면 one-layer rule을 위반한다.

9. Follow-up PRs
RF-06

camera-trace.ts의 perStepSummary / stabilitySummary assembly split
단, 이번 RF-05가 안정적으로 끝난 뒤에만 진행

RF-07

camera-trace.ts quick stats / export utility split
부모 SSOT의 B4 단계에 해당

RF-08

trace top-level orchestration thinning
camera-trace.ts를 snapshot facade로 더 얇게 만드는 단계

Separate future work, not refactor PR
diagnosis schema redesign
export contract redesign
dev panel rendering restructure
trace-to-runtime feedback path 도입
10. Final lock

이번 PR의 핵심 잠금은 아래 한 줄이다.

RF-05는 diagnosis logic 개선이 아니라, camera-trace.ts 안에 남아 있는 diagnosis summary 조립 책임을 별도 builder file로 옮기는 behavior-preserving extraction only PR이다.

즉 아래 중 하나라도 발생하면 RF-05 범위를 벗어난다.

diagnosisSummary field 추가/삭제/rename
null/undefined semantics 변경
squat/overhead diagnosis source priority 변경
quick stats/export 결과 변경
storage/write behavior 변경
observation builder semantics 변경
trace를 runtime gate 입력으로 읽는 새 경로 추가
