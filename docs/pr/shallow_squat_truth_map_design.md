# PR-DESIGN — Shallow Squat 10/10 Easy Pass, Zero Weird Pass

## 목적

실기기 기준으로 다음 두 가지를 동시에 만족시키는 설계 잠금 문서를 만든다.

1. **얕은 스쿼트는 10번 중 10번 쉽게 통과**
2. **서 있기 / 앉아 있기 / 앉았다가 이상하게 통과 / motion 없는 false pass는 절대 불가**

이 문서는 threshold 숫자 하나를 임시로 바꾸는 문서가 아니다.  
현재 로그가 보여준 구조적 병목을 **admission / closure / final owner / semantics / false-pass guard** 단위로 다시 정렬하는 설계 문서다.

---

## 실기기 로그 기반 핵심 결론

이번 업로드 로그들은 “얕은 스쿼트가 못 통과하는 이유”가 하나가 아님을 보여준다.

### A. 얕은 스쿼트가 아예 시작도 못 하는 체인
대표 증상:

- `completionBlockedReason = not_armed`
- `officialShallowPathAdmitted = false`
- `peakLatched = false`
- `baselineFrozen = false`
- `passBlockedReason = peak_not_latched` 또는 `no_reversal_after_peak`
- `eventCycle.notes = freeze_or_latch_missing`

즉, **실제 shallow motion은 관측되었는데 owner가 읽는 attempt truth가 열리지 않는다.**

### B. admission은 됐는데 closure에서 죽는 체인
대표 증상:

- `officialShallowPathAdmitted = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowStreamBridgeApplied = true`
- 그런데도 `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short` 또는 `ascent_recovery_span_too_short`

즉, **shallow 전용 진입은 성공했는데 standard completion에서 쓰던 시간/프레임 span 규칙이 그대로 잔존해 shallow를 다시 막는다.**

### C. completion 쪽은 사실상 완료인데 pass-core owner가 또 막는 체인
대표 증상:

