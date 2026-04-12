PR-RF-STRUCT-11B — Squat UI Gate / Final Blocker Boundary Freeze
1. Title

PR-RF-STRUCT-11B — Squat UI Gate / Final Blocker Boundary Freeze

Behavior-preserving structural freeze for the post-owner / pre-latch layer in squat auto progression.

2. Problem Statement

PR-RF-STRUCT-11A 이후 전제는 다음이다.

squat owner truth read boundary는 이미 통일되었다.
main progression path와 fallback latch path는 동일 owner truth adapter를 통해 읽는다고 가정한다.
이번 PR에서는 owner truth read/write semantics를 다시 건드리지 않는다.

현재 구조에서 핵심 문제는 owner truth를 읽은 뒤에도 auto-progression 내부의 UI progression gate와 final blocker chain이 late policy layer로 작동하면서, 실질적으로 final pass eligibility를 다시 조정한다는 점이다.

이 PR의 목적은 그 late policy layer를 제거하는 것이 아니다.
대신 다음을 명시적 구조 경계로 잠근다.

어디까지가 owner truth 이후의 post-owner gate 인가
어디까지가 final blocker chain 인가
둘의 ordering은 어떻게 고정되는가
어떤 layer는 owner truth를 절대 rewrite하면 안 되는가
어떤 reason은 owner/completion layer 전용이고, 어떤 reason은 gate layer 전용인가
legitimate shallow pass가 late blocker에 의해 구조적으로 과잉 차단되지 않게 하려면, 어떤 provenance 구분이 필요한가

즉 11B는 gate/final-blocker chain freeze이고, threshold 조정 PR이 아니다.

3. Scope

이번 PR의 범위는 다음으로 제한한다.

squat의 owner truth read 직후부터 final latch handoff 직전까지의 chain을 단일 structural layer로 정의
현재 accessible runtime 기준의 post-owner gate chain map 문서화
UI progression gate와 final blocker chain의 ordering 고정
owner layer reason과 gate layer reason의 boundary 명시
progressionPassed, finalPassBlockedReason, finalPassEligible, isFinalPassLatched(...) 사이 책임 경계 freeze
page/navigation/readiness 이전까지만 다룸

이번 PR은 구현 PR이 아니라 설계 freeze 문서다.

4. Non-goals

다음은 이번 PR 범위 밖이다.

threshold 변경
pass/fail 의미 변경
blocked reason 의미 변경
owner truth semantics 변경
shallow / standard / ultra-low-ROM 의미 변경
evaluator / completion-state rule 변경
readiness/setup source routing 변경
final blocker의 숫자 조건 변경
navigation timing / route / UI copy 변경
quality semantics 변경
trace payload meaning 변경
page navigation ownership 변경
success latch ↔ route push contract 변경
readiness smoothing/live readiness 동작 변경

11B는 gate/final-blocker chain freeze only다.

5. User-visible Truth To Preserve

다음 사용자 체감 truth는 유지되어야 한다.

통과는 쉽게, 판정은 엄격하게
그러나 통과는 엉뚱한 순간 열리면 안 된다
서 있을 때 pass 금지
하강 도중 pass 금지
바닥 상태에서 pass 금지
상승 초중반의 성급 통과 금지
의미 있는 하강 → 상승/복귀 → 짧은 안정 구간 이후 pass
shallow ROM 사용자도 구조적으로 pass 가능해야 함
quality/evidence가 낮더라도 completion truth가 성립한 경우, quality-only warning은 pass owner가 될 수 없음
retry/fail/survey fallback은 pass truth를 rewrite하지 않고 post-owner veto로만 작동해야 함

이 원칙은 squat-evidence.ts가 completion truth owner가 아니라고 명시한 현재 구조와도 일치한다.

6. Current Post-Owner Gate Chain Map
6.1 Current chain entry

