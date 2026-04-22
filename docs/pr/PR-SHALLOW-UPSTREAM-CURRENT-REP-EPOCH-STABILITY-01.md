PR-SHALLOW-UPSTREAM-CURRENT-REP-EPOCH-STABILITY-01
SSOT Summary
Parent SSOT: SHALLOW DEVICE-REPLAY-FIRST SSOT — 다음 PR은 downstream broadening이 아니라 device replay가 가장 많이 가리키는 upstream 한 층만 수정해야 하며, synthetic보다 device replay를 대표 truth로 우선한다
Previous child PR outcome: A-family 전용 arming/acquisition PR로 인해 일부 shallow rep는 attemptStarted=true / officialShallowPathAdmitted=true까지 진입하게 되었지만, 실기기 최신 trace에서는 같은 rep 안에서 blocker family가 not_armed -> no_reversal -> span_short -> not_armed 식으로 드리프트하며 최종 pass는 여전히 닫히지 않는다
Purpose of this PR: 이번 PR은 threshold를 넓히는 PR이 아니다. 실제 shallow rep가 한 번 current-rep / attempt truth에 진입한 뒤, 같은 rep 안에서 owner epoch가 흔들리거나 pre-attempt 상태로 되돌아가지 않도록 current-rep epoch stability / stickiness 만 보정하는 PR이다.
1. Problem Statement

이전 PR 이후 최신 실기기 trace는 “A-family가 완전히 그대로”가 아니라, A-family 일부 해소 후 같은 rep 내 unstable drift 를 보여준다.

대표 최신 패턴:

초기에는 여전히 attemptStarted=false, completionBlockedReason=not_armed, baselineFrozen=false, peakLatched=false 로 시작한다
같은 trace 안에서 이후 attemptStarted=true, descendConfirmed=true, officialShallowPathAdmitted=true 로 진입한다
더 뒤에서는 reversalConfirmedAfterDescend=true, recoveryConfirmedAfterReversal=true, officialShallowClosureProofSatisfied=true, officialShallowReversalSatisfied=true 까지 간다
그러나 최종적으로 finalPassEligible=false 이고, no_standing_recovery, no_reversal, descent_span_too_short, ascent_recovery_span_too_short 등으로 다시 막힌다
심지어 같은 trace 후반에 다시 attemptStarted=false, completionBlockedReason=not_armed 계열로 돌아가는 드리프트도 보인다

즉 현재 병목의 정확한 이름은:

“shallow rep를 여는 것” 자체보다, 한 번 열린 current-rep truth를 같은 rep 끝까지 안정적으로 유지하지 못하는 것

이다.

2. Representative Truth Lock
2-1. Primary representative truth for this PR

이번 PR의 대표 진실은 최신 post-arming-fix device traces 다.

latest_trace_A = 붙여넣은 텍스트 (1).txt / turn7file0
latest_trace_B = 붙여넣은 텍스트 (2).txt / turn7file1

이 둘이 보여주는 공통 진실:

shallow rep가 중간에 열리긴 한다
하지만 same-rep owner truth가 안정적으로 유지되지 않는다
completion truth 일부가 성립해도 final pass surface까지 닫히지 않는다
blocker family가 rep 내부에서 drift 한다
2-2. Previous primary family remains historical cause, not current sole target

기존 A-family representative는 여전히 원인 계층의 증거다.
하지만 이번 PR의 직접 target은 “arming을 다시 열기”가 아니라, 열린 후 유지되는 current-rep epoch stability 다.

3. Exact Failure Shape To Fix

이번 PR은 아래 failure shape 하나만 본다.

Failure shape
same rep 안에서
pre-attempt hint
attemptStarted=true
officialShallowPathAdmitted=true
reversal/recovery 일부 확인
다시 no_reversal / no_standing_recovery / span_short / not_armed 드리프트
결과적으로 final pass ownership이 끝까지 유지되지 못함
More precise interpretation

이건 threshold 부족 하나가 아니라,

current rep boundary
epoch stickiness
owner truth persistence
terminal recovery ownership
사이의 정렬 실패다.
4. Scope

이번 PR은 오직 아래만 다룬다.

current-rep epoch persistence
attempt truth가 열린 뒤 same-rep 동안 유지되는 stickiness
baselineFrozen / peakLatched / committed epoch가 rep 내부에서 불필요하게 풀리거나 재초기화되지 않도록 하는 보정
official shallow admission 이후 same-rep terminal evaluation ownership 유지
rep 도중 blocker family가 pre-attempt 계열로 역류하지 않도록 하는 narrow guard

정확한 한 줄 목적:

