PR-SHALLOW-UPSTREAM-ARMING-PEAK-LATCH-ACQUISITION-01
SSOT Summary
Parent SSOT: SHALLOW DEVICE-REPLAY-FIRST SSOT — shallow 문제의 대표 truth는 synthetic이 아니라 raw device replay이며, 다음 PR은 downstream이 아니라 upstream signal/arming/reversal acquisition 한 층만 수정해야 한다
Purpose of this PR: 이번 PR은 shallow squat의 통과 의미를 재정의하거나 threshold를 전역 완화하는 PR이 아니다. 실기기 representative truth 기준으로, A-family(pre-attempt / not_armed / freeze_or_latch_missing) 에서 실제 얕은 rep가 attempt truth로 진입하지 못하는 upstream acquisition 병목만 고치는 PR이다.
Critical law: standing/seated negative와 shallow fail 다수가 같은 pre-attempt family에 붙어 있으므로, generic not_armed 완화나 broad arming 완화는 금지다. 얕은 실제 rep에서만 arming/peak latch가 잡히도록 만드는 방향만 허용된다. device_shallow_fail_01은 attemptStarted=false, completionBlockedReason=not_armed, peakLatched=false, freeze_or_latch_missing 계열이고 device_standing_01도 동일한 pre-attempt 계열로 남아 있다
1. Problem Statement

현재 shallow fail의 dominant representative truth는 downstream close failure가 아니라 upstream acquisition failure 다.

대표 shallow fail에서는 다음 패턴이 반복된다.

attemptStarted=false
completionBlockedReason=not_armed
baselineFrozen=false
peakLatched=false
peakLatchedAtIndex=0
eventCycle notes = freeze_or_latch_missing
pass-core blocked reason = peak_not_latched 또는 no_reversal_after_peak

대표 예시:

device_shallow_fail_01
device_shallow_fail_02
device_shallow_fail_03
device_shallow_fail_04

즉, 현재 제품 문제의 중심은
“official shallow path를 닫느냐 못 닫느냐” 이전에, 실제 shallow rep를 current-rep / attempt truth로 잡지 못한다 는 점이다.

2. Representative Truth Lock
2-1. Primary representative family (A-family, dominant)

다음 trace들은 이번 PR의 대표 진실이다.

device_shallow_fail_01
device_shallow_fail_02
device_shallow_fail_03
device_shallow_fail_04
device_shallow_fail_05
device_shallow_fail_06
device_shallow_fail_09
device_shallow_fail_10

이 family의 공통 의미는:

shallow candidate / descend signal은 보이지만, attempt truth가 열리지 않고 baseline freeze / peak latch provenance가 성립하지 않아 completion owner 진입 전 단계에서 죽는다.

2-2. Secondary guard family (C-family, do not solve in this PR)

다음 trace들은 보조 guard다.

device_shallow_fail_07
device_shallow_fail_08

이 둘은 이미

attemptStarted=true
officialShallowPathAdmitted=true
officialShallowStreamBridgeApplied=true
officialShallowClosureProofSatisfied=true
officialShallowReversalSatisfied=true

까지 갔지만 최종적으로 descent_span_too_short에 막힌다

즉 이 PR의 주 문제가 아니다.
이번 PR에서 span threshold를 전역 완화해서 이 둘까지 함께 해결하려 들면 scope violation이다.

2-3. Tertiary guard family (B-family, do not solve in this PR)
device_shallow_fail_11

이 trace는 attemptStarted=true, descendConfirmed=true지만 completionBlockedReason=no_reversal 로 막힌다

즉 reversal acquisition / ascent integrity 쪽 보조 문제이며, A-family 전용 PR의 주 타깃이 아니다.

3. Negative / Positive Guardrail Lock
Negative guard must remain blocked

다음 negative control은 이번 PR 이후에도 여전히 pass되면 안 된다.

device_standing_01
device_standing_02
device_seated_01
device_seated_02

이들의 핵심 의미는:

pre-attempt / not_armed 계열이 아직 negative guard 역할을 하고 있다는 점
따라서 shallow fail을 살리기 위해 generic arming 완화를 하면 곧바로 weird pass 재개방 위험이 있다는 점
Positive guard must remain passing

다음 deep pass는 계속 정상 통과해야 한다.