현재 accessible code 기준 entry는 evaluateExerciseAutoProgress(...) 내부다.
여기서 evaluator, guardrail, confidence, reasons를 만든 뒤, squat만 별도로 getSquatProgressionCompletionSatisfied(evaluatorResult, guardrail, stats)를 호출해 completionSatisfied와 squatCycleDebug를 얻는다.

즉 현재 관측 가능한 구조는:

evaluator truth 생성
guardrail truth 생성
confidence / reasons 생성
squat owner truth read
post-owner gate
final blocker exposure
page latch handoff
6.2 Owner-side truth surface

squat evaluator debug surface에는 아래 owner/completion truth가 노출된다.

currentSquatPhase
attemptStarted
descendConfirmed
ascendConfirmed
standingRecoveredAtMs
standingRecoveryHoldMs
evidenceLabel
completionBlockedReason
completionSatisfied
completionMachinePhase
completionPassReason
cycleComplete

또한 observed snapshot에서는 currentSquatPhase: standing_recovered, completionSatisfied: true, completionPassReason: standard_cycle, completionBlockedReason: null 같은 owner truth가 실제로 찍힌다.

6.3 Guardrail side truth surface

guardrail layer는 스스로를 capture-quality/confidence guardrail layer로 정의한다.

guardrail은 다음을 생산한다.

captureQuality
confidence
flags
retryRecommended
completionStatus
guardrailPartialReason
guardrailCompletePath

또한 squat 분기에서 owner truth가 incomplete이면 rep_incomplete와 partial reason을 추가한다. owner truth가 complete이면 completePath: evidenceLabel을 노출한다.

6.4 Post-owner gate

현재 accessible 코드 기준 post-owner gate의 핵심은 progressionPassed다.

정의:

completionSatisfied
guardrail.captureQuality !== 'invalid'
confidence >= passThresholdEffective
effectivePassConfirmation
hard blocker reason 부재
overhead 전용 rep/hold block 예외

스쿼트에 한정하면 사실상 다음 순서다.

owner truth satisfied
invalid capture 아님
confidence floor 충족
pass confirmation 충족
hard blocker reason 부재
6.5 Final blocker chain exposure

finalPassBlockedReason은 현재 다음 ordering으로 계산된다.

completion_not_satisfied
capture_quality_invalid
confidence_too_low:*
pass_confirmation_not_ready
hard_blocker:*
null

그리고 finalPassEligible = progressionPassed로 둔다.

따라서 현재 final blocker chain은 post-owner veto chain을 사람이 읽을 수 있게 노출한 형태다.

6.6 Retry/fail side branch

pass가 아니면 severe fail / retry / detecting branch로 내려간다.

특히 retry branch는 다음이면 열린다.

guardrail.captureQuality === 'invalid'
lowConfidenceRetry
reasons에 rep_incomplete, hold_too_short, left_side_missing, right_side_missing, hard_partial 포함

이때 rep_incomplete는 owner reason 자체가 아니라, owner incomplete를 UI/retry semantics로 변환한 결과일 수 있다. completionBlockedReasonToFailureTags(...)가 그 경계를 보여준다.

6.7 Latch handoff

page는 gate를 받은 뒤 다시

isFinalPassLatched(STEP_ID, gate)
effectivePassLatched = finalPassLatched || passLatched

를 계산한다.

squat의 isFinalPassLatched(...)는 다음을 다시 요구한다.

completionSatisfied === true
captureQuality !== 'invalid'
confidence >= 0.62
passConfirmationSatisfied === true
passConfirmationFrameCount >= 3

그 뒤 page effect가 effectivePassLatched를 success ownership처럼 사용하고 auto-advance/navigation으로 넘긴다.

6.8 Current map summary

현재 owner truth read 이후부터 final latch 직전까지의 chain은 아래로 요약된다.

owner truth read
→ post-owner gate (progressionPassed)
→ final blocker exposure (finalPassBlockedReason)
→ runtime branch (pass / retry / fail / detecting)
→ page-level final latch (isFinalPassLatched)
→ latch event / navigation handoff

