# PR-8 — Official Shallow Timing & Rep-Epoch Integrity SSOT

## 문서 상태
이 문서는 현재 실기기 기준 활성 병목을 해결하기 위한 **최신 구현 기준 문서**다.

우선순위는 다음과 같다.
1. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md` ← 현재 구현 기준
2. `docs/PR-7-ULTRA-LOW-CORE-CLOSURE-INTEGRITY-SSOT.md` ← 이전 활성 분석 문서, 일부 유효
3. `docs/PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY-SSOT.md` ← 히스토리 보존용

즉 이번 구현은 반드시 **이 문서**를 최우선으로 따른다.

---

## 목적
이번 PR-8의 목표는 얕은 스쿼트를 다시 전부 막는 것이 아니다.
목표는 **`official_shallow_cycle`가 timing integrity와 fresh-rep epoch integrity 없이 닫히는 경로를 끊는 것**이다.

이번 PR은 다음을 동시에 해결해야 한다.
- 첫 시도 하강 중 통과
- 첫 시도 후 두 번째 하강 중 통과
- 서 있는 듯한 상태에서 통과
- 반복 shallow 후 stale-like 흔적으로 통과

즉 이번 PR은 단순 shallow stricter PR이 아니라,
**official shallow closer의 timing 무결성 + rep 경계 무결성 + proof/bridge 소비 순서 무결성**을 다시 잠그는 PR이다.

---

## 현재 문제의 진실
실기기 로그 기준 현재 false pass는 다시 다음으로 열리고 있다.
- `completionPassReason = official_shallow_cycle`
- `passOwner = completion_truth_event`
- `finalSuccessOwner = completion_truth_event`

즉 현재 문제는:
- product policy 문제 아님
- evaluator 문제 아님
- auto-progression UI gate 문제 아님
- PR-6 blanket ultra-low policy 문제 아님

현재 문제는 **canonical official shallow closer**가 너무 관대하게 닫히는 것이다.

---

## 현재 로그가 보여주는 반복 패턴
### 패턴 A — timing integrity 없는 official shallow close
관측:
- `minimumCycleDurationSatisfied = false`
- `cycleDurationMs`가 매우 짧음
- `eventCycleDetected = false`
- `eventCycle.notes = ["descent_weak"]`
- 그런데 최종 `completionPassReason = official_shallow_cycle`

이것은 official shallow closer가 **timing fault를 필수 blocker로 사용하지 않고 있음**을 뜻한다.

### 패턴 B — fresh rep 전 pre-attempt 오염이 later official close로 승격
관측:
- 초기 구간에서 `attemptStarted = false`
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `eventCycle.notes = ["freeze_or_latch_missing"]`

그런데 같은 흐름 후반에
- `officialShallowPathAdmitted = true`
- `officialShallowPathClosed = true`
- 최종 `official_shallow_cycle`

즉 pre-attempt / pre-freeze / pre-latch 상태의 흔적이
fresh rep 경계를 통과해 later official close 자격으로 재사용되고 있다.

### 패턴 C — proof/bridge가 integrity를 대체
반복 관측:
- `eventCycleDetected = false`
- `descentFrames = 0`
- `eventCycle.notes = ["descent_weak"]`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- 최종 `official_shallow_cycle`

즉 bridge / ascent-equivalent / closure proof가
**무결성 통과 후 보조 신호**가 아니라,
사실상 official closer를 여는 실질 입력으로 쓰이고 있다.

---

## 이번 PR의 핵심 진단
현재 병목은 세 줄로 요약된다.

1. **timing integrity가 official shallow closer의 필수 자격이 아니다**
2. **fresh-rep epoch 경계가 약해서 pre-attempt 오염이 later rep close로 흘러간다**
3. **bridge/proof가 integrity 이후 보조가 아니라 integrity 대체물처럼 소비된다**

---

## 반드시 유지해야 할 절대 진실
### 1. single-writer truth 유지
성공 writer는 여전히 분산되면 안 된다.

허용:
- completion truth flow
- canonical official shallow closer

금지:
- evaluator가 success 새로 쓰기
- auto-progression이 success 새로 쓰기
- policy layer가 success 새로 쓰기
- debug / proof / bridge / provenance 필드가 success writer처럼 동작하기

### 2. shallow 전체 rollback 금지
이번 PR은 얕은 스쿼트를 다시 전부 막는 PR이 아니다.

금지:
- blanket `ultra_low_rom_not_allowed`
- ultra-low 전체 봉쇄
- shallow whole rollback

허용:
- legitimate shallow ultra-low는 여전히 pass 가능

### 3. official shallow closer는 permissive fallback이 아니다
다음은 금지한다.
- standard path가 안 되니 official shallow로 열기
- proof signal이 있으니 official shallow로 열기
- bridge가 있으니 official shallow로 열기
- repeated stale shallow 흔적이 있으니 official shallow로 열기

`official_shallow_cycle`는 정식 completion truth closer여야 한다.

---

## 이번 PR-8의 핵심 목표
### 목표 1 — timing integrity를 official shallow closer의 필수 조건으로 승격
다음이면 official shallow closer 금지:
- `minimumCycleDurationSatisfied = false`
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- cycle duration이 짧은데 proof/bridge로 덮는 경우

즉 **timing fault는 proof로 상쇄할 수 없다.**

### 목표 2 — fresh-rep epoch integrity를 closer 입력에 명시
다음 history 위에서는 official shallow closer 금지:
- `attemptStarted = false`
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `freeze_or_latch_missing`

단, 중요한 점:
이 값들이 과거에 한 번 있었다고 영구 금지는 아니다.
문제는 **fresh rep epoch가 명확히 다시 열린 뒤의 신호만 current close에 사용해야 한다**는 것이다.

즉 current close는 반드시 current epoch 기준이어야 한다.

### 목표 3 — bridge/proof 보조화
다음은 assist role만 가능하다.
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`