실제 shallow rep가 한 번 current-rep truth로 인정되면, 같은 rep가 끝날 때까지 그 epoch를 truthfully 유지하게 만든다.

5. Non-goals

이번 PR은 아래를 다루면 실패다.

broad threshold sweep
global descent_span_too_short 완화
global ascent_recovery_span_too_short 완화
global reversal_span 완화
standing/seated guard 약화
authority-law 변경
pass-core opener 의미 변경
registry grant path 추가
UI latch / final surface semantics 변경
deep / standard cycle 의미 변경
shallow 전체를 한 번에 pass 시키려는 broad fix
writer / close-commit / downstream broadening
6. Why This PR Exists

이전 PR은 “문을 아예 못 여는 A-family”를 겨냥했고, 일부 실제 rep에선 그 효과가 있었다.
하지만 최신 trace는 그 다음 병목을 드러냈다.

즉 지금은:

before: rep가 아예 안 열림
now: rep는 잠깐 열리지만 끝까지 같은 rep로 유지되지 않음

따라서 이번 PR의 목적은 arming 재수정이 아니라,

once opened, keep the same shallow rep epoch stable until terminal outcome

으로 바뀌어야 한다.

7. Implementation Law

구현은 아래 방향만 허용된다.

epoch stability first
실제 shallow rep에서 attemptStarted, baselineFrozen, peakLatched, committedAtMs 가 잡힌 뒤,
같은 rep 안에서 setup-clean / readiness가 유지되는 한
pre-attempt 리셋성 판단으로 되돌아가지 않게 한다
same-rep stickiness only
새 rep를 더 쉽게 여는 것이 아니라
이미 열린 rep를 같은 rep 끝까지 보존한다
terminal ownership alignment
reversal/recovery가 completion truth에서 이미 성립한 rep라면
terminal evaluation이 unrelated pre-attempt blocker로 다시 역류하지 않게 한다
no negative broadening
standing / seated에까지 epoch stickiness가 적용되면 실패다
stickiness는 실제 shallow rep가 opened/admitted된 경우에만 국한되어야 한다
8. Likely Narrow Boundaries To Inspect

이 PR에서 먼저 봐야 할 경계는 이쪽이다.

attemptStarted 이후 current rep reset 조건
baselineFrozen / peakLatched 해제 또는 무효화 경계
committed/current-rep epoch가 same trace 안에서 다시 pre-attempt로 떨어지는 경계
officialShallowPathAdmitted 이후 terminal blocker ownership source
reversal/recovery가 잡힌 뒤에도 final owner truth가 유지되지 않는 read boundary
“same rep vs new rep vs noise tail” 판정 경계
9. Proof / Replay Requirements
Mandatory primary proof
최신 post-fix traces 2개
turn7file0
turn7file1

이 둘은 이번 PR의 대표 truth다.

Mandatory negative guards
existing standing/seated negative bundle
이번 PR 이후에도 same-rep stickiness가 negative case에 퍼지면 안 된다.
Mandatory positive guards
existing deep pass bundle
deep/standard ownership 의미는 절대 깨지면 안 된다.
Historical regression guards
previous A-family device bundle
이번 PR이 A-family를 다시 악화시키면 안 된다.
10. Acceptance Criteria
Must improve

최신 trace에서 아래 중 최소 하나 이상이 same rep 기준으로 안정화되어야 한다.

attemptStarted once opened does not fall back spuriously
baselineFrozen / peakLatched / committed epoch remains stable through the same rep
officialShallowPathAdmitted rep does not drift back to pre-attempt blocker family mid-rep
reversal/recovery confirmed rep reaches a more coherent terminal blocker ownership
Must not regress
standing false pass 금지
seated false pass 금지
deep standard path regression 금지
pass-core opener regression 금지
registry / UI latch / authority semantics regression 금지
global span threshold relaxation 금지
Explicit failure conditions
same-rep stickiness가 negative controls에도 적용됨
broad threshold change로 해결하려 함
downstream close/commit broadening으로 우회함
latest traces에서 여전히 A→B/C→A 드리프트가 동일하게 반복됨
11. Final Lock Sentence

이번 PR은 shallow squat의 통과 기준을 넓히는 PR이 아니다.
이번 PR은 latest device replay가 보여주는 same-rep truth drift 를 고치는 PR이다.
즉 실제 shallow rep가 한 번 attempt/current-rep truth로 진입한 뒤, 같은 rep 내부에서 owner epoch가 흔들리거나 pre-attempt blocker로 역류하지 않도록 하는 upstream current-rep epoch stability PR 이다.
standing/seated negative와 deep/standard path는 guardrail로 유지되며, broadening fix는 금지한다.