이때 문제는 post-owner gate와 page-level latch가 분리되어 있고, 둘 다 final pass eligibility를 다시 판단한다는 점이다.

7. Structural Bottlenecks
7.1 Post-owner veto와 final latch가 분리되어 중복된다

progressionPassed와 isFinalPassLatched(...)는 거의 같은 최종 조건을 두 번 본다.

이 구조는 다음 위험을 만든다.

pass branch와 latch branch의 drift
“pass였다가 latch 안 됨” 같은 구조적 설명 가능성
final blocker chain이 어디서 끝나는지 모호해짐

11B에서는 이를 하나의 post-owner / pre-latch layer로 freeze해야 한다.

7.2 Owner reason과 gate reason이 provenance 없이 섞인다

owner의 completionBlockedReason은 completion-state semantics다.
반면 UI는 rep_incomplete, ascent_not_detected 같은 retry 태그를 본다. 이 태그는 completionBlockedReasonToFailureTags(...)에서 변환된 것이다.

즉 지금 구조는

owner reason
guardrail partial reason
common reasons
failure reasons
finalPassBlockedReason

이 서로 다른 provenance를 한 surface에서 소비한다.

11B에서는 최소한 문서 레벨에서 다음을 고정해야 한다.

owner reason은 owner reason으로만 남는다
retry/failure tag는 owner reason의 UI projection일 뿐이다
final blocker reason은 owner reason namespace를 침범하면 안 된다
7.3 Guardrail이 post-owner veto를 넘어서 제2 owner처럼 읽힌다

guardrail은 원래 capture quality / retry recommendation layer다.
하지만 실제로는 squat incomplete를 partial/rep_incomplete로 직접 내리고, retry path까지 이어진다.

이 구조를 그대로 두더라도, 11B에서는 해석을 고정해야 한다.

guardrail은 completion truth owner가 아니다
guardrail은 owner truth 위에서 veto / downgrade / retry suggestion만 수행한다
guardrail partial은 “completion truth 불성립의 외부 소비 형식”이지, completion meaning 자체가 아니다
7.4 Quality/evidence downgrade가 late pass blocker로 오용될 수 있다

squat-evidence.ts는 completion truth 변경 금지, mapping/down-grade only를 명시한다.
실제 관측에서도 standard cycle completion이 성립한 뒤 evidence가 weak로 내려가도 pass는 살아 있다.

따라서 11B에서 반드시 고정해야 하는 원칙은:

evidence/quality downgrade는 pass owner가 아니다
이는 confidence/explanation/planning tier에만 영향을 준다
post-owner gate가 이를 final veto 근거로 삼는 순간 owner semantics 오염이다
7.5 Legitimate shallow pass가 late blocker에서 과잉 차단될 위험

현재 accessible 코드만으로 computeSquatUiProgressionLatchGate(...) 자체는 확인되지 않았다.
그러나 다음 구조는 확인된다.

owner incomplete → guardrail partial → rep_incomplete
owner reason → retry tags 변환
retry path가 rep_incomplete, left/right_side_missing, hard_partial, low confidence를 직접 소비
final latch는 별도로 confidence/pass frames를 다시 소비

따라서 shallow path가 owner truth에서 이미 성립했는데도 late blocker가 stale/derived reason을 계속 잡고 있으면 구조적으로 과잉 차단될 위험이 있다.

11B는 이 위험을 threshold 수정이 아니라 boundary/provenance freeze로 다룬다.

7.6 이것은 threshold tuning 문제가 아니다

현재 병목은 수치 하나를 내리거나 올려서 해결할 종류가 아니다.

문제의 본질은:

어떤 값이 owner truth인가
어떤 값이 veto-only인가
어떤 값이 display/debug projection인가
final latch는 veto layer의 끝인지, 또 다른 owner인지

이 ordering이 잠겨 있지 않다는 데 있다.

8. Boundary Freeze Proposal
8.1 Freeze target

11B에서 하나의 layer로 잠글 대상은 다음이다.