이 값들은 아래를 통과한 뒤에만 쓸 수 있다.
- timing integrity
- fresh-rep epoch integrity
- explicit descent / attempt integrity
- anti-contamination integrity

즉 **proof/bridge는 마지막 보조이지, closer 자격증이 아니다.**

---

## official_shallow_cycle가 절대 열리면 안 되는 케이스
### A. timing-fault close
다음이면 official shallow closer 금지:
- `minimumCycleDurationSatisfied = false`
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `cycleDurationMs`가 너무 짧고 explicit timing integrity 없음

### B. weak-event close
다음 조합이면 official shallow closer 금지:
- `eventCycleDetected = false`
- `descentFrames = 0`
- `eventCycle.notes`에 `descent_weak`
- 그런데 bridge/proof만 있는 경우

### C. pre-attempt contamination close
다음 history를 가진 current 흐름이면 official shallow closer 금지:
- `attemptStarted = false`
- `not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `freeze_or_latch_missing`

단, fresh epoch가 분명히 재수립되고 그 이후 신호만 쓰인 것이 입증되면 예외 가능.

### D. stale repeated shallow close
다음은 금지:
- 첫 rep의 약한 흔적이 두 번째 rep close 자격으로 쓰임
- 반복 shallow 2~4회 후 현재 rep 하강 중 이전 stale signal로 official close

즉 official shallow closer는 **current rep epoch** 기준이어야 한다.

### E. proof-first close
다음은 금지:
- `officialShallowClosureProofSatisfied = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`

만으로 official close

### F. anti-contamination 우회 close
다음이면 금지:
- setup contamination
- series-start contamination
- provenance-only / trajectory-only split-brain
- canonical anti-false-pass가 막아야 할 것을 official closer가 먼저 여는 경우

---

## official_shallow_cycle가 열릴 수 있는 최소 무결성 계약
새 threshold를 발명하는 것이 아니라,
기존 truth를 더 정확하게 **순서화**해야 한다.

### 1. shallow admission integrity
- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`
- `attemptStarted === true`
- `descendConfirmed === true`
- `downwardCommitmentReached === true`

