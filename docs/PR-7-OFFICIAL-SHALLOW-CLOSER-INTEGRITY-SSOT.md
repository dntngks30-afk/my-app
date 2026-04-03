# PR-7 — Official Shallow Closer Integrity SSOT

## 목적
이 문서는 PR-6 이후 실기기에서 드러난 신규 병목을 해결하기 위한 PR-7의 단일 진실 문서다.

이번 PR의 목표는 얕은 스쿼트를 다시 막는 것이 아니다.
목표는 **official_shallow_cycle closer가 너무 쉽게 닫히는 구조를 바로잡아, 의미 없는 ultra-low / standing-like / too-short / contaminated cycle이 completion truth로 통과하지 못하게 하는 것**이다.

이 문서는 다음을 강하게 고정한다.
- 이번 병목의 주 원인은 product policy가 아니라 **canonical official_shallow closer**다.
- `official_shallow_cycle`는 여전히 single-writer truth 체계 안에 있어야 한다.
- PR-7은 policy rollback PR이 아니다.
- PR-7은 `official_shallow_cycle`가 열리는 **최소 무결성 계약**을 다시 잠그는 PR이다.

---

## 현재 문제의 진실
PR-6 이후 실기기 로그에서 다음 패턴이 관측되었다.

### 관측된 이상 증상
- 앉자마자 바로 통과
- 서 있는데 통과
- timing상 너무 짧은 ultra-low인데 official shallow cycle로 닫힘

### 로그가 보여주는 핵심
최종 통과는 다음 레이어에서 열렸다.
- `completionPassReason = official_shallow_cycle`
- `passOwner = completion_truth_event`
- `finalSuccessOwner = completion_truth_event`

즉 현재 잘못된 통과는:
- UI gate 문제 아님
- auto-progression 문제 아님
- product policy 문제 아님
- **completion truth 자체가 너무 일찍 열리는 문제**다

### 특히 위험한 관측 조합
아래가 동시에 존재하는데도 official_shallow_cycle이 열렸다.
- `eventCycleDetected = false`
- `minimumCycleDurationSatisfied = false`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- 최종 `completionPassReason = official_shallow_cycle`

또는 초기 구간에서:
- `attemptStarted = false`
- `completionBlockedReason = not_armed`
였던 흐름이 같은 세션 후반에 official_shallow_cycle로 닫혔다.

즉 현재 구조는 **stream bridge + ascent-equivalent + closure proof만으로 too-short / weak / contaminated ultra-low를 official shallow closer가 소비할 수 있는 상태**다.

---

## 왜 PR-1~PR-6 SSOT가 있었는데도 터졌는가
이전 SSOT들이 잠근 것은 주로 아래였다.
- single-writer truth
- evaluator/auto-progression boundary
- product policy scope
- ultra-low blanket ban 해제 범위

그러나 아직 충분히 잠기지 않은 것은 이것이다.
- **official_shallow_cycle가 열릴 수 있는 최소 무결성 계약**

즉 PR-6이 문제를 만든 것이 아니라,
PR-6이 blanket policy block을 걷어내면서 원래 존재하던 **과도하게 관대한 official shallow closer**가 드러난 것이다.

---

## 이번 PR의 본질
이번 PR은 shallow policy PR이 아니다.
이번 PR은 closer integrity PR이다.

정확히는:
- `applyUltraLowPolicyLock`를 다시 강화하는 PR이 아님
- `official_shallow_cycle` closer가 어떤 경우 절대 열리면 안 되는지 다시 잠그는 PR
- stream bridge / ascent-equivalent / closure proof가 있어도 **무결성 계약이 부족하면 official closer가 열리지 않게 하는 PR**

---

## 유지해야 할 절대 진실
### 1. single-writer truth 유지
계속 하나의 성공 writer만 허용한다.

허용:
- canonical official shallow closer

금지:
- evaluator가 success를 새로 만들기
- auto-progression이 success를 새로 만들기
- policy layer가 success를 새로 만들기
- debug / trace / provenance / stream bridge가 success writer처럼 동작하기

### 2. official_shallow_cycle는 permissive fallback이 아니다
다음은 금지한다.
- standard_cycle이 안 되니까 official_shallow_cycle로 대신 열기
- ultra-low라서 policy가 풀렸으니 official_shallow_cycle로 열기
- trajectory / stream bridge / ascent-equivalent만 있으면 official_shallow_cycle로 열기