Post-owner / pre-latch gate layer

포함 책임:

owner truth를 입력으로 받기
invalid capture veto
confidence veto
pass confirmation veto
hard blocker veto
final blocker reason exposure
pass-ready branch / retry/fail branch 분기 직전까지

즉 이 layer는 owner truth를 읽은 뒤, “지금 이 프레임에서 success branch를 열어도 되는가”만 판단한다.

8.2 What this layer is not

이 layer는 다음이 아니다.

completion owner
pass-core owner
evaluator owner
completion-state writer
evidence owner
readiness owner
navigation owner
success-latch owner
8.3 Freeze law

이 layer에 대해 다음 법칙을 잠근다.

owner truth를 rewrite하지 않는다
completion semantics를 재해석하지 않는다
shallow/standard 의미를 바꾸지 않는다
evidence/quality를 completion truth로 승격하지 않는다
blocked reason namespace를 섞지 않는다
page/navigation contract까지 확장하지 않는다
8.4 Allowed operations inside the layer

허용되는 것은 다음뿐이다.

owner truth를 읽고 veto-only 판단
gate-layer reason 생성
final blocker reason 래핑/노출
retry/fail/pass branch routing
8.5 Forbidden operations inside the layer

금지되는 것은 다음이다.

completionSatisfied 재작성
completionBlockedReason 대체
evidenceLabel 대체
completionPassReason 대체
owner reason을 gate reason으로 덮어쓰기
quality downgrade를 pass denial owner로 사용
readiness/setup 상태를 pass semantics에 끌어오기
page latch/navigation 상태를 gate owner처럼 사용하기
9. Locked Ordering

11B에서 명시적으로 고정할 순서는 다음이다.

9.1 Owner truth

Owner truth는 evaluator/completion-state/read adapter가 생성한다.

예:

completionSatisfied
completionBlockedReason
completionPassReason
currentSquatPhase
evidenceLabel

이 값들은 post-owner layer의 입력이다.

9.2 UI progression gate

UI progression gate는 owner truth 이후의 첫 veto-only 단계다.

역할:

invalid capture veto
confidence veto
pass confirmation veto
hard blocker veto

산출:

success branch open 가능 여부
retry/fail/detecting 방향성
gate-layer reason set
9.3 Final blocker chain

final blocker chain은 UI progression gate 내부 또는 바로 인접한 exposure surface다.

역할:

현재 frame에서 왜 success branch가 안 열렸는지 설명
순서를 유지한 single blocked reason 노출

즉 final blocker chain은 decision owner가 아니라 explanation surface다.

9.4 Latch handoff

page-level final latch는 post-owner gate layer 다음 단계다.

역할:

gate가 열린 success candidate를 UI success/latch contract로 넘김
stable frame handoff
success freeze / auto-advance / page effect로 연결

11B에서는 이 단계의 구현이나 ownership을 바꾸지 않는다.
다만 post-owner layer의 밖이라는 점만 잠근다.

9.5 Frozen ordering statement

최종 고정 statement:

owner truth → UI progression gate → final blocker chain exposure → latch handoff

그리고 다음도 명시적으로 고정한다.

UI progression gate는 owner truth를 rewrite할 수 없다
final blocker chain은 owner truth를 재정의할 수 없다
latch handoff는 post-owner gate를 다시 owner로 승격시킬 수 없다
10. File Impact Surface

이번 문서 기준 impact surface는 다음이다.

Primary
src/lib/camera/auto-progression.ts
post-owner gate / final blocker exposure / pass-ready routing / final latch handoff adjacency의 핵심 표면
Supporting owner-side inputs
src/lib/camera/evaluators/squat.ts
owner truth debug surface, completion/evidence/phase exposure
src/lib/camera/squat-completion-state.ts
직접 본문은 미확인이나 owner truth root로 취급
src/lib/camera/squat/pass-core.ts
직접 본문은 미확인이나 owner-side semantic source 후보로 취급
Supporting veto-side inputs
src/lib/camera/guardrails.ts
capture quality / retry / partial / completePath exposure
src/lib/camera/squat-retry-reason.ts
owner reason → retry/UI tag projection
src/lib/camera/squat-evidence.ts
evidence downgrade is mapping-only, not owner truth
Downstream consumer, out of scope for change in 11B
src/app/movement-test/camera/squat/page.tsx
final latch consumption, readiness, navigation handoff surface
11. Regression Proof Strategy