device_deep_01 — progressionPassed=true, finalPassLatched=true, completionPassReason=standard_cycle, depthBand=deep
device_deep_02 — 동일하게 standard deep path가 정상 통과한다

즉 deep/standard path regression은 절대 허용되지 않는다.

4. Exact Scope

이번 PR은 오직 아래 한 층만 다룬다.

shallow pre-attempt → attempt truth 진입 조건
current-rep arming acquisition
baseline freeze acquisition timing
peak latch provenance / anchor acquisition
“실제 shallow rep의 early descend + commitment signal”이 standing/seated noise와 분리되도록 하는 upstream gating

정확한 목적은 다음 한 줄이다.

실제 shallow rep에서만 attemptStarted / baselineFrozen / peakLatched가 truthfully 열리게 만든다.

5. Non-goals

이번 PR은 아래를 다루면 실패다.

authority-law 변경
completion-owner only opener law 변경
pass-core를 opener로 되돌리는 변경
registry grant path 추가
UI latch / final pass surface semantics 변경
deep / standard cycle 의미 변경
broad threshold sweep
global descent_span 완화
global reversal_span 완화
descent_span_too_short를 이번 PR에서 해결하려는 시도
no_reversal family를 이번 PR에서 함께 해결하려는 시도
6. Why This PR Exists

현재 device replay는 “얕은 스쿼트가 왜 막히는가”를 두 층으로 보여준다.

주 병목: A-family에서 rep가 attempt truth로 아예 올라오지 못함
(not_armed, freeze_or_latch_missing, peak_not_latched)
보조 병목: 일부 trace는 이미 admitted 이후까지 가지만 span/no-reversal에서 막힘
(device_shallow_fail_07, 08, 11)

따라서 지금 필요한 것은 “shallow 전체를 한 번에 살리는 broad fix”가 아니라,
dominant A-family만 고치는 narrow upstream PR 이다.

7. Implementation Law

구현은 아래 방향만 허용된다.

shallow rep 후보에서
downwardCommitmentReached + descend signal + non-standing trajectory가 있을 때
attempt truth 진입을 더 truthfully 잡는다
peak anchor는 series-start / stale anchor 가 아니라
committed-or-post-commit peak provenance 에 묶어야 한다
baseline freeze / peak latch는 standing/seated negative에서도 동일하게 열리면 안 된다
해결 방식은 “더 빨리 열기”가 아니라
실제 shallow rep일 때만 올바르게 열기 여야 한다
8. Proof / Replay Requirements

이번 PR은 아래 replay fixture를 mandatory로 잠가야 한다.

Mandatory primary truth
shallow A-family representative set
fail_01
fail_02
fail_03
fail_04
fail_05
fail_06
fail_09
fail_10
Mandatory negative set
standing_01
standing_02
seated_01
seated_02
Mandatory positive set
deep_01
deep_02
Secondary non-regression set
shallow_fail_07
shallow_fail_08
shallow_fail_11

중요:

secondary set은 이번 PR에서 반드시 pass로 바꾸는 목표가 아니다
대신 이번 PR로 인해 secondary set semantics가 더 악화되거나 weird pass가 생기면 실패다
9. Acceptance Criteria

이번 PR이 성공이려면 최소 아래를 만족해야 한다.

Must improve
A-family representative traces에서
attemptStarted
baselineFrozen
peakLatched
current-rep provenance
중 적어도 하나 이상의 upstream truth가 실제 shallow rep에 맞게 개선되어야 한다
단, 이 개선은 standing/seated에도 같이 열리면 안 된다
Must not regress
standing negative pass 금지
seated negative pass 금지
deep standard path 유지
pass-core / authority-law / registry / UI latch 의미 변화 금지
Explicit failure conditions
generic not_armed 완화
standing/seated negative가 attempt truth로 같이 열림
deep pass regression
C-family/B-family까지 한 PR에서 같이 해결하려고 scope를 넓힘
10. Final Lock Sentence

이번 PR은 shallow squat의 통과 semantics를 다시 정의하는 PR이 아니다.
이번 PR은 device replay 기준 dominant A-family(pre-attempt / not_armed / freeze_or_latch_missing) 만 대표 truth로 삼아, 실제 shallow rep가 upstream acquisition 단계에서 attempt truth로 진입하지 못하는 병목만 고치는 PR이다.
standing/seated negative와 deep standard path는 guardrail로 함께 잠기며, broadening fix는 금지한다.