- `descendConfirmed = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `completionBlockedReason = null` 또는 shallow 전용 closure proof 성립
- 그런데 `pass_core_truth.squatPassCore.passDetected = false`
- `passBlockedReason = no_standing_recovery` 또는 `no_reversal_after_peak`
- `uiProgressionAllowed = false`

즉, **completion truth와 pass-core truth가 서로 다른 세계를 보고 있다.**

### D. standing / seated false-pass를 막는 규칙은 살아 있는데, 그 규칙이 shallow 성공도 같이 억누르는 체인
대표 증상:

- standing/seated 로그에서도 `officialShallowPathAdmitted = true`까지는 올라갈 수 있음
- 하지만 `officialShallowPathClosed = false`, `passDetected = false`, `finalPassEligible = false`
- 즉 false pass 방어는 어느 정도 동작하지만,
- **그 방어 규칙이 shallow 10/10 통과에 필요한 “짧은 ROM의 정상 완료”까지 같은 bucket으로 눌러버린다.**

---

## 구조적 원인 정리

이 문제는 단일 threshold 문제가 아니다. 최소 아래 6개의 구조적 원인이 동시에 있다.

### 원인 1. `shallow observed` 와 `owner-admissible attempt` 가 분리되어 있음
현재 로그에는 shallow observation은 계속 뜬다. 그러나 그 즉시 owner가 사용할 수 있는 attempt truth로 승격되지 못한다.  
결과적으로 shallow는 보였는데도 `not_armed`, `peak_not_latched` 단계에서 멈춘다.

**핵심 문제:**  
관측(read)과 통과 소유(owner) 사이에 승격 레이어가 하나 더 있고, 여기서 shallow가 낙오한다.

---

### 원인 2. shallow 전용 admission 후에도 standard completion span 규칙이 남아 있음
`officialShallowPathAdmitted = true`와 `officialShallowClosureProofSatisfied = true`가 떴는데도 `descent_span_too_short`로 막힌다.

이건 사실상 의미가 명확하다.

- shallow 전용 path는 “짧아도 정상적인 rep”를 다루려는 path
- 그런데 closure 판단은 여전히 standard span 규칙에 지배됨

즉, **shallow path를 열어놓고 마지막 문은 standard path가 닫고 있다.**

---

### 원인 3. completion truth와 pass-core truth의 owner authority가 분리되어 있음
로그상 어떤 케이스는 completion 쪽 기준으로는 `descend/reversal/recovery`가 모두 true다.  
그런데 pass-core는 `no_reversal_after_peak` 또는 `no_standing_recovery`로 막는다.

이는 shallow pass의 최종 owner가 1명이어야 하는데,
현실은 아래처럼 되어 있음을 뜻한다.

- completion state owner
- pass-core owner
- UI gate owner
- final latch owner

이들이 **동일 truth를 읽지 않고**, shallow에서만 서로 미세하게 다른 failure semantics를 낸다.

---

### 원인 4. false-pass 차단 규칙이 “motion absence 차단”이 아니라 “short motion 전반 차단”으로 작동함
standing/seated를 막으려면 사실 필요한 것은 아래뿐이다.

- 실제 하강 존재
- 하강 이후 방향 전환 존재
- 전환 이후 회복 존재
- pass 순간 still seated 아님
- near-standing/standing recovery 확보

그런데 현재는 여기에 더해
- peak latch 강제
- frame span 강제
- standard reversal streak 강제
- standard standing threshold 강제

같은 표준 딥/노말 ROM 기준이 shallow에도 깊게 들어와 있다.

그래서 **standing/seated를 막는 대신 shallow도 같이 죽는다.**

---

### 원인 5. shallow path의 “closure semantics”가 분명하지 않다
현재 shallow에서 필요한 진짜 closure는 다음이어야 한다.

- enough descent to count as intentional squat-like motion
- clear directional reversal after that descent
- meaningful upward return / recovery
- pass 순간 seated pose 아님
- pass 순간 standing recovery 또는 near-standing recovery 증거 있음

그런데 현재는
- descent span
- reversal streak
- standing hold
- peak latch
- eventCycle frame count
- standard owner veto

등이 섞여서 **무엇이 shallow pass의 본질 요건인지가 흐려져 있다.**

---

### 원인 6. pass는 쉽게 / 판정은 엄격하게가 엔진 레벨에서 완전히 분리되지 않았다
원칙상 아래처럼 나뉘어야 한다.

- **Pass gate**: 정상 완료인지
- **Quality/interpretation**: 얼마나 좋았는지
- **False-pass guard**: motion absence / seated / standing cheat인지

하지만 지금은 일부 quality-like or robustness-like 조건이 pass gate에 섞여 있다.  
결과적으로 “이상한 통과를 막으려던 보수성”이 “얕은 스쿼트 통과 자체”를 누른다.

---

## 이번 로그에서 잠가야 할 Truth Map

### 1. Observation Truth
카메라가 읽은 현상.
- shallow band depth 관측
- descend detected
- downward commitment
- reversal tendency
- recovery tendency

### 2. Admission Truth
“이 움직임을 shallow squat attempt로 인정할 것인가”
- shallow band depth 충족
- readiness 이후 시작
- intentional descent 존재
- standing still / idle 노이즈 아님

### 3. Closure Truth
“이 shallow attempt가 완료됐는가”
- descent confirmed
- reversal confirmed
- recovery confirmed
- seated-at-pass false
- standing/near-standing recovery true

### 4. Final Pass Owner
최종 pass 여부는 **오직 closure truth 1개 owner**가 결정.
- pass-core / UI / final latch는 이 owner의 sink만 됨
- shallow에서 추가 veto 금지

### 5. Quality Truth
통과 후 별도 판정.
- shallow
- low quality
- asymmetry
- bottom weak
- hard partial
- mobility/control limitation

### 6. False-pass Guard Truth
통과 자체를 영구 차단하는 조건.
- no real descent
- no real reversal
- no real recovery
- still seated at pass
- standing still / jitter / seated hold
- setup motion / framing cheat

---

## 설계 원칙

### 원칙 1. shallow 전용 owner를 만든다
shallow는 standard owner의 약화판이 아니라, **독립 owner**여야 한다.

### 원칙 2. shallow admission과 shallow closure를 분리한다
- admission: “이걸 시도라고 볼 수 있나”
- closure: “시도가 끝났나”

둘을 하나의 span 규칙으로 묶지 않는다.

### 원칙 3. final pass authority는 하나만 둔다
`completion_truth_shallow_official` 같은 단일 owner가 pass 여부를 결정해야 한다.

### 원칙 4. false pass 금지 규칙은 motion absence 전용으로 유지한다
standing/seated를 막기 위한 규칙은 유지하되,  
그 규칙이 shallow의 짧은 정상 cycle까지 막지 않도록 의미를 좁힌다.

### 원칙 5. quality downgrade는 통과 후로 보낸다
shallow + hard_partial + asymmetry + bottom weak는 통과 후 판정 문제이지,  
정상적인 얕은 rep 자체를 실패시킬 이유가 아니다.

---

## 새 구조 제안: Official Shallow Pass Owner

## A. Admission 조건
다음을 만족하면 shallow owner에 admit:

1. readiness satisfied 이후 시작
2. relativeDepthPeak 가 shallow band 범위
3. intentional descent 존재
4. standing-still / seated-hold / setup motion 아님

여기서 **peak latch / standard frame span / standard reversal streak를 admission 조건으로 쓰지 않는다.**

---

## B. Closure 조건
admitted 된 shallow attempt는 아래 중 하나로 close 가능:

### Closure Path S1 — Strict Shallow Cycle
- descend confirmed
- reversal confirmed
- recovery confirmed
- pass moment seated false
- near-standing or standing-recovery true

### Closure Path S2 — Shallow Ascent Equivalent
- descend confirmed
- directional reversal confirmed
- upward return magnitude sufficient
- pass moment seated false
- recovery proof 확보

이 Path S2는 “깊게 올라오진 않았지만 정상적인 상향 복귀가 확인된 얕은 squat”용이다.

---

## C. 영구 금지 조건
다음 중 하나면 shallow owner는 절대 close 금지:

1. no descent
2. no reversal
3. no recovery
4. still seated at pass
5. standing still / jitter only
6. setup-motion-blocked
7. seated hold without upward recovery

즉, **얕아도 되지만, rep cycle이 없는 건 절대 안 된다.**

---

## D. Final Owner Sink Rule
아래를 강제로 잠근다.

- `officialShallowPathClosed == true` 이고 false-pass guard 위반이 없으면
  - `completionOwnerPassed = true`
  - `uiProgressionAllowed = true`
  - `finalPassEligible = true`
- 이 이후 `peak_not_latched`, `no_reversal_after_peak`, `descent_span_too_short`, `no_standing_recovery` 같은
  **표준 path veto가 shallow owner를 다시 뒤집는 것을 금지**

즉, shallow owner가 close하면 거기서 끝이다.

---

## 제거/격리해야 할 현재 병목

### 제거 1. shallow finalization에서 `descent_span_too_short` veto 제거
이건 shallow 전용 path의 존재 이유와 충돌한다.

### 제거 2. shallow finalization에서 `peak_not_latched` 재차 veto 제거
peak latch는 robust anchor 용 보조 정보이지 shallow rep 존재의 본질이 아니다.

### 제거 3. shallow finalization에서 standard `no_reversal_after_peak` 재차 veto 제거
shallow는 reversal을 자체 truth로 이미 확인했으면 standard peak-based reversal veto를 다시 쓰면 안 된다.

### 제거 4. shallow finalization에서 standard standing hold 강제 제거
필요한 것은 “의미 있는 회복”이지, deep standard에서 쓰던 standing hold를 강제하는 게 아니다.

### 격리 5. eventCycle / frame count는 false-pass 참고 신호로만 사용
owner authority가 아니게 한다.

---

## 남겨야 할 안전장치

이상 통과를 막기 위해 아래는 반드시 유지한다.

1. `stillSeatedAtPass == false`
2. pass 순간 `currentDepth`가 seated pose에 머물러 있지 않을 것
3. reversal 이후 upward return magnitude가 최소 기준 이상일 것
4. descent 없는 standing drift는 reject
5. jitter / single-frame spike reject
6. setup motion blocker 유지
7. ready 이전 성공 금지

---

## acceptance matrix

### 반드시 PASS
1. shallow but intentional descend → reversal → recovery
2. low ROM user의 1회 얕은 정상 squat
3. shallow + quality low + asymmetry 있어도 rep cycle이 완성되면 pass

### 반드시 FAIL
1. standing only
2. seated hold
3. 앉아 있다가 미세 흔들림
4. 하강만 있고 reversal 없음
5. reversal 비슷해도 recovery 없음
6. pass 순간 still seated
7. setup motion / framing cheat

---

## 실기기 로그를 기준으로 본 정밀 해석

### 그룹 A — 얕은 스쿼트가 pre-attempt에서 죽는 케이스
공통 신호:
- shallow band 관측
- descend detected
- 그런데 `not_armed`
- `peakLatched = false`
- `baselineFrozen = false`
- `officialShallowPathAdmitted = false`

해석:
- shallow는 보였지만 owner admission이 너무 늦게 열리거나 아예 안 열린다.

필요 조치:
- shallow observation → official shallow admission 경로를 승격
- admission이 열린 뒤에만 false-pass guard로 차단

---

### 그룹 B — admission 후 closure 직전 차단 케이스
공통 신호:
- `officialShallowPathAdmitted = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowStreamBridgeApplied = true`
- 그런데 `officialShallowPathClosed = false`
- `descent_span_too_short` 또는 `ascent_recovery_span_too_short`

해석:
- shallow path를 열어놓고 standard completion veto가 다시 닫는다.

필요 조치:
- shallow owner close 이후 standard span veto 금지

---

### 그룹 C — completion 신호는 충분한데 pass-core가 다시 거부하는 케이스
공통 신호:
- `descendConfirmed = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- completion side blocked 없음 또는 얕은 closure proof 있음
- 그런데 pass-core는 `no_standing_recovery`, `no_reversal_after_peak` 등으로 막음