11B는 설계 freeze PR이므로 regression proof는 “무엇을 바꾸지 않아야 하는가”를 명시하는 방식으로 둔다.

11.1 User-visible pass timing preservation

다음 체감은 유지되어야 한다.

standing pass 금지
descent/bottom/too-early-ascent false positive 금지
standing_recovered 이후의 valid pass만 허용
shallow ROM도 owner truth 성립 시 pass 가능
11.2 Meaning preservation

변경되면 안 되는 meaning:

completionSatisfied
completionBlockedReason
completionPassReason
evidenceLabel
captureQuality
hard_partial, left_side_missing, right_side_missing
finalPassBlockedReason 각 문자열 의미
11.3 Structural regression checks

future implementation PR에서 최소 확인할 항목:

owner truth satisfied frame에서 post-owner layer가 owner fields를 rewrite하지 않는가
finalPassBlockedReason가 owner reason namespace를 침범하지 않는가
progressionPassed와 isFinalPassLatched(...)의 responsibility drift가 줄었는가
quality downgrade가 pass denial owner로 오용되지 않는가
retry/failure tags가 owner reason provenance를 덮지 않는가
11.4 Observability consistency

debug/trace에서 최소 다음은 provenance가 유지되어야 한다.

owner reason
gate reason
final blocker reason
latch state

이 네 축이 한 칸에 섞여 보이더라도, 문서상 source-of-truth는 분리되어야 한다.

12. Residual Risks
computeSquatUiProgressionLatchGate(...) 원문과 11A 문서를 직접 확인하지 못했다.
따라서 현재 문서는 accessible runtime chain 기준 freeze다.
getSquatProgressionCompletionSatisfied(...) 내부 구현이 직접 보이지 않는다.
실제 repo 내부에서 이미 guardrail/gate logic을 owner semantics 안으로 끌고 들어가고 있을 가능성은 열려 있다.
progressionPassed와 isFinalPassLatched(...)의 정확한 차이를 아직 structural debt로 남긴다.
11B는 ordering freeze이지 dedupe PR이 아니다.
retry/fail routing이 현재는 gate-layer와 user-guidance projection을 함께 안고 있다.
provenance 분리 자체는 11B에서 설계 잠금만 하고, 구현 정리는 후속 PR로 넘긴다.
page debug panel은 owner fields와 gate/latch fields를 함께 보여준다.
이것 자체는 허용하되, source ownership 혼동은 여전히 남는다.
13. Follow-up PR handoff
11C — readiness/setup source routing cleanup

11C로 넘길 것:

liveReadinessSummary
setup framing hint
readiness smoothing
ready_to_shoot / capture gating
readiness blocker source routing

이들은 11B의 post-owner gate layer 밖이다.

11D — success latch ↔ page navigation contract

11D로 넘길 것:

effectivePassLatched
passLatched
latchPassEvent()
success freeze
auto advance timer
router.push(nextPath)

이들은 post-owner gate 이후의 page contract다.

11E — observability sink-only cleanup

11E로 넘길 것:

debug panel provenance 정리
trace surface에서 owner/gate/latch reason 분리 표기
sink-only observability normalization

11B는 meaning을 바꾸지 않고 boundary만 잠근다.

