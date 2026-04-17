docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md
Status

Draft parent SSOT
Scope owner: shallow squat post-pass truth map stabilization
Applies to: follow-up PR A ~ D only

Why this SSOT exists

얕은 스쿼트 통과 자체는 이미 살아났다.

현재 검증된 사실:

readSquatPassOwnerTruth()는 squatPassCore.passDetected === true일 때 completionOwnerReason="pass_core_detected"를 반환하고, 이 경우 completion-state fallback veto보다 pass-core를 우선 owner로 사용한다. enforceSquatOwnerContradictionInvariant()도 pass_core_detected면 completion-state contradiction check를 건너뛴다. getSquatPostOwnerFinalPassBlockedReason() 역시 pass_core_detected면 completion-state veto chain을 건너뛰고 UI gate만 본다.
실제 성공 로그에서도 completionOwnerReason="pass_core_detected", completionOwnerPassed=true, uiProgressionAllowed=true, finalPassLatched=true가 동시에 잡혀 얕은 스쿼트 통과가 실제로 열렸다.
setup false-pass 방어선도 아직 유지된다. 성공 전 단계에서는 setupMotionBlocked=true, uiProgressionAllowed=false, finalPassEligible=false가 실제로 기록된다.

하지만 남은 리스크도 확인됐다.

성공 로그인데도 내부에는 completionTruthPassed=false, passSeverity="failed", resultInterpretation="movement_not_completed"가 함께 남을 수 있다. 이건 현재 result severity helper가 completionTruthPassed를 기준으로 실패/성공을 나누기 때문이다.
success snapshot 기록도 같은 helper를 그대로 사용한다. 즉 motion pass는 성공인데 downstream semantics는 실패로 읽을 수 있는 split-brain이 아직 남아 있다.

이 SSOT의 목적은 얕은 스쿼트 통과 성공을 절대 회귀시키지 않으면서,
이후 의미 해석, snapshot, diagnostics, regression lock을 정리하기 위한 상위 truth map을 고정하는 것이다.

Product law

다음 4가지는 절대 깨지면 안 된다.

1. shallow squat success preservation

현재처럼 shallow / ultra-low-ROM의 실제 down → reversal → recovery가 있으면 통과는 유지되어야 한다.
이후 어떤 PR도 이 통과를 다시 completion-state veto로 되돌리면 안 된다.

2. no false pass on non-squat motion

다음은 절대 통과되면 안 된다.

가만히 서 있기
그냥 앉아 있기
앉는 도중
일어서는 도중
setup step-back / camera tilt
frame jump / unstable bbox
squat가 아닌 무의미한 흔들림
3. single owner law

motion success owner는 하나만 있어야 한다.
현재 그 owner는 current-rep pass-core truth다. completion-state는 fallback 또는 debug sink일 뿐이다.

4. semantics cannot veto success

한 번 최종 pass가 열렸다면, severity / interpretation / snapshot / diagnostic layer는
그 성공을 설명할 수는 있어도 실패로 뒤집을 수는 없다.

Locked truth
Locked truth A — motion success owner

motion success owner는 pass-core current rep truth다.

정확히는:

readSquatCurrentRepPassTruth()
readSquatPassOwnerTruth()
computeSquatPostOwnerPreLatchGateLayer()
getSquatPostOwnerFinalPassBlockedReason()

이 체인이 현재 motion success owner 경계다.

Locked truth B — setup/readiness veto

setup / readiness 관련 veto는 여전히 유효해야 한다.

liveReadinessSummaryState
readinessStableDwellSatisfied
setupMotionBlocked
attemptStartedAfterReady
computeSquatUiProgressionLatchGate()

이 레이어는 성공을 여는 owner가 아니라, 이미 잡힌 motion truth를 UI success로 열어도 되는지 판단하는 veto layer다.

Locked truth C — final product pass truth

제품 success truth는 completion-state가 아니라 아래다.