### 2. timing integrity (필수)
다음 모두 만족 필요:
- `minimumCycleDurationSatisfied === true`
- `descent_span_too_short` 아님
- `ascent_recovery_span_too_short` 아님

즉 timing integrity는 optional이 아니다.

### 3. fresh-rep epoch integrity (필수)
current rep close는 반드시 current rep epoch 기준이어야 한다.
최소 원칙:
- baseline frozen 이후의 rep
- peak latched 이후의 rep
- pre-attempt `not_armed` / `freeze_or_latch_missing` history가 current close 증거로 직접 승격되지 않음
- stale prior rep 흔적이 current official close로 소비되지 않음

### 4. cycle integrity
다음 중 하나는 있어야 한다.
- explicit enough current rep cycle truth
- 또는 sufficiently authoritative reversal/recovery truth

하지만 금지:
- `eventCycleDetected = false` + `descent_weak` + `descentFrames = 0` 상태에서 proof-only close

### 5. anti-contamination integrity
- setup contamination 없음
- series-start contamination 없음
- provenance-only / trajectory-only split-brain 없음
- canonical anti-false-pass clear

### 6. proof/bridge assist는 마지막
다음은 마지막 단계에서만 보조 입력 가능:
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`

즉 순서는 다음이다.
1. admission integrity
2. timing integrity
3. fresh-rep epoch integrity
4. cycle integrity
5. anti-contamination integrity
6. only then proof/bridge assist
7. only then official shallow closer may open

---

## 지금 미리 잠가야 할 다음 의심 병목
이번 PR 이후 또 터질 가능성이 높은 병목을 미리 잠근다.

### 의심 병목 1 — admission은 맞지만 rep epoch reset이 약한 경우
공식 shallow path admission이 열리는 순간 자체가 아직 current rep epoch를 충분히 반영하지 못할 수 있다.
따라서 PR-8에서는 **admission 이후 closer까지 가는 경로에서 current rep epoch 조건을 별도 필수 축으로 둬야 한다.**

### 의심 병목 2 — timing은 만족하지만 descent 질이 너무 약한 경우
`minimumCycleDurationSatisfied=true`만으로 부족할 수 있다.
특히 `descentFrames=0`, `descent_weak`, `eventCycleDetected=false` 조합은 timing만 맞아도 문제다.
따라서 PR-8 acceptance에 반드시
- timing ok but descent_weak only
- eventCycle false + bridge/proof only
를 막는 케이스를 넣는다.

### 의심 병목 3 — later standing hold가 과거 약한 cycle을 정당화하는 경우
standingRecoveredAtMs와 hold가 충분하더라도,
현재 rep의 descent integrity가 약하면 official close 금지다.
즉 **late standing hold는 earlier weak rep를 정당화하는 면허가 아니다.**

### 의심 병목 4 — canonical contract와 core path 사이의 느슨한 불일치
이번 PR은 official closer 레이어를 조이지만,
혹시 current rep epoch 관련 필드가 core path와 canonical contract 사이에서 다르게 해석되면 다시 구멍이 생길 수 있다.
따라서 PR-8은 가능하면
- contract input level에서 잠그고
- closer writer는 단순하게 유지한다.

### 의심 병목 5 — static success writer는 하나지만 logical writer가 둘처럼 동작하는 경우
writer 함수가 하나여도,
proof-first helper가 사실상 pass authorization을 하면 logical second writer가 된다.
따라서 PR-8에서는
**helper가 closer eligibility를 넘는 사실상의 authorization 역할을 하지 못하도록** 주석과 테스트로 못 박는다.

---

## 권장 구현 방향
가장 안전한 방향은 다음 둘 중 하나다.

### 방향 A — canonical contract input 강화
`buildCanonicalShallowContractInputFromState(...)` 수준에서
- timing integrity
- fresh-rep epoch integrity
- weak-event exclusion
- proof/bridge secondary-only
를 contract 입력에 명시한다.

권장 우선순위: 최상
이유:
- writer는 단순하게 유지 가능
- helper가 logical writer가 되는 것을 막기 쉬움
- regression 설명력이 좋음

### 방향 B — official closer eligibility helper 추가
writer 바로 직전에
`canCloseOfficialShallowCycle(...)` 같은 helper를 두고,
그 안에서 timing + epoch + contamination을 강제한다.

주의:
- helper가 사실상 second writer처럼 행동하지 않게 주석/테스트 필요
- writer는 여전히 마지막 단일 write만 하도록 유지

권장 우선순위: 차선

---

## 변경 범위
### 포함
- official shallow closer eligibility 강화
- timing integrity를 closer 필수 조건으로 승격
- fresh-rep epoch integrity 도입
- proof/bridge secondary-only 명시화
- regression/smoke에 아래 케이스 추가
  - first attempt descending false pass
  - second rep descending false pass
  - standing-like false pass
  - timing fault false pass
  - repeated shallow stale-signal false pass
  - timing ok but descent_weak/proof-only false pass

### 비포함
- PR-6 policy rollback
- completion core 전체 재설계
- evaluator 전체 재설계
- auto-progression 전체 재설계
- deep standard squat 재설계
- overhead reach 등 다른 동작 수정
- 숫자 threshold 땜빵

---

## 절대 금지
1. blanket `ultra_low_rom_not_allowed` 부활 금지
2. shallow 전체 rollback 금지
3. 새로운 success writer 추가 금지
4. evaluator가 completion truth 다시 쓰기 금지
5. auto-progression이 completion truth 다시 쓰기 금지
6. `minimumCycleDurationSatisfied = false`인데 proof로 official close 허용 금지
7. `descent_span_too_short`인데 official close 허용 금지
8. `ascent_recovery_span_too_short`인데 official close 허용 금지
9. `eventCycleDetected = false` + `descent_weak` + `descentFrames = 0`인데 proof-only official close 금지
10. `not_armed` / `freeze_or_latch_missing` history를 current rep close 자격으로 세탁 금지
11. repeated stale shallow 흔적으로 later official close 금지
12. deep standard success 회귀 금지
13. threshold 숫자만 만지는 땜빵 금지

---

## 완료 정의
이번 PR이 끝났다고 말하려면 아래가 모두 만족되어야 한다.

1. 첫 얕은 스쿼트 하강 중 official_shallow_cycle pass가 더 이상 열리지 않는다.
2. 첫 시도 후 두 번째 하강 중 official_shallow_cycle pass가 더 이상 열리지 않는다.
3. 서 있는 듯한 상태에서 official_shallow_cycle pass가 더 이상 열리지 않는다.
4. `minimumCycleDurationSatisfied = false`이면 official shallow closer가 열리지 않는다.
5. `descent_span_too_short`이면 official shallow closer가 열리지 않는다.
6. `ascent_recovery_span_too_short`이면 official shallow closer가 열리지 않는다.
7. `eventCycleDetected = false` + `descent_weak` + `descentFrames = 0`이면 proof/bridge가 있어도 official close가 열리지 않는다.
8. `attemptStarted = false` / `not_armed` / `freeze_or_latch_missing` history가 current rep close로 세탁되지 않는다.
9. repeated shallow stale-like 흔적으로 later rep official close가 열리지 않는다.
10. legitimate shallow ultra-low cycle은 여전히 통과 가능하다.
11. canonical closer 단일 writer 체계가 유지된다.
12. deep standard squat 회귀가 없다.

---

## 최종 원칙 한 줄
**이번 PR-8은 얕은 스쿼트를 다시 막는 PR이 아니라, `official_shallow_cycle`가 timing integrity와 current rep epoch integrity를 통과한 경우에만 열리도록 다시 잠그는 PR이다.**