official_shallow_cycle는 **정식 completion truth closure**여야 한다.

### 3. stream bridge는 closure 보조이지 성공 면허가 아니다
`officialShallowStreamBridgeApplied === true`는
- 역전/상승 증거 보강
- shallow closure 증거 보강
을 의미할 수는 있어도,
그 자체로 official closer를 열어서는 안 된다.

### 4. ascent-equivalent는 explicit cycle integrity를 대체할 수 없다
`officialShallowAscentEquivalentSatisfied === true` 하나만으로는 insufficient 하다.
이 값은 보조 증거일 뿐이며,
arming / timing / recovery / anti-contamination truth를 대체할 수 없다.

### 5. closure proof는 integrity gate를 통과한 뒤에만 의미가 있다
`officialShallowClosureProofSatisfied === true`여도,
그 proof가 다음을 통과하지 못하면 official closer 금지다.
- attempt integrity
- timing integrity
- recovery integrity
- anti-contamination integrity

즉 proof는 마지막 번들이지, 무결성 부족을 덮는 면책권이 아니다.

---

## PR-7의 핵심 목표
`official_shallow_cycle`가 열리는 최소 조건을 다시 정의한다.

현재 잘못된 구조:
- shallow candidate/admission
- stream bridge / ascent-equivalent / closure proof
- canonical contract satisfied
- closer open

PR-7 이후 목표 구조:
- shallow candidate/admission
- integrity gate satisfied
- then bridge/proof can contribute
- only then canonical closer may open official_shallow_cycle

즉 official shallow closer는 다음 순서를 따라야 한다.
1. admission truth
2. integrity truth
3. closure proof truth
4. canonical closer write

---

## official_shallow_cycle가 절대 열리면 안 되는 케이스
다음 케이스는 어떤 보조 증거가 있어도 official shallow closer가 열리면 안 된다.

### A. arming / admission 무결성 부족
- `not_armed`
- attemptStarted가 늦게 열렸더라도 실제 admission integrity가 부족한 경우
- series-start contamination / freeze-or-latch missing으로 시작한 경우

### B. timing 무결성 부족
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `minimumCycleDurationSatisfied = false` 이고 이를 대체할 정식 integrity bundle이 없는 경우

### C. explicit cycle 무결성 부족
- true cycle 없이 bridge/proof만 있는 경우
- eventCycle이 없고, 그 absence를 대체할 정식 canonical integrity bundle도 없는 경우
- standing-like posture + tiny dip + quick recovery류

### D. anti-contamination 부족
- setup-motion contamination
- series-start contamination
- peak-at-series-start contamination
- provenance-only / trajectory-only / stream-only 구조

### E. early blocker residual 존재
다음 계열이 남아 있으면 official closer 금지다.
- `not_armed`
- `no_descend`
- `no_commitment`
- `no_reversal`
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `not_standing_recovered`
- finalize/recovery integrity 미충족 계열

핵심은:
**official_shallow_cycle는 early blocker를 “나중에 proof로 덮어쓰는 경로”가 되어선 안 된다.**

---

## official_shallow_cycle가 열릴 수 있는 최소 무결성 계약
새 threshold를 덧붙이는 것이 아니라, 기존 truth를 더 정확히 조합해야 한다.

최소한 아래 축이 모두 만족되어야 한다.