finalPassEligible
finalPassBlockedReason
progressionPassed
finalPassLatched

이 값들이 제품 성공/실패 정본이어야 한다.
completionTruthPassed는 더 이상 제품 success 정본이 아니다. 현재 RF-STRUCT-12 이후 구조가 이미 그렇게 움직이고 있다.

Locked truth D — severity/interpretation is downstream only

buildSquatResultSeveritySummary()는 현재 completionTruthPassed를 기준으로 failed / movement_not_completed를 만들고 있다. 이건 RF-STRUCT-12 이후에는 정본 기준이 될 수 없다.

따라서 이후 PR에서는:

completionTruthPassed
completionPassReason
completionBlockedReason

이 값들이 debug / legacy compat / diagnostic sink로만 남아야 하며,
제품 성공 truth를 뒤집는 입력으로 쓰이면 안 된다.

Layered truth map
Layer 0 — raw motion evidence

Includes:

descendStartAtMs
peakAtMs
reversalAtMs
standingRecoveredAtMs
attemptStarted
peakLatched
baselineFrozen
relativeDepthPeak
eventCycle*
officialShallow*

Role:

motion evidence 관측 레이어
noisy / partial / drift 가능
단독으로 제품 success owner가 되면 안 됨
Layer 1 — current-rep motion truth

Owner:

readSquatCurrentRepPassTruth()
readSquatPassOwnerTruth()

Required invariants:

passCoreStale !== true
timestampsConsistent === true
current rep 기준 동일 rep identity
attemptStarted === true
current-rep pass-core pass truth 존재 시 그것이 정본

Rule:

pass_core_detected + current-rep consistency satisfied
→ motion truth success
completion-state는 pass-core 부재 시 fallback만 허용
Layer 2 — setup / readiness truth

Owner:

resolveSquatReadinessSetupGateInputs()
computeSquatUiProgressionLatchGate()

Required invariants:

liveReadinessSummaryState !== 'not_ready'
readinessStableDwellSatisfied === true
setupMotionBlocked !== true
attemptStartedAfterReady === true

Rule:

Layer 1 motion truth가 true여도 Layer 2가 false면 최종 success 금지
standing/setup false pass는 이 레이어에서 막혀야 함
Layer 3 — final product pass truth

Owner:

computeSquatPostOwnerPreLatchGateLayer()
getSquatPostOwnerFinalPassBlockedReason()
finalPassEligible
progressionPassed
finalPassLatched

Rule:

Final Product Pass Truth =

Layer 1 current-rep motion truth passed
Layer 2 setup/readiness truth passed
final UI gate passed
hard blocker 없음

이 레이어가 사용자 성공/실패 정본이다.

Layer 4 — result semantics truth

Owner after follow-up:

result severity summary
success snapshot result interpretation
diagnostic summary result interpretation

Rule:

finalPassGranted=false
→ failed / movement_not_completed
finalPassGranted=true + low quality / warnings
→ low_quality_pass / movement_completed_but_quality_limited
finalPassGranted=true + limitations only
→ warning_pass / movement_completed_with_warnings
finalPassGranted=true + clean
→ clean_pass / movement_completed_clean

금지:

finalPassGranted=true인데 movement_not_completed
finalPassGranted=true인데 passSeverity='failed'
Layer 5 — debug / compat / sink

Includes:

completionTruthPassed
completionPassReason
completionBlockedReason
cycleComplete
passOwner
finalSuccessOwner
standardOwnerEligible
shadowEventOwnerEligible
eventCycle*
officialShallow*

Rule:

debug / trace / calibration / forensics only
final product pass truth input으로 재사용 금지
severity fail/pass owner로 재승격 금지
Illegal states

이 조합들은 이후 PR에서 모두 illegal state로 간주한다.

