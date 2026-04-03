# PR-6 — Ultra-low Policy Re-scope SSOT

## 목적
이 문서는 스쿼트 카메라 리팩토링 이후 남은 핵심 병목인 `ultra_low_rom_not_allowed` 차단을 해결하기 위한 PR-6의 단일 진실 문서다.

이번 PR의 목표는 얕은 스쿼트를 억지로 통과시키는 것이 아니다.
목표는 **의미 있는 ultra-low shallow cycle은 허용하고, false positive는 그대로 차단하는 것**이다.

이 문서는 다음을 강하게 고정한다.
- completion truth는 completion core + canonical shallow closer에서만 결정한다.
- product policy는 completion truth를 읽는 소비자 레이어다.
- `ultra_low_rom` band 자체는 실패 사유가 아니다.
- legitimate ultra-low cycle과 illegitimate ultra-low pattern을 구분해야 한다.

---

## 현재 문제의 진실
실기기 로그 기준 현재 병목은 더 이상 “얕은 스쿼트를 못 본다”가 아니다.

이미 관측되는 것:
- `attemptStarted`
- `descendConfirmed`
- `reversalConfirmedAfterDescend`
- `recoveryConfirmedAfterReversal`
- `officialShallowPathCandidate`
- `officialShallowPathAdmitted`
- `officialShallowClosureProofSatisfied`

그런데 최종 결과는 아래로 막힌다.
- `completionBlockedReason = ultra_low_rom_not_allowed`
- `completionSatisfied = false`

즉 현재 병목은 **completion core가 아니라 product policy scope / decision**이다.

---

## 현재 아키텍처에서 유지해야 할 진실
### 1. 단일 success writer 유지
성공 상태를 여는 writer는 계속 한 곳만 허용한다.

허용:
- canonical shallow closer

금지:
- evaluator에서 success 다시 열기
- auto-progression에서 success truth 재정의
- product policy에서 success를 직접 만들기
- provenance / trajectory / debug field가 success writer처럼 동작하기

### 2. product policy는 owner truth가 아니다
`applyUltraLowPolicyLock`는 completion truth를 만드는 곳이 아니다.
이 레이어는 이미 형성된 completion/canonical truth를 읽고, 제품 정책상 차단할 ultra-low case만 걸러야 한다.

### 3. ultra-low band는 곧 실패가 아니다
`evidenceLabel === ultra_low_rom`만으로 자동 실패하면 안 된다.
ultra-low라도 meaningful cycle이 입증되면 통과 가능해야 한다.

### 4. false positive 방어는 유지되어야 한다
다음은 여전히 막혀야 한다.
- standing still
- descent only
- bottom stall
- setup motion contamination
- series-start contamination
- trajectory-only fake reversal
- provenance-only fake reversal
- no finalize / no recovery / no standing truth

---

## PR-6의 핵심 목표
현재 정책은 사실상 다음과 같다.
- ultra-low scope + decisionReady => blocked

PR-6 이후 정책은 다음이 되어야 한다.
- ultra-low scope + illegitimate pattern => blocked
- ultra-low scope + legitimate cycle already proven => allowed

즉 이번 PR은 `ultra_low_rom_not_allowed`를 제거하는 PR이 아니다.
이번 PR은 **blanket ultra-low block을 illegitimate ultra-low block으로 좁히는 PR**이다.

---

## legitimate ultra-low cycle 정의
새 threshold를 발명하지 말고, 현재 시스템이 이미 가지고 있는 truth를 재사용한다.

legitimate ultra-low cycle 후보는 최소한 아래 묶음을 만족해야 한다.