해석:
- owner authority가 다중화되어 있다.

필요 조치:
- final owner를 completion truth 하나로 단일화

---

### 그룹 D — standing / seated 케이스
공통 신호:
- 때때로 shallow admission 근처까지 올라감
- 하지만 final pass는 끝내 안 열림

해석:
- false-pass guard는 어느 정도 살아 있다.
- 문제는 그 guard가 shallow success path와 분리되어 있지 않다는 점.

필요 조치:
- standing/seated 차단 규칙을 “cycle absence 차단”으로 재정의
- shallow success closure와 직교하게 분리

---

## 구현 PR 권장 분할

### PR-1. Shallow Owner Authority Freeze
- shallow final owner 1개 정의
- sink/UI/final latch는 이 owner만 읽게 정렬

### PR-2. Official Shallow Admission Promotion
- shallow observed → admitted 승격 경계 명시
- `not_armed` 과잉 차단 제거

### PR-3. Official Shallow Closure Rewrite
- `descent_span_too_short`, `ascent_recovery_span_too_short`를 shallow final veto에서 제거
- shallow closure를 rep-cycle truth 중심으로 재정의

### PR-4. False Pass Guard Lock
- standing / seated / stillSeatedAtPass / no descent / no reversal / no recovery를 독립 hard fail guard로 잠금