### 1. admission integrity
- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`
- `attemptStarted === true`
- `descendConfirmed === true`
- `downwardCommitmentReached === true`
- admission family blocker 없음

### 2. cycle integrity
다음 중 하나가 필요하다.
- canonical-authoritative reversal/recovery truth가 완전하게 존재
- 또는 이를 대체하는 **공식적으로 승인된** shallow integrity bundle 존재

하지만 금지:
- provenance-only
- stream-only
- ascent-equivalent only
- trajectory-only

### 3. timing integrity
official shallow closer는 timing fault를 무시하면 안 된다.
최소 원칙:
- `descent_span_too_short` 상태에서는 closer 금지
- `ascent_recovery_span_too_short` 상태에서는 closer 금지
- minimum cycle duration 계열이 미충족인데 이를 덮는 synthetic close 금지

### 4. recovery / finalize integrity
- standing/finalize truth 존재
- recovery chain 존재
- low/ultra-low guarded finalize를 쓰더라도 그것이 timing/arming fault를 면제하지 않음

### 5. anti-false-pass integrity
- setup contamination 없음
- peak series-start contamination 없음
- provenance-only / trajectory-only split-brain 없음
- canonical anti-false-pass clear

### 6. closure proof integrity
마지막에만 허용:
- `officialShallowClosureProofSatisfied === true`

하지만 이 값은 앞선 integrity 축을 모두 통과한 경우에만 공식 closer 입력으로 쓸 수 있다.

---

## PR-7에서 가장 중요한 원칙
### 공식 closer 입력은 “proof signals”가 아니라 “integrity-screened proof signals”여야 한다
지금 문제는 canonical closer가 아래를 그대로 먹는 데 있다.
- stream bridge
- ascent-equivalent
- closure proof

PR-7 이후에는 closer가 이런 식으로 읽으면 안 된다.

해야 할 것:
- closer 또는 canonical contract 입력 단계에서
  `official_shallow_cycle`가 열릴 수 있는 **integrity-screened condition**을 별도로 명시
- proof signal이 있어도 early blocker / timing blocker / contamination blocker가 있으면 closer 금지

즉 **proof는 마지막 단계여야지, integrity보다 먼저 오면 안 된다.**

---

## 권장 구현 방향
좋은 PR-7은 대체로 아래 중 하나여야 한다.

### 방향 A — canonical contract 입력 강화
`buildCanonicalShallowContractInputFromState()` 또는 canonical contract 입력 빌더에서
closer가 소비할 shallow closure 조건에 다음을 포함한다.
- timing integrity
- anti-contamination integrity
- non-provenance-only integrity
- no early blocker residual

### 방향 B — closer gate 강화
`applyCanonicalShallowClosureFromContract()` 직전에
official_shallow_cycle 전용 integrity guard를 둔다.
단, 새 writer를 만들면 안 된다.

권장 우선순위는 A > B 이다.
이유:
- closer는 writer이므로 단순해야 한다.
- shallow closure의 eligibility/integrity는 canonical contract 입력 또는 contract 결과에서 잠그는 편이 구조적으로 더 안전하다.

---

## 변경 범위
### 포함
- canonical shallow contract input 강화
- canonical shallow closer eligibility/integrity 강화
- official shallow stream bridge / ascent-equivalent / closure proof의 closer 소비 조건 명시화
- regression/smoke에 “standing-like / too-short / official shallow false pass” 케이스 추가

### 비포함
- PR-6 policy rollback
- evaluator 전체 재설계
- auto-progression 전체 재설계
- deep standard squat 재설계
- overhead reach 등 다른 동작 수정
- 임시 threshold patch 남발

---

## 절대 금지
1. 얕은 스쿼트를 다시 통째로 막는 blanket rollback 금지
2. `ultra_low_rom_not_allowed`를 다시 blanket하게 되살리는 것 금지
3. 새로운 success writer 추가 금지
4. evaluator가 completion truth 다시 쓰기 금지
5. auto-progression이 completion truth 다시 쓰기 금지
6. stream bridge만으로 official closer 허용 금지
7. ascent-equivalent only로 official closer 허용 금지
8. timing blocker를 proof로 덮는 구조 금지
9. provenance-only / trajectory-only를 official closer 입력으로 승격 금지
10. setup/series-start contamination 방어 약화 금지
11. deep standard success 회귀 금지
12. 단순 threshold 패치로 억지 봉합 금지

---

## 완료 정의
PR-7이 끝났다고 말하려면 아래가 모두 만족되어야 한다.

1. 앉자마자 바로 pass가 더 이상 열리지 않는다.
2. 서 있는데 pass가 더 이상 열리지 않는다.
3. `descent_span_too_short` 상태에서 official_shallow_cycle closer가 열리지 않는다.
4. `ascent_recovery_span_too_short` 상태에서 official_shallow_cycle closer가 열리지 않는다.
5. stream bridge만으로 official_shallow_cycle closer가 열리지 않는다.
6. ascent-equivalent만으로 official_shallow_cycle closer가 열리지 않는다.
7. provenance-only / trajectory-only 구조는 여전히 blocked다.
8. legitimate shallow ultra-low cycle은 여전히 통과 가능하다.
9. canonical closer 단일 writer가 유지된다.
10. deep standard squat 회귀가 없다.

---

## 최종 원칙 한 줄
**이번 PR은 shallow를 다시 닫는 PR이 아니라, official_shallow_cycle closer가 integrity를 통과한 경우에만 열리도록 다시 잠그는 PR이다.**