### A. 공식 shallow contract 진입
- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`

### B. 실제 cycle truth 존재
- `attemptStarted === true`
- `descendConfirmed === true`
- `reversalConfirmedAfterDescend === true`
- `recoveryConfirmedAfterReversal === true`

### C. standing/finalize truth 존재
- standing finalize truth satisfied
- finalize reason이 인정 가능한 finalize 계열

### D. false-positive 방어 유지
- `setupMotionBlocked !== true`
- series-start contamination false
- provenance-only / trajectory-only fake reversal 아님
- bottom-stall / descent-only / no-recovery 아님

### E. canonical-authoritative closure 수준의 증거 존재
다음 중 적어도 하나:
- canonical shallow contract satisfied
- canonical-authoritative closure would be satisfied
- same-level existing canonical closure bundle already proven

핵심은 이것이다.
**ultra_low_rom이라는 밴드가 아니라, 이미 확보된 legitimate cycle truth 묶음으로 허용 여부를 결정해야 한다.**

---

## illegitimate ultra-low pattern 정의
다음은 계속 blocked 되어야 한다.

- ultra-low band이지만 attempt가 안 열림
- descend는 보이지만 reversal truth가 없음
- reversal은 보여도 recovery truth가 없음
- standing finalize truth가 없음
- setup motion contamination 있음
- peak/series-start contamination 남아 있음
- trajectory-only rescue만 있고 canonical-authoritative reversal/recovery가 없음
- provenance-only signal만 있고 canonical closure 수준의 증거가 없음

즉 blocked 기준은 “ultra-low” 자체가 아니라 **아직 meaningful cycle이 입증되지 않았음**이어야 한다.

---

## 정책 레이어의 올바른 역할
PR-6 이후 product policy layer는 다음만 해야 한다.

1. ultra-low scope인지 판정
2. legitimate ultra-low cycle이 이미 입증되었는지 판정
3. 입증되지 않은 ultra-low case만 blocked
4. 입증된 경우는 owner truth를 존중하고 pass를 유지

정책 레이어가 해서는 안 되는 일:
- completion truth 새로 만들기
- canonical closer 우회하기
- band만 보고 pass/fail 결정하기
- evaluator/auto-progression의 truth writer화 유도하기

---

## 변경 범위
### 포함
- ultra-low policy scope 재정의
- ultra-low policy decision readiness 재정의
- legitimate ultra-low cycle 허용 조건 정의
- evaluator boundary에서의 policy 적용 조건 조정
- regression/smoke 보강이 필요하면 ultra-low policy 케이스 추가

### 비포함
- completion core 전체 재설계
- shallow contract 전체 재설계
- evaluator ownership 재설계
- auto-progression 전체 재설계
- unrelated threshold 수정
- overhead reach 등 다른 동작 수정

---

## 절대 금지
1. 특정 케이스만 통과시키는 threshold patch 금지
2. `ultra_low_rom` 전체 허용 금지
3. 새로운 success writer 추가 금지
4. evaluator가 completion truth 다시 쓰기 금지
5. auto-progression이 motion truth 다시 쓰기 금지
6. trajectory-only / provenance-only evidence를 success writer로 승격 금지
7. setup / standing / series-start false pass 방어 약화 금지
8. deep standard squat 회귀 금지
9. quality warning을 pass truth와 혼합 금지
10. blanket unblock 또는 blanket ban 금지

---

## 완료 정의
PR-6이 끝났다고 말하려면 아래가 모두 만족되어야 한다.

1. meaningful ultra-low shallow cycle이 pass 가능해진다.
2. standing still은 여전히 pass 금지다.
3. descent only는 여전히 pass 금지다.
4. bottom stall은 여전히 pass 금지다.
5. setup motion contamination은 여전히 blocked다.
6. series-start contamination은 여전히 blocked다.
7. trajectory-only / provenance-only fake reversal은 여전히 blocked다.
8. canonical shallow closer 단일 writer가 유지된다.
9. evaluator / auto-progression은 여전히 consumer다.
10. deep standard squat 회귀가 없다.

---

## 권장 구현 방향
좋은 PR-6은 대체로 다음 형태를 가진다.

- `applyUltraLowPolicyLock`가 blanket ultra-low block이 아니라 illegitimate-ultra-low block만 수행
- `isUltraLowPolicyScope` 또는 `isUltraLowPolicyDecisionReady`가 band-only가 아니라 contract-aware truth를 재사용
- legitimate ultra-low cycle already proven check를 기존 truth 묶음으로 정의
- canonical closer 이후, evaluator boundary에서 policy를 1회 적용하는 구조를 유지
- regression에 legitimate-ultra-low-pass vs illegitimate-ultra-low-block을 명시적으로 추가

---

## 최종 원칙 한 줄
**이번 PR은 ultra-low를 통째로 열어주는 PR이 아니라, 이미 입증된 meaningful ultra-low cycle을 blanket policy 차단에서 구출하는 PR이다.**