14. Approval Questions
Approval needed: 실제 repo의 computeSquatUiProgressionLatchGate(...) 원문을 확인했을 때, 그 함수가 현재 accessible chain보다 더 많은 owner semantics를 직접 재정의하고 있는가?
그렇다면 11B는 behavior-preserving freeze 문구 안에 “이미 존재하는 semantic bleed-through를 rewrite하지 않고, 우선 boundary만 명시한다”는 문장을 더 강하게 넣어야 한다.
Approval needed: getSquatProgressionCompletionSatisfied(...) 내부가 단순 read adapter가 아니라, guardrail/confidence/retry semantics를 일부 섞고 있는가?
그렇다면 11B 문서의 owner/post-owner 분리 statement를 더 보수적으로 써야 한다.
Approval needed: finalPassBlockedReason를 strictly gate-layer reason namespace로 잠글지, 아니면 owner reason wrapper(completion:*)를 허용할지 결정이 필요하다.
본 문서는 gate-layer wrapper만 허용하고 owner raw reason 직접 노출은 비권장으로 본다.
Approval needed: isFinalPassLatched(...)를 11B에서 여전히 post-owner layer 바깥의 latch handoff로 간주할지 확인이 필요하다.
본 문서는 page-level success contract의 일부로 보아 11D 범위로 넘긴다.
Conflict note: 현재 accessible 구조만 보면 post-owner gate와 final latch가 이미 일부 중복 owner처럼 작동한다.
그래도 11B는 behavior-preserving으로 설계 가능하다. 다만 그 전제는 “기존 semantic bleed를 수정하지 않고, ownership 문서만 고정한다”는 점이다.

핵심 결론만 한 줄로 압축하면 이거다.

11B는 squat의 late policy chain을 없애는 PR이 아니라, owner truth 이후의 모든 veto를 하나의 “post-owner / pre-latch” layer로 잠그고, 그 레이어가 절대로 completion owner가 되지 못하게 경계를 고정하는 PR이다.
15. Implementation Notes

Scope

This implementation freezes only the squat post-owner / pre-latch layer in
src/lib/camera/auto-progression.ts. The locked order is:

owner truth read -> UI progression gate veto -> final blocker veto/exposure -> latch handoff.

Non-goals

No threshold, pass-core, completion-state, evaluator, readiness/setup,
page navigation, UI copy, quality, or trace payload meaning was changed.

Why behavior-preserving

The existing calls and reason strings were moved into a same-file helper:
computeSquatPostOwnerPreLatchGateLayer(...). The helper still calls
computeSquatUiProgressionLatchGate(...) and then applies the same two final
blocker predicates in the same order:

- shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass(...)
- shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass(...)

Owner truth remains an input to the helper and is returned unchanged. Gate
reasons are exposed through uiProgressionBlockedReason/finalPassBlockedReason,
but do not rewrite completionOwnerPassed, completionOwnerReason, or
completionOwnerBlockedReason.

Before/After owner-gate read path

Before:

readSquatPassOwnerTruth(...) -> computeSquatUiProgressionLatchGate(...) ->
inline final blocker mutations -> progressionPassed/finalPassBlockedReason.

After:

readSquatPassOwnerTruth(...) -> computeSquatPostOwnerPreLatchGateLayer(...) ->
progressionPassed/finalPassBlockedReason.

The final latch handoff remains outside this layer. page.tsx was not modified.

Files changed

- src/lib/camera/auto-progression.ts
- scripts/camera-rf-struct-11b-ui-gate-boundary-smoke.mjs
- docs/pr/PR-RF-STRUCT-11B-ui-gate-final-blocker-boundary-freeze.md

Acceptance tests

- npx tsx scripts/camera-rf-struct-11b-ui-gate-boundary-smoke.mjs
- npx tsx scripts/camera-rf-struct-11a-owner-read-boundary-smoke.mjs
- selected existing squat/camera smokes listed in the PR close-out
- npx tsc --noEmit --pretty false
- npm run lint

Residual risks

The repo still has pre-existing typecheck/lint command failures outside this
layer, and several existing squat fixture expectation failures remain in the
broader smoke set. Those were not changed in this PR because they are outside
the post-owner/pre-latch boundary freeze.