finalPassEligible=true and uiProgressionAllowed=false
finalPassLatched=true and finalPassBlockedReason!=null
finalPassLatched=true and passSeverity='failed'
finalPassLatched=true and resultInterpretation='movement_not_completed'
completionOwnerReason='pass_core_detected' and completionOwnerPassed=false
setupMotionBlocked=true and finalPassEligible=true
passCoreStale=true and finalPassEligible=true
attemptStarted!==true and finalPassEligible=true
timestampsConsistent=false and finalPassEligible=true
Non-goals

이 SSOT와 follow-up PR A ~ D의 범위 밖:

shallow 통과 threshold 재조정
pass-core 감지 기준 완화/강화
completion-state scoring semantics 재정의
setup/readiness threshold 완화
overhead reach 로직 수정
/app execution core 수정
public funnel / payment / claim / onboarding 수정
새로운 제품 기능 추가
UI copy 개선
trace format 전면 개편
Regression lock

향후 모든 PR은 아래 회귀 조건을 피해야 한다.

Must keep passing
shallow actual squat
ultra-low-ROM but real descend → reversal → recovery
moderate/deep normal squat
Must keep blocked
standing still
seated still
sitting down only
standing up only
setup step-back
frame jump / unstable bbox
camera tilt / area shrink
tiny sway / non-squat motion
Must keep aligned
pass_core_detected success must never be re-vetoed by completion-state
success semantics must not say failed
setup block must still veto pass
stale rep / rep boundary contamination must still veto pass
PR track
PR-A — Final Pass Truth Surface Freeze
Scope
finalPassEligible / progressionPassed / finalPassLatched를 제품 success 정본으로 명시적으로 고정
필요시 정식 surface 추가:
finalPassGranted
finalPassTruthSource
finalPassGrantedReason
Non-goals
threshold 변경 금지
pass-core logic 변경 금지
setup gate 변경 금지
shallow 통과율 변경 금지
Done when
downstream이 completion-state truth 대신 final pass truth를 참조할 준비가 됨
success 정본 surface가 문서/코드상 명확해짐
PR-B — Result Semantics Rebind
Scope
severity / interpretation / snapshot helper를 completionTruthPassed 기준에서 finalPassGranted 기준으로 재바인딩
success인데 failed로 보이는 split-brain 제거
Non-goals
motion gate 변경 금지
UI gate 변경 금지
pass-core 변경 금지
Done when
finalPassGranted=true인 성공은 어떤 severity consumer에서도 failed로 표시되지 않음
PR-C — Owner Naming Normalization
Scope
owner/debug 표면 이름 정렬
passOwner='other' 같은 모호한 표면을 실제 owner source와 맞춤
operator/debug readability 개선
Non-goals
owner logic 변경 금지
success criteria 변경 금지
Done when
success owner가 trace/snapshot/debug에서 한 눈에 동일하게 읽힘
PR-D — Regression Harness Lock
Scope
illegal states / must-pass / must-block 시나리오를 regression fixture로 잠금
shallow success preserved + false pass forbidden을 회귀 방지 장치로 고정
Non-goals
product logic 변경 금지
threshold 변경 금지
Done when
shallow success 10/10 유지
standing/sitting/setup/frame-jump false pass 0/10 유지
illegal states 자동 감지 가능
Files likely involved in follow-up PRs

확정 범위는 각 설계방에서 다시 잠그되, 부모 SSOT 기준 중심 파일은 아래다.

src/lib/camera/auto-progression.ts
src/lib/camera/squat-result-severity.ts
src/lib/camera/camera-success-diagnostic.ts

이 외 소비처는 각 PR 설계방에서 실제 repo 기준으로 추가 확인한다.

Final law

가장 중요한 한 줄은 이것이다.

pass-core가 current rep 기준으로 pass를 냈고, setup/readiness/ui gate가 통과했다면 그것이 유일한 제품 성공 truth다.
그 이후 completion-state, severity, snapshot, interpretation, debug trace는
그 성공을 설명할 수는 있어도 실패로 뒤집을 수는 없다.