### PR-5. Regression Harness Lock
- shallow 10개 must-pass
- standing 2개 must-fail
- seated 2개 must-fail
- deep 2개 must-pass
- owner mismatch 불가 assertion 추가

---

## 반드시 추가해야 할 회귀 잠금

### must-pass
- device_shallow_fail_01 ~ 11 중 정상 shallow rep 로그들
- 최종 목표: 이 파일군이 더 이상 fail fixture가 아니라 pass fixture로 승격되어야 함

### must-fail
- device_standing_01
- device_standing_02
- device_seated_01
- device_seated_02

### still required pass
- device_deep_01
- device_deep_02

---

## 잠금 assertion

1. shallow must-pass fixture에서  
   `officialShallowPathAdmitted == true`
2. shallow must-pass fixture에서  
   `officialShallowPathClosed == true`
3. shallow must-pass fixture에서  
   `completionOwnerPassed == true`
4. shallow must-pass fixture에서  
   `uiProgressionAllowed == true`
5. shallow must-pass fixture에서  
   `finalPassEligible == true`
6. shallow must-pass fixture에서  
   `stillSeatedAtPass == false`
7. standing/seated fixture에서  
   `finalPassEligible == false`
8. standing/seated fixture에서  
   `finalPassLatched == false`
9. 모든 shallow must-pass fixture에서  
   `standard owner veto`가 shallow owner close를 뒤집지 못함
10. 모든 fixture에서  
   pass/quality semantics 분리 유지

---

## CODEX ASK용 최종 지시문

아래 그대로 ASK에 넣어도 된다.

---
현재 실기기 JSON 기준으로 shallow squat pass 구조를 재설계하라.

목표는 단 하나다.

1. 얕은 스쿼트는 10번 중 10번 쉽게 통과
2. standing / seated / seated-hold / weird false pass는 절대 불가

중요:
- 단일 threshold 수정 제안 금지
- 원인을 admission / closure / final owner / false-pass guard / quality 분리 관점에서 구조적으로 분석하라
- 현재 shallow failure는 하나의 원인이 아니라 다중 owner/closure 충돌이라는 전제로 truth map을 작성하라
- 특히 아래 현상을 정확히 설명하라:
  - shallow observed인데 not_armed / peak_not_latched에서 죽는 케이스
  - officialShallowPathAdmitted + closureProofSatisfied인데 descent_span_too_short로 다시 죽는 케이스
  - completion side truth와 pass-core truth가 서로 다른 blocked reason을 내는 케이스
  - standing/seated를 막는 규칙이 shallow success도 같이 눌러버리는 구조
- 제안은 반드시 다음 5개 레이어로 정리:
  - observation truth
  - admission truth
  - closure truth
  - final pass owner
  - false-pass guard
- shallow owner가 close하면 standard veto가 다시 뒤집지 못하게 하는 owner freeze 설계를 포함하라
- pass는 쉽게, quality 판정은 엄격하게 분리하라
- must-pass / must-fail fixture matrix와 assertion까지 포함하라

출력 형식:
- Root Cause Map
- Truth Map
- Owner Architecture
- False Pass Guard
- PR split plan
- Regression lock matrix
---

## 최종 결론

지금 문제의 본질은 “얕은 스쿼트 threshold가 너무 높다”가 아니다.

본질은 아래다.

- shallow 관측은 되는데 admission이 늦다
- admission 후에도 standard closure veto가 다시 막는다
- completion truth와 pass-core truth가 서로 다른 owner를 가진다
- false-pass guard가 shallow success path와 직교하지 않는다

즉, **얕은 스쿼트용 단일 owner와 closure semantics가 아직 완전히 잠기지 않았다.**

이걸 해결하는 방법은 shallow를 더 느슨하게 만드는 게 아니라,
**shallow 정상 rep의 존재 조건**과 **이상 통과 금지 조건**을 완전히 분리해서
최종 pass owner를 하나로 고정하는 것이다